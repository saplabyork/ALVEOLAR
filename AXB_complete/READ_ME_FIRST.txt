AXB triad categorization experiment (r1): everything in one place

axb-experiment-r1/   The web experiment for GitHub Pages, plus materials/
                     (trial list, Praat CSV and Praat stitching script).
                     Setup steps: axb-experiment-r1/READ_ME_FIRST.txt
AX_drive_relay/      The Google Apps Script that saves data to your Google
                     Drive (accepts both AX_ and AXB_ files) and its guide.
                     Keep this folder OFF GitHub.
axb_analysis/        axb_analysis.R: reads all AXB_*.csv files in a "data"
                     folder and summarizes each listener's grouping.

Order of setup
1. Build the 88 trial wavs + AXB_timings.csv with
   axb-experiment-r1/materials/stitch_AXB_trials.praat, and put them in
   axb-experiment-r1/stimuli/.
2. Update your existing Google script with AX_drive_relay/Code.gs and deploy
   a NEW VERSION (Deploy > Manage deployments > pencil > New version).
   The URL stays the same. (Skip if you already did this.)
3. Paste that URL into upload_endpoint in axb-experiment-r1/config.js.
4. Upload the axb-experiment-r1 folder to the ALVEOLAR repository.
5. Test: https://saplabyork.github.io/ALVEOLAR/axb-experiment-r1/?simulate=data-only&pid=axbtest
   A file AXB_r1_axbtest_....csv should appear in your Drive folder within a
   minute. Delete it afterwards.

Saving: data go only to Google Drive. A backup CSV is downloaded on the
testing computer only if the upload fails (the end screen then says so).

Analysis: download the Drive folder, unzip the AXB_*.csv files into a folder
called "data" next to axb_analysis.R, and run the script in R. It writes its
tables to a "results" folder. AX and AXB files can share the folder; each
script reads only its own files.
