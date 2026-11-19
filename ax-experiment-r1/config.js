// =====================================================================
// AX discrimination experiment: settings
// Edit the values in this file; you should not need to touch experiment.js.
// =====================================================================

const CONFIG = {
  // ---- Response keys ------------------------------------------------
  // "counterbalance": odd participant numbers press F for SAME and J for
  // DIFFERENT; even numbers the reverse. Non-numeric IDs are assigned at
  // random. Use "F_same" or "J_same" to fix the mapping for everyone.
  key_mapping: "counterbalance",

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
  // At the end, a CSV is downloaded to the computer running the experiment.
  save_local_csv: true,

  // Optional: upload the same CSV to OSF through DataPipe
  // (https://pipe.jspsych.org). Paste your DataPipe experiment ID here to
  // turn it on; leave it as "" to keep data on the local computer only.
  datapipe_experiment_id: "",

  // ---- Volume check ---------------------------------------------------
  // The sound played on the volume-setting screen. Leave as "" to use the
  // first practice trial, or give a file name from the stimuli/ folder.
  volume_sample: "",
};
