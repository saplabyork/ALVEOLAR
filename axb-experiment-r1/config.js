// =====================================================================
// AXB experiment: settings
// Edit the values in this file; you should not need to touch experiment.js.
// =====================================================================

const CONFIG = {
  // ---- Response keys --------------------------------------------------
  // Fixed for everyone in AXB: F = middle sound more like the FIRST,
  // J = more like the LAST (set in experiment.js).

  // ---- Timing (ms) ----------------------------------------------------
  // The ISI is built into the stitched wav files, not set here.
  fixation_ms: 300,          // fixation cross before each trial
  response_window_ms: 3000,  // time allowed to respond after the sound ends
  iti_ms: 500,               // blank interval after each response
  practice_feedback_ms: 800, // how long practice feedback stays on screen
  slow_message_ms: 1000,     // "Please respond faster" after a test timeout

  // ---- Timed-out trials ----------------------------------------------
  // A trial with no response is repeated at the end of the same block.
  // max_repeats limits how many extra times one trial can come back.
  max_repeats: 2,

  // ---- Saving data --------------------------------------------------
  // Normally data go only to Google Drive (upload_endpoint below). A CSV is
  // downloaded to the testing computer only if that upload fails, or if no
  // upload_endpoint is set. Set save_local_csv to true to always download one.
  save_local_csv: false,  // true = also download a copy at the end of every session

  // Optional: upload the same CSV to OSF through DataPipe
  // (https://pipe.jspsych.org). Paste your DataPipe experiment ID here to
  // turn it on; leave it as "" to keep data on the local computer only.
  datapipe_experiment_id: "",

  // Optional: save each session's CSV to your Google Drive through your
  // Google Apps Script relay (see DRIVE_SETUP.md in AX_drive_relay; the same
  // relay and URL as the AX experiment). Paste the
  // web app URL (ends in /exec) here; leave as "" to turn it off.
  // upload_key must match KEY in Code.gs.
  upload_endpoint: "https://script.google.com/macros/s/AKfycbzWWWk_9lp9NKwBbHt6Vipdg4Ve2a71FjgX0HFFIQZNY93vJoYLcaIrM2v42zh8DVEL/exec",
  upload_key: "ax-e5199b8bbf37a58c",

  // ---- Volume check ---------------------------------------------------
  // The sound played on the volume-setting screen. Leave as "" to use the
  // first practice trial, or give a file name from the stimuli/ folder.
  volume_sample: "",
};
