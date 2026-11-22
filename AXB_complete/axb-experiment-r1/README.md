# AXB triad categorization experiment, version r1 (/aː/ only)

A browser experiment built with jsPsych 7.3.4. Listeners hear three sounds (A, X, B) and judge whether the **middle** sound is more like the **first** (F) or the **last** (J). On the main (Critical) trials, X is an alveolar and A and B are a dental and a retroflex, so there is no right answer: the choice shows which way each listener groups the alveolar.

It uses the same 20 /aː/ tokens, ISI (1500 ms), consent text, questionnaire, countdown, timeout handling, Esc abort and Google Drive saving as `ax-experiment-r1`.

## Folder contents

| File | What it is |
| --- | --- |
| `index.html` | The page participants open (includes the trial-screen styles) |
| `config.js` | Settings: timing, timeouts, data saving |
| `experiment.js` | The experiment itself |
| `trials.js` | The 8 practice and 80 test trials, generated from `materials/AXB_r1_trial_list.xlsx` |
| `stimuli/` | The stitched trial wavs and `AXB_timings.csv` |
| `lib/` | jsPsych and its plugins |
| `materials/` | Trial list spreadsheet, Praat CSV (`AXB_trials_for_praat.csv`) and Praat script (`stitch_AXB_trials.praat`) |

## Setup

1. **Build the sounds.** Put `materials/stitch_AXB_trials.praat` and `materials/AXB_trials_for_praat.csv` in the folder with your token wavs, then run the script in Praat with Noise = None. It writes **88 wavs** (80 test + 8 practice) and **AXB_timings.csv** to an `AXB_trials` subfolder.
2. **Add the sounds.** Copy the 88 wavs **and AXB_timings.csv** into `stimuli/`. The timings file tells the experiment when to light up each square; without it, the squares don't light up (everything else still works).
3. **Connect Google Drive.** In `config.js`, paste the same web app URL you use for the AX experiment into `upload_endpoint`. Also update the Google script so it accepts AXB files: see `READ_ME_FIRST.txt`.
4. **Put the folder on GitHub.** Upload the whole `axb-experiment-r1` folder to the ALVEOLAR repository. The experiment is then at `https://saplabyork.github.io/ALVEOLAR/axb-experiment-r1/`.

## Running a session

- Open `https://saplabyork.github.io/ALVEOLAR/axb-experiment-r1/?pid=12` (replace 12 with the participant number).
- Keys are the same for everyone: **F = middle is more like the FIRST, J = more like the LAST**.
- **Trial screen:** three squares stand for the three sounds; each lights up while its sound plays. Arrows with question marks point from the middle square to the first and last squares, with F and J underneath.
- Responses count only after the third sound ends; listeners then have 3 seconds, with a countdown in the top-right corner. A counter in the bottom-left shows the trial number within the block (x/40).
- **Timed-out trials** show "Please respond a little faster" and are repeated at the end of the same block (at most twice).
- **Esc** stops the session and saves the trials so far in a file ending in `_ABORTED`.

## Design

80 test trials in two blocks of 40, plus 8 practice trials (pp/kk, with feedback).

| Trial type | A – X – B | Trials | Correct answer |
| --- | --- | --- | --- |
| Critical | DEN – ALV – RET | 28 | none |
| Critical | RET – ALV – DEN | 28 | none |
| Anchor | ALV – DEN – RET, RET – DEN – ALV | 4 + 4 | none |
| Anchor | ALV – RET – DEN, DEN – RET – ALV | 4 + 4 | none |
| Catch | LAB – LAB – VEL and variants | 8 | first or last |

Each trial: fixation (300 ms) → A + 1500 ms + X + 1500 ms + B → response for up to 3 s → 500 ms blank. Every trial uses three different recordings and no triad repeats. Each alveolar token is the middle sound 14 times (7 per order); each dental and retroflex token is a critical reference 7 times first and 7 times last. Within each block, order is randomized for every participant: no recording on two consecutive trials, and no more than 3 trials in a row with the same order.

## Data

Files are named `AXB_r1_<pid>_<date-time>.csv`, with `experiment_version = axb-r1` on every row. They are saved to your Google Drive folder (once `upload_endpoint` is set in `config.js`). Nothing is downloaded to the testing computer unless the upload fails: then a backup CSV is downloaded and the end screen tells the experimenter. To always download a copy as well, set `save_local_csv: true` in `config.js`. If no `upload_endpoint` is set, the CSV is downloaded instead.

Analyse the files with `axb_analysis.R` (in the separate analysis folder).

For analysis, keep rows with `task == "AXB_test"` and `timed_out == false`.

| Column | Meaning |
| --- | --- |
| `participant_id`, `block`, `trial_in_block`, `Trial_ID` | Who, where, which trial |
| `Trial_type` | Critical / Anchor / Catch |
| `Order` | Categories in playing order, A-X-B (e.g. DEN-ALV-RET) |
| `A_file`, `X_file`, `B_file`, `A_cat`, `X_cat`, `B_cat` | The three tokens and their categories |
| `response_label` | first / last |
| `chose_first` | true if F was pressed |
| `chosen_cat`, `chosen_file` | The category and token the middle sound was grouped with |
| `chose_dental` | Critical trials only: 1 = grouped the alveolar with the dental, 0 = with the retroflex |
| `correct_response`, `correct` | Catch and practice only (empty for Critical and Anchor trials) |
| `timed_out`, `attempt`, `is_repeat` | Timeouts and their repeats |
| `rt`, `rt_from_offset`, `stim_duration_ms` | RT from sound onset, RT from the end of the third sound, file length |

Questionnaire columns (`q_gender`, `q_age`, `q_born_in_canada`, `q_home_language`, `q_home_language_other`) are coded as in `ax-experiment-r1`.

**Main measure:** each listener's proportion of `chose_dental` on Critical trials (56 trials). Exclusion: fewer than 7 of 8 catch trials correct, or timeouts on more than 10% of first presentations.

## Testing without a participant

- `?simulate=data-only&pid=1` runs instantly with simulated responses (blank page; the file is saved to Drive within seconds if `upload_endpoint` is set).
- `?simulate=visual&pid=1` runs in real time with sound and simulated key presses.
