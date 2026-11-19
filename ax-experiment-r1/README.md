# AX discrimination experiment, version r1 (/aː/ only)

A browser experiment built with jsPsych 7.3.4. All libraries are bundled in `lib/`, so it doesn't depend on any outside servers. It runs from any static web host, including GitHub Pages.

**What's different from the first version:** every trial has V1 = /aː/; the 134 test trials keep the same counts per contrast (24 Different, 36 false-alarm trials); and the language background questionnaire is revised (see Data). Data files are named `AX_r1_…csv`, and every row has `experiment_version = r1`.

## Folder contents

| File | What it is |
| --- | --- |
| `index.html` | The page participants open |
| `config.js` | Settings: key mapping, timing, timeouts, data saving |
| `experiment.js` | The experiment itself (consent, questionnaire, practice, test, saving) |
| `trials.js` | The 8 practice and 134 test trials, generated from `materials/AX_r1_trial_list.xlsx` |
| `stimuli/` | Put the stitched trial wavs here |
| `lib/` | jsPsych and its plugins |
| `materials/` | Trial list spreadsheet (`AX_r1_trial_list.xlsx`), Praat CSV (`AX_trials_for_praat.csv`) and Praat stitching script |

## Setup

1. **Build the sounds.** Put `materials/stitch_AX_trials.praat` and `materials/AX_trials_for_praat.csv` in the folder with your token wavs (use a fresh copy of that folder, or move the old `AX_trials` output out of the way first), then run the script in Praat with Noise = None. It writes **124 wavs** (116 test + 8 practice) to an `AX_trials` subfolder. There are fewer wavs than trials because repeated Same pairs share one file.
2. **Add the sounds** to `stimuli/` in this folder.
3. **Put the folder on GitHub.** Upload the whole `ax-experiment-r1` folder to the repository next to the existing `ax-experiment` folder. The web uploader takes at most 100 files at a time, so add the wavs in two batches. The experiment is then at `https://saplabyork.github.io/ALVEOLAR/ax-experiment-r1/`.

## Running a session

- Use Chrome or Firefox on a computer with headphones.
- Open `https://saplabyork.github.io/ALVEOLAR/ax-experiment-r1/?pid=12`, replacing 12 with the participant number. Without `?pid=`, the first screen asks the experimenter to type an ID.
- Odd participant numbers press **F = same, J = different**; even numbers press the reverse. Change this with `key_mapping` in `config.js`.
- Don't open `index.html` by double-clicking it; always use the web address.
- A counter in the bottom-left corner shows the trial number within the block (e.g., 12/67). A countdown in the top-right corner shows the seconds left to respond, from the end of the second sound.
- **Timed-out trials are repeated.** If no key is pressed within 3 s, "Please respond a little faster" appears and the trial is added to the end of the same block. A trial can come back at most twice (`max_repeats` in `config.js`).
- **Press Esc at any point to stop.** The trials completed so far are saved in a file ending in `_ABORTED`.

## Data

At the end, the browser downloads `AX_r1_<pid>_<date-time>.csv` to the **Downloads folder of the computer running the experiment**. Nothing is stored on GitHub. Closing the window without pressing Esc saves nothing.

**Google Drive:** each session's CSV can also be saved automatically to a folder in your Google Drive, from any computer. Set this up with the separate `AX_drive_relay` package (see its `DRIVE_SETUP.md`), then paste the web app URL into `upload_endpoint` in `config.js`. If the upload fails, the end screen tells the experimenter and names the backup CSV on that computer.

**Questionnaire columns** (in the `questionnaire` row):

| Column | Coding |
| --- | --- |
| `q_gender` | Typed text |
| `q_age` | Years |
| `q_born_in_canada` | 1 = born in Canada, 0 = not born in Canada |
| `q_home_language` | 0 = English only, 1 = English and another language |
| `q_home_language_other` | The other language(s), typed; empty if English only |

The "other language" box is only active, and then required, when "English and another language" is chosen.

**Trial columns:** for analysis, keep rows with `task == "AX_test"` and `timed_out == false`. The columns are the same as in the first version: `participant_id`, `key_same`, `key_diff`, `block`, `trial_in_block`, `Trial_ID`, `Trial_name`, `Condition`, `Trial_type`, `Contrast`, `Order`, `V1`, `Token1_file`, `Token2_file`, `Token1_cat`, `Token2_cat`, `correct_response`, `response_label`, `correct`, `timed_out`, `attempt`, `is_repeat`, `rt`, `rt_from_offset`, `stim_duration_ms`. The `ax_analysis.R` script reads these files unchanged.

## Testing without a participant

- `?simulate=data-only&pid=1` runs the whole experiment instantly with simulated responses (the questionnaire is skipped and nothing downloads).
- `?simulate=visual&pid=1` runs it in real time with sound and simulated key presses, then downloads the CSV.

## Design

134 test trials in two blocks of 67:

| Trial type | Cells | Reps per cell | Trials |
| --- | --- | --- | --- |
| Different: alv–den, alv–ret, den–ret × 2 orders | 6 | 12 | 72 |
| Same: alv, den, ret | 3 | 18 | 54 |
| Catch: pp–kk, kk–pp, pp–pp, kk–kk | 4 | 2 | 8 |

Each trial: fixation (300 ms) → token 1 + 1500 ms ISI + token 2 → response, from the end of the sound, for up to 3 s → 500 ms blank. Every coronal token appears 21 times. Same trials always pair two different tokens; with 4 tokens there are 12 such pairs per category, so 6 of them are used twice, once in each block. Within each block, the order is randomized afresh for every participant: no more than 3 trials in a row with the same correct answer, and no token on two consecutive trials.
