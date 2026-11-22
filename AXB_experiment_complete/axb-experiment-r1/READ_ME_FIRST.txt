axb-experiment-r1: AXB triad categorization, /aː/ only, 80 test trials
(56 critical, 16 anchor, 8 catch) + 8 practice, 1500 ms ISI.

1. Build the sounds
   Copy materials/stitch_AXB_trials.praat and materials/AXB_trials_for_praat.csv
   into the folder with your token wavs. Run the script in Praat (Noise = None).
   It writes 88 wavs AND AXB_timings.csv to an AXB_trials subfolder.

2. Add the sounds
   Copy the 88 wavs and AXB_timings.csv into axb-experiment-r1/stimuli/.

3. Let your Google script accept AXB files (one-time)
   The script currently accepts only files starting with AX_. In the
   AX_drive_relay package, Code.gs has been updated to accept AXB_ too.
   a. Open your "AX data relay" project at script.google.com.
   b. Replace all of its code with the new Code.gs and click Save.
   c. Deploy > Manage deployments > pencil icon > Version: New version > Deploy.
      The web app URL stays the same.

4. Connect the experiment to Drive
   In axb-experiment-r1/config.js, paste the same web app URL you use for the
   AX experiment into upload_endpoint.

5. Put it on GitHub
   Upload the whole axb-experiment-r1 folder to the ALVEOLAR repository.
   Address: https://saplabyork.github.io/ALVEOLAR/axb-experiment-r1/?pid=1

6. Check it
   Open the address with ?simulate=data-only&pid=axbtest. The page stays
   blank; within a minute a file AXB_r1_axbtest_....csv should appear in your
   Drive folder. Delete it afterwards.

See README.md for the design and the data columns.
