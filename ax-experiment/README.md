# AX discrimination experiment

A browser experiment built with jsPsych 7.3.4. All libraries are bundled in `lib/`, so it doesn't depend on any outside servers. It runs from any static web host, including GitHub Pages.

## Folder contents

| File | What it is |
| --- | --- |
| `index.html` | The page participants open |
| `config.js` | Settings: key mapping, timing, data saving. **Edit this one.** |
| `experiment.js` | The experiment itself (consent, questionnaire, practice, test, saving) |
| `trials.js` | The 8 practice and 152 test trials, generated from `AX_trial_list.xlsx` |
| `stimuli/` | Put the stitched trial wavs here (see below) |
| `lib/` | jsPsych and its plugins |

## Setup

1. **Add the sounds.** Copy every wav from the Praat output folder `AX_trials/` (the no-noise version: 152 `AX_…wav` files plus 8 `PR_…wav` files) into `stimuli/`.
2. **Edit the placeholders** in `experiment.js`: the consent text (step 4) and the debriefing text (step 11). Search for `PLACEHOLDER`. Adjust the questionnaire (step 5) if needed.
3. **Put the folder on your GitHub Pages site.** Copy the whole folder into your site's repository, for example as `ax/`, then commit and push. After a minute or two, the experiment is at `https://<your-username>.github.io/ax/`.

## Running a session

- Use Chrome or Firefox on a computer with headphones.
- Open `https://<your-username>.github.io/ax/?pid=12`, replacing 12 with the participant number. Without `?pid=`, the first screen asks the experimenter to type an ID.
- Odd participant numbers press **F = same, J = different**; even numbers press the reverse. Change this with `key_mapping` in `config.js`.
- Don't open `index.html` by double-clicking it. Browsers block sound loading from local files, so always use the web address (or a local web server).

## Data

At the end, a CSV named `AX_<pid>_<date-time>.csv` downloads to the computer's Downloads folder. Data are only saved at the end, so a session closed partway through saves nothing. Nothing is stored on GitHub.

To also upload each file to OSF, create a DataPipe experiment at <https://pipe.jspsych.org>, link it to an OSF project, and paste its experiment ID into `datapipe_experiment_id` in `config.js`.

For analysis, keep rows with `task == "AX_test"`. Their columns are:

| Column | Meaning |
| --- | --- |
| `participant_id`, `key_same`, `key_diff` | Participant and their key mapping |
| `block`, `trial_in_block` | Block (1 or 2) and position within it |
| `Trial_ID`, `Trial_name`, `Output_wav` | Which trial (matches `AX_trial_list.xlsx`) |
| `Condition`, `Trial_type`, `Contrast`, `Order`, `V1` | Same/Contrast, type, ALV-DEN/ALV-RET/DEN-RET, order, vowel |
| `Token1_file`, `Token2_file`, `Token1_cat`, `Token2_cat` | The two tokens |
| `correct_response`, `response_label`, `correct` | Correct answer, the participant's answer (same/different) and whether it was right |
| `timed_out` | No response within 3000 ms of sound offset |
| `rt`, `rt_from_offset`, `stim_duration_ms` | RT from sound onset, RT from the end of the second sound, file length |

The questionnaire answers are in the `questionnaire` row (`q_age`, `q_native_languages`, and so on). Practice rows have `task == "AX_practice"`.

## Testing without a participant

- `?simulate=data-only&pid=1` runs the whole experiment instantly with simulated responses. Nothing downloads in this mode, and the questionnaire is skipped.
- `?simulate=visual&pid=1` runs it in real time with sound and simulated key presses (about 10 minutes), then downloads the CSV.

## What happens on each trial

Fixation cross (300 ms) → stitched sound (token 1 + 1000 ms ISI + token 2) → response, accepted only after the sound ends, for up to 3000 ms → 500 ms blank. Practice trials show feedback. A timeout in the test shows "Please respond a little faster" for 1 s.

Within each block, the order is randomized afresh for every participant. No more than 3 trials in a row have the same correct answer, and no token appears on two consecutive trials.
