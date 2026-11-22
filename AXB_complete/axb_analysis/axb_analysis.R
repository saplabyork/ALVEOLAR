# =====================================================================
# AXB triad categorization: combine, clean, and summarize grouping
#
# 1. Reads every AXB_*.csv in `data_dir` (one file per participant session)
# 2. Keeps test trials and only the columns needed for the analysis
# 3. Flags participants for exclusion (catch accuracy, timeouts)
# 4. Critical trials (X = alveolar, references = dental and retroflex):
#    each listener's proportion of "grouped with the dental" choices,
#    by reference order, with a binomial test against 50% that classifies
#    the listener as a dental grouper, a retroflex grouper, or neither
# 5. Anchor trials (X = dental or retroflex), position bias, results by
#    alveolar token, and a group summary
#
# Requires: dplyr, readr, tidyr, purrr
#   install.packages(c("dplyr", "readr", "tidyr", "purrr"))
# Optional: lme4 (adds a mixed-effects model of the group preference)
# =====================================================================

suppressPackageStartupMessages({
  library(dplyr)
  library(readr)
  library(tidyr)
  library(purrr)
})

# ---------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------
data_dir   <- "data"      # folder containing the AXB_*.csv files
output_dir <- "results"   # created if it doesn't exist

include_aborted   <- FALSE  # include sessions stopped with Esc (_ABORTED files)?
catch_min_correct <- 7/8    # exclude if catch accuracy is below this
max_timeout_rate  <- 0.10   # exclude if more than this share of first presentations timed out
alpha             <- 0.05   # for classifying listeners (binomial test against 50%)

# Allow `Rscript axb_analysis.R path/to/data path/to/results`
args <- commandArgs(trailingOnly = TRUE)
if (length(args) >= 1) data_dir   <- args[1]
if (length(args) >= 2) output_dir <- args[2]
dir.create(output_dir, showWarnings = FALSE, recursive = TRUE)

# ---------------------------------------------------------------------
# 1. Read and combine all files
# ---------------------------------------------------------------------
files <- list.files(data_dir, pattern = "^AXB_.*\\.csv$", full.names = TRUE)
if (length(files) == 0) stop("No AXB_*.csv files found in '", data_dir, "'.")
if (!include_aborted) {
  aborted_files <- grepl("_ABORTED\\.csv$", files)
  if (any(aborted_files)) message("Skipping ", sum(aborted_files), " aborted session file(s).")
  files <- files[!aborted_files]
}
message("Reading ", length(files), " file(s).")

raw <- map_dfr(files, function(f) {
  read_csv(f, col_types = cols(.default = col_character()), na = c("", "NA", "null"),
           show_col_types = FALSE) |>
    mutate(source_file = basename(f))
})

dup_ids <- raw |> distinct(participant_id, source_file) |> count(participant_id) |> filter(n > 1)
if (nrow(dup_ids) > 0) {
  warning("Participant ID(s) found in more than one file: ",
          paste(dup_ids$participant_id, collapse = ", "),
          ". They are kept separate by session (source_file).")
}

# ---------------------------------------------------------------------
# 2. Clean: test trials only, needed columns only, proper types
# ---------------------------------------------------------------------
to_lgl <- function(x) toupper(x) == "TRUE"

trials <- raw |>
  filter(task == "AXB_test") |>
  transmute(
    source_file,
    participant_id,
    session        = sub("\\.csv$", "", source_file),
    block          = as.integer(block),
    trial_in_block = as.integer(trial_in_block),
    Trial_ID, Trial_type,          # Critical / Anchor / Catch
    Order,                         # A-X-B categories, e.g. DEN-ALV-RET
    A_file, X_file, B_file, A_cat, X_cat, B_cat,
    correct_response,              # first / last / none
    attempt        = as.integer(attempt),
    is_repeat      = to_lgl(is_repeat),
    timed_out      = to_lgl(timed_out),
    response_label,                # first / last / NA if timed out
    chose_first    = to_lgl(chose_first),
    chosen_cat, chosen_file,
    correct        = to_lgl(correct),       # catch trials only
    chose_dental   = as.integer(chose_dental), # critical trials only
    rt             = as.numeric(rt),
    rt_from_offset = as.numeric(rt_from_offset)
  )

