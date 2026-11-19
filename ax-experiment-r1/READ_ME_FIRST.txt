ax-experiment-r1: AX task, /aː/ only, 134 test trials + 8 practice, 1500 ms ISI,
revised language questionnaire. This is a separate copy; the original
ax-experiment folder is unchanged.

1. Build the sounds
   Copy materials/stitch_AX_trials.praat and materials/AX_trials_for_praat.csv
   into a folder with your token wavs (a fresh folder, or move any old
   AX_trials output out first). Run the script in Praat with Noise = None.
   It writes 124 wavs (116 test + 8 practice) to an AX_trials subfolder.

2. Add the sounds
   Copy those 124 wavs into ax-experiment-r1/stimuli/.

3. Put it on GitHub
   Upload the whole ax-experiment-r1 folder to the ALVEOLAR repository, next to
   ax-experiment (wavs in two batches; the web uploader takes 100 at a time).
   Address: https://saplabyork.github.io/ALVEOLAR/ax-experiment-r1/?pid=1

4. Check it
   Open the address with ?simulate=data-only&pid=1 first. If it reaches the
   thank-you screen, all files are in place.

Data files are named AX_r1_<pid>_<date-time>.csv. See README.md for the
questionnaire coding (q_born_in_canada, q_home_language, ...).