write_csv(trials, file.path(output_dir, "axb_trials_clean.csv"), na = "")

# Answered trials only: timed-out presentations are dropped; their repeats
# (attempt 2-3) take their place.
answered <- trials |> filter(!timed_out)

# ---------------------------------------------------------------------
# 3. Participant checks and exclusion flags
# ---------------------------------------------------------------------
qc <- trials |>
  group_by(participant_id, session) |>
  summarise(
    n_first_presentations = sum(attempt == 1),
    n_timeouts_first      = sum(attempt == 1 & timed_out),
    timeout_rate          = n_timeouts_first / n_first_presentations,
    n_repeats             = sum(is_repeat),
    n_answered            = sum(!timed_out),
    catch_correct         = sum(Trial_type == "Catch" & !timed_out & correct, na.rm = TRUE),
    catch_answered        = sum(Trial_type == "Catch" & !timed_out),
    catch_accuracy        = catch_correct / catch_answered,
    .groups = "drop"
  ) |>
  mutate(
    exclude_catch   = catch_accuracy < catch_min_correct,
    exclude_timeout = timeout_rate > max_timeout_rate,
    exclude         = exclude_catch | exclude_timeout
  )
write_csv(qc, file.path(output_dir, "participant_qc.csv"))

keep <- qc |> filter(!exclude) |> select(participant_id, session)

# ---------------------------------------------------------------------
# 4. Critical trials: grouping of the alveolar
# ---------------------------------------------------------------------
critical <- answered |> filter(Trial_type == "Critical")

# Wilson 95% interval for a proportion
wilson <- function(k, n, z = 1.96) {
  p <- k / n; den <- 1 + z^2 / n
  centre <- (p + z^2 / (2 * n)) / den
  half <- z * sqrt(p * (1 - p) / n + z^2 / (4 * n^2)) / den
  c(centre - half, centre + half)
}

grouping <- critical |>
  group_by(participant_id, session) |>
  summarise(
    n_critical      = n(),
    n_dental        = sum(chose_dental),
    p_dental        = n_dental / n_critical,
    # by reference order (which reference came first)
    p_dental_DENfirst = mean(chose_dental[A_cat == "DEN"]),
    p_dental_RETfirst = mean(chose_dental[A_cat == "RET"]),
    .groups = "drop"
  ) |>
  rowwise() |>
  mutate(
    ci_low  = wilson(n_dental, n_critical)[1],
    ci_high = wilson(n_dental, n_critical)[2],
    p_value = binom.test(n_dental, n_critical, p = 0.5)$p.value
  ) |>
  ungroup() |>
  mutate(
    grouping = case_when(
      p_value < alpha & p_dental > 0.5 ~ "dental grouper",
      p_value < alpha & p_dental < 0.5 ~ "retroflex grouper",
      TRUE                             ~ "no clear preference"
    )
  ) |>
  left_join(qc |> select(participant_id, session, exclude), by = c("participant_id", "session"))

# Position bias across Critical and Anchor trials (no correct answer):
# 0.5 = no bias; above 0.5 = tends to choose the first sound
bias <- answered |>
  filter(Trial_type %in% c("Critical", "Anchor")) |>
  group_by(participant_id, session) |>
  summarise(p_chose_first = mean(chose_first), .groups = "drop")
grouping <- grouping |> left_join(bias, by = c("participant_id", "session"))

write_csv(grouping, file.path(output_dir, "grouping_by_participant.csv"))

# ---------------------------------------------------------------------
# 5. Anchor trials (completing the similarity triangle)
# ---------------------------------------------------------------------
# X = DEN, references ALV and RET: did they group the dental with the alveolar?
# X = RET, references ALV and DEN: did they group the retroflex with the alveolar?
anchors <- answered |>
  filter(Trial_type == "Anchor") |>
  group_by(participant_id, session, X_cat) |>
  summarise(n = n(), p_chose_ALV = mean(chosen_cat == "ALV"), .groups = "drop") |>
  pivot_wider(names_from = X_cat, values_from = c(n, p_chose_ALV),
              names_glue = "{.value}_Xis{X_cat}")
write_csv(anchors, file.path(output_dir, "anchors_by_participant.csv"))

# ---------------------------------------------------------------------
# 6. By alveolar token (included participants)
# ---------------------------------------------------------------------
by_token <- critical |>
  semi_join(keep, by = c("participant_id", "session")) |>
  group_by(X_file) |>
  summarise(n_trials = n(), p_dental = mean(chose_dental), .groups = "drop")
write_csv(by_token, file.path(output_dir, "grouping_by_alveolar_token.csv"))

# ---------------------------------------------------------------------
# 7. Group summary (participants who pass the checks)
# ---------------------------------------------------------------------
g_keep <- grouping |> filter(!exclude)

cat("\n===== Participant checks =====\n")
print(as.data.frame(qc |> select(participant_id, n_answered, timeout_rate, n_repeats,
                                 catch_accuracy, exclude) |>
                      mutate(across(c(timeout_rate, catch_accuracy), \(x) round(x, 3)))),
      row.names = FALSE)

cat("\n===== Grouping of the alveolar (Critical trials) =====\n")
cat("p_dental = proportion of trials on which the alveolar was grouped with the dental\n\n")
print(as.data.frame(grouping |>
                      select(participant_id, n_critical, p_dental, ci_low, ci_high,
                             p_dental_DENfirst, p_dental_RETfirst, p_chose_first, grouping, exclude) |>
                      mutate(across(where(is.double), \(x) round(x, 3)))),
      row.names = FALSE)

cat("\n===== Anchor trials: proportion grouped with the alveolar =====\n")
print(as.data.frame(anchors |> select(-session) |> mutate(across(where(is.double), \(x) round(x, 3)))), row.names = FALSE)

cat("\n===== By alveolar token (included participants) =====\n")
print(as.data.frame(by_token |> mutate(p_dental = round(p_dental, 3))), row.names = FALSE)

cat("\n===== Group summary (included participants) =====\n")
cat("Included:", nrow(g_keep), "of", nrow(grouping), "\n")
if (nrow(g_keep) > 0) {
  cat("Listener types:\n"); print(table(g_keep$grouping))
  cat(sprintf("Mean p_dental: %.3f (SD %.3f)\n", mean(g_keep$p_dental),
              if (nrow(g_keep) > 1) sd(g_keep$p_dental) else NA))
}

if (nrow(g_keep) >= 3) {
  # Is the group, on average, biased toward one side?
  cat("\n-- Group preference: one-sample t-test of p_dental against 0.5 --\n")
  print(t.test(g_keep$p_dental, mu = 0.5))

  # Do listeners differ more than chance would predict? (heterogeneity test)
  cat("\n-- Do listeners differ in their preference? (test of equal proportions) --\n")
  print(prop.test(g_keep$n_dental, g_keep$n_critical))

  # Split-half reliability: odd vs even critical trials within each listener
  halves <- critical |>
    semi_join(keep, by = c("participant_id", "session")) |>
    group_by(participant_id, session) |>
    arrange(Trial_ID, attempt, .by_group = TRUE) |>
    mutate(half = if_else(row_number() %% 2 == 1, "odd", "even")) |>
    group_by(participant_id, session, half) |>
    summarise(p = mean(chose_dental), .groups = "drop") |>
    pivot_wider(names_from = half, values_from = p)
  r <- cor(halves$odd, halves$even)
  cat(sprintf("\nSplit-half reliability of p_dental: r = %.3f; Spearman-Brown corrected = %.3f\n",
              r, 2 * r / (1 + r)))
} else {
  cat("\n(Group tests need at least 3 included participants; skipped.)\n")
}

# Optional mixed-effects model: group preference with listener and token variation
if (nrow(g_keep) >= 3 && requireNamespace("lme4", quietly = TRUE)) {
  cat("\n-- Mixed-effects logistic model: chose_dental ~ 1 + (1 | participant) + (1 | alveolar token) --\n")
  d_model <- critical |> semi_join(keep, by = c("participant_id", "session"))
  m <- lme4::glmer(chose_dental ~ 1 + (1 | participant_id) + (1 | X_file),
                   data = d_model, family = binomial)
  print(summary(m)$coefficients)
  cat("Intercept > 0 means the group leans dental; the participant variance shows how much listeners differ.\n")
  print(lme4::VarCorr(m))
}

cat("\nResults written to '", output_dir, "':\n",
    paste0("  ", list.files(output_dir), collapse = "\n"), "\n", sep = "")
