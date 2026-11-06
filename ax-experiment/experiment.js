// =====================================================================
// AX discrimination experiment (jsPsych 7.3.4)
// Timeline: preload -> participant ID -> consent -> language questionnaire
// -> volume setting -> instructions -> 8 practice trials (feedback)
// -> 2 test blocks of 76 trials (break between) -> save data -> debrief
//
// URL options:
//   ?pid=12            set the participant ID (otherwise the experimenter types it)
//   ?simulate=visual   run through automatically with simulated key presses
//   ?simulate=data-only  same, instantly and without sound (for testing)
//
// Press Esc at any point to stop: the data so far are saved as ..._ABORTED.csv
// =====================================================================

const urlParams = new URLSearchParams(window.location.search);
const SIMULATE = urlParams.get("simulate"); // null, "visual" or "data-only"
const STIM_DIR = "stimuli/";
const DEFAULT_DURATION_S = 2.2; // used only if a sound's length can't be read

const state = {
  participant_id: urlParams.get("pid") || null,
  key_same: null,
  key_diff: null,
  durations: {}, // stimulus path -> duration in seconds
  saved: false,  // true once the data file has been saved
  blockCount: {}, // trials started so far in each block (for the counter)
};

const jsPsych = initJsPsych({
  // Show the trial counter only on trial screens (fixation, sound, feedback)
  on_trial_start: (trial) => {
    counterEl.style.display = trial.show_counter ? "block" : "none";
  },
});

// Trial counter in the bottom-left corner ("x/y" within the current block)
const counterEl = document.createElement("div");
counterEl.id = "trial-counter";
counterEl.style.display = "none";
document.documentElement.appendChild(counterEl);

function blockLabel() {
  const b = jsPsych.timelineVariable("Block");
  return b === "Practice" ? "Practice" : "Block " + b;
}
function blockTotal(b) {
  return b === "Practice" ? PRACTICE_TRIALS.length : TEST_TRIALS.filter((t) => t.Block === b).length;
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function setKeys(pid) {
  let sameIsF;
  if (CONFIG.key_mapping === "F_same") sameIsF = true;
  else if (CONFIG.key_mapping === "J_same") sameIsF = false;
  else {
    const n = parseInt(String(pid).replace(/\D/g, ""), 10);
    sameIsF = isNaN(n) ? Math.random() < 0.5 : n % 2 === 1;
  }
  state.key_same = sameIsF ? "f" : "j";
  state.key_diff = sameIsF ? "j" : "f";
  jsPsych.data.addProperties({
    participant_id: state.participant_id,
    key_same: state.key_same.toUpperCase(),
    key_diff: state.key_diff.toUpperCase(),
  });
}

function keyPrompt() {
  const left = state.key_same === "f"
    ? ["SAME", "F"] : ["DIFFERENT", "F"];
  const right = state.key_same === "f"
    ? ["DIFFERENT", "J"] : ["SAME", "J"];
  return `<div class="keys">
      <div class="keybox"><span class="key">${left[1]}</span><br>${left[0]}</div>
      <div class="keybox"><span class="key">${right[1]}</span><br>${right[0]}</div>
    </div>`;
}

function stimPath(trial) {
  return STIM_DIR + trial.Output_wav;
}

// Order one block's trials so that
//   - no more than 3 trials in a row share the same correct answer, and
//   - consecutive trials never share a token.
function orderBlock(trials) {
  const sharesToken = (a, b) =>
    a.Token1_file === b.Token1_file || a.Token1_file === b.Token2_file ||
    a.Token2_file === b.Token1_file || a.Token2_file === b.Token2_file;

  for (let attempt = 0; attempt < 5000; attempt++) {
    const pool = jsPsych.randomization.shuffle(trials.slice());
    const seq = [];
    let ok = true;
    while (pool.length) {
      const prev = seq[seq.length - 1];
      const run = seq.slice(-3);
      const idx = pool.findIndex((t) => {
        if (prev && sharesToken(prev, t)) return false;
        if (run.length === 3 && run.every((r) => r.Correct_response === t.Correct_response)) return false;
        return true;
      });
      if (idx === -1) { ok = false; break; }
      seq.push(pool.splice(idx, 1)[0]);
    }
    if (ok) return seq;
  }
  console.warn("Could not satisfy ordering constraints; using a plain shuffle.");
  return jsPsych.randomization.shuffle(trials.slice());
}

// ---------------------------------------------------------------------
// Trial building blocks
// ---------------------------------------------------------------------

const fixation = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: '<div class="fixation">+</div>',
  choices: "NO_KEYS",
  trial_duration: CONFIG.fixation_ms,
  data: { task: "fixation" },
  show_counter: true,
  on_start: () => {
    // Each trial starts with a fixation cross, so advance the counter here
    const b = jsPsych.timelineVariable("Block");
    state.blockCount[b] = (state.blockCount[b] || 0) + 1;
    counterEl.textContent = state.blockCount[b] + "/" + blockTotal(b);
  },
};

function axTrial(phase) {
  return {
    type: jsPsychAudioKeyboardResponse,
    stimulus: () => STIM_DIR + jsPsych.timelineVariable("Output_wav"),
    choices: () => [state.key_same, state.key_diff],
    prompt: () => keyPrompt(),
    response_allowed_while_playing: false,
    trial_ends_after_audio: false,
    show_counter: true,
    trial_duration: () => {
      const p = STIM_DIR + jsPsych.timelineVariable("Output_wav");
      const d = state.durations[p] || DEFAULT_DURATION_S;
      return Math.round(d * 1000) + CONFIG.response_window_ms;
    },
    post_trial_gap: phase === "test" ? CONFIG.iti_ms : 0,
    data: () => ({
      task: phase === "test" ? "AX_test" : "AX_practice",
      block: jsPsych.timelineVariable("Block"),
      Trial_ID: jsPsych.timelineVariable("Trial_ID"),
      Trial_name: jsPsych.timelineVariable("Trial_name"),
      Output_wav: jsPsych.timelineVariable("Output_wav"),
      Condition: jsPsych.timelineVariable("Condition"),
      Trial_type: jsPsych.timelineVariable("Trial_type"),
      Contrast: jsPsych.timelineVariable("Contrast"),
      Order: jsPsych.timelineVariable("Order"),
      V1: jsPsych.timelineVariable("V1"),
      Token1_file: jsPsych.timelineVariable("Token1_file"),
      Token2_file: jsPsych.timelineVariable("Token2_file"),
      Token1_cat: jsPsych.timelineVariable("Token1_cat"),
      Token2_cat: jsPsych.timelineVariable("Token2_cat"),
      correct_response: jsPsych.timelineVariable("Correct_response"),
    }),
    on_finish: (data) => {
      const p = STIM_DIR + data.Output_wav;
      const durMs = Math.round((state.durations[p] || DEFAULT_DURATION_S) * 1000);
      data.stim_duration_ms = durMs;
      data.timed_out = data.response === null;
      data.key_pressed = data.response;
      data.response_label = data.response === null ? null
        : (jsPsych.pluginAPI.compareKeys(data.response, state.key_same) ? "same" : "different");
      data.correct = data.response_label === data.correct_response;
      data.rt_from_offset = data.rt === null ? null : Math.round(data.rt - durMs);
      delete data.response; // replaced by key_pressed / response_label
    },
  };
}

const practiceFeedback = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: () => {
    const last = jsPsych.data.get().last(1).values()[0];
    if (last.timed_out) return '<p class="fb slow">Too slow &mdash; please respond a little faster.</p>';
    return last.correct
      ? '<p class="fb good">Correct!</p>'
      : '<p class="fb bad">Incorrect</p>';
  },
  choices: "NO_KEYS",
  trial_duration: CONFIG.practice_feedback_ms,
  data: { task: "feedback" },
  show_counter: true,
};

const slowMessage = {
  timeline: [{
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '<p class="fb slow">Please respond a little faster.</p>',
    choices: "NO_KEYS",
    trial_duration: CONFIG.slow_message_ms,
    data: { task: "slow_message" },
    show_counter: true,
  }],
  conditional_function: () => jsPsych.data.get().last(1).values()[0].timed_out === true,
};

// ---------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------

const timeline = [];
const allStimuli = PRACTICE_TRIALS.concat(TEST_TRIALS).map(stimPath);
const volumeSample = STIM_DIR + (CONFIG.volume_sample || PRACTICE_TRIALS[0].Output_wav);

// 1. Preload all sounds
timeline.push({
  type: jsPsychPreload,
  audio: allStimuli.concat([volumeSample]),
  message: "<p>Loading sounds&hellip;</p>",
  show_detailed_errors: true,
  continue_after_error: false,
  max_load_time: 120000,
  error_message: "<p>Some sound files could not be loaded. Please tell the experimenter.</p>",
});

// 2. Read each sound's length (used to time the response window)
timeline.push({
  type: jsPsychCallFunction,
  async: true,
  func: (done) => {
    const paths = Array.from(new Set(allStimuli));
    Promise.all(paths.map((p) =>
      jsPsych.pluginAPI.getAudioBuffer(p)
        .then((buf) => { state.durations[p] = buf.duration; })
        .catch(() => {})
    )).then(() => done());
  },
  data: { task: "setup" },
});

// 3. Participant ID (skipped if ?pid= is in the URL)
timeline.push({
  timeline: [{
    type: jsPsychSurveyHtmlForm,
    preamble: "<p><b>Experimenter:</b> enter the participant ID.</p>",
    html: '<p><input name="pid" type="text" required autofocus style="font-size:20px;width:12em"></p>',
    button_label: "Start",
    data: { task: "participant_id" },
    on_finish: (data) => { state.participant_id = data.response.pid.trim(); },
  }],
  conditional_function: () => !state.participant_id,
});
timeline.push({
  type: jsPsychCallFunction,
  func: () => setKeys(state.participant_id),
  data: { task: "setup" },
});

// 4. Consent (PLACEHOLDER TEXT: replace with your approved consent form)
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="text">
    <h2>Consent to participate</h2>
    <p><i>[PLACEHOLDER: insert the ethics-approved consent text here: study title,
    researcher contact details, what participation involves, risks and benefits,
    confidentiality, voluntary participation and the right to withdraw,
    compensation, and the REB contact.]</i></p>
    <p>By clicking <b>I agree</b>, you confirm that you have read the information
    above and agree to take part.</p>
  </div>`,
  choices: ["I agree", "I do not agree"],
  data: { task: "consent" },
  simulation_options: { data: { response: 0 } }, // simulated runs always agree
  on_finish: (data) => {
    data.consented = data.response === 0;
    if (data.response !== 0) {
      jsPsych.endExperiment('<div class="text"><p>Thank you. You have chosen not to take part, and no data will be used.</p><p>Please let the experimenter know.</p></div>');
    }
  },
});

// 5. Language background questionnaire (edit the questions as needed)
// (skipped in ?simulate runs, because this plugin can't be simulated)
timeline.push({ timeline: [{
  type: jsPsychSurveyHtmlForm,
  preamble: '<h2>About you</h2>',
  html: `<div class="form">
    <label>Age (years)<br><input name="age" type="number" min="18" max="100" required></label>
    <label>Gender (optional)<br><input name="gender" type="text"></label>
    <label>Native language(s)<br><input name="native_languages" type="text" required></label>
    <label>Other languages you speak, with the age you started learning each<br>
      <textarea name="other_languages" rows="3" placeholder="e.g., French, age 8"></textarea></label>
    <label>Have you ever studied or regularly heard Malayalam, Tamil, Hindi, or another South Asian language?<br>
      <select name="south_asian_exposure" required>
        <option value="">Choose&hellip;</option><option>No</option><option>Yes</option>
      </select></label>
    <label>If yes, which language(s), and in what setting?<br><input name="south_asian_details" type="text"></label>
    <label>Do you have any known hearing, speech, or language disorder?<br>
      <select name="hearing_disorder" required>
        <option value="">Choose&hellip;</option><option>No</option><option>Yes</option><option>Prefer not to say</option>
      </select></label>
  </div>`,
  button_label: "Continue",
  data: { task: "questionnaire" },
  on_finish: (data) => {
    for (const [k, v] of Object.entries(data.response)) data["q_" + k] = v;
    delete data.response;
  },
}], conditional_function: () => !SIMULATE });

// 6. Volume setting (loops while the participant presses SPACE)
timeline.push({
  timeline: [{
    type: jsPsychAudioKeyboardResponse,
    stimulus: volumeSample,
    choices: [" ", "enter"],
    response_allowed_while_playing: false,
    prompt: `<div class="text"><h2>Setting the volume</h2>
      <p>Please put on the headphones. You will hear two short words.</p>
      <p>Adjust the volume so the sounds are clear and comfortable.</p>
      <p>Press <b>SPACE</b> to hear them again, or <b>ENTER</b> to continue.</p></div>`,
    data: { task: "volume" },
  }],
  loop_function: (data) => jsPsych.pluginAPI.compareKeys(data.values()[0].response, " "),
});

// 7. Instructions
timeline.push({
  type: jsPsychInstructions,
  pages: () => [
    `<div class="text"><h2>Instructions</h2>
      <p>On each trial you will hear two short made-up words, one after the other.</p>
      <p>Your job is to decide whether they are the <b>same word</b> or <b>different words</b>.</p>
      <p>The speaker said each word several times, so two recordings of the same word
      will not sound exactly identical. Decide whether they are the same <i>word</i>.</p></div>`,
    `<div class="text"><h2>Responding</h2>
      <p>After the second word, press one of these keys:</p>${keyPrompt()}
      <p>Keep your fingers on the F and J keys throughout. Respond as accurately as you
      can, within a few seconds of the second word.</p></div>`,
    `<div class="text"><h2>Practice</h2>
      <p>First you will do a few practice trials. You will be told whether each answer
      was correct.</p><p>Click <b>Next</b> to begin the practice.</p></div>`,
  ],
  show_clickable_nav: true,
  data: { task: "instructions" },
});

// 8. Practice (8 trials, feedback)
timeline.push({
  timeline: [fixation, axTrial("practice"), practiceFeedback],
  timeline_variables: PRACTICE_TRIALS,
  randomize_order: true,
});

timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: () => `<div class="text"><h2>Practice complete</h2>
    <p>Now the main part begins. It works the same way, but you will
    <b>no longer be told</b> whether your answers are correct.</p>
    <p>There are two parts with a short break in between. It takes about 10 minutes.</p>
    ${keyPrompt()}
    <p>Press <b>SPACE</b> when you are ready.</p></div>`,
  choices: [" "],
  data: { task: "instructions" },
});

// 9. Test blocks
const block1 = orderBlock(TEST_TRIALS.filter((t) => t.Block === 1));
const block2 = orderBlock(TEST_TRIALS.filter((t) => t.Block === 2));

function testBlock(trials) {
  return {
    timeline: [fixation, axTrial("test"), slowMessage],
    timeline_variables: trials, // already ordered by orderBlock()
  };
}

timeline.push(testBlock(block1));
timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `<div class="text"><h2>Break</h2>
    <p>You have finished the first part. Take a short rest.</p>
    <p>Press <b>SPACE</b> when you are ready to continue.</p></div>`,
  choices: [" "],
  data: { task: "break" },
});
timeline.push(testBlock(block2));

// 10. Save data
timeline.push({
  type: jsPsychCallFunction,
  async: true,
  func: (done) => { saveData(false).then(() => done()); },
  data: { task: "setup" },
});

// 11. Debrief (PLACEHOLDER TEXT)
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="text"><h2>Thank you!</h2>
    <p><i>[PLACEHOLDER: insert the debriefing text here: the purpose of the study,
    how the tasks relate to it, how data are stored, and contact details for
    questions.]</i></p>
    <p>Your responses have been saved. Please let the experimenter know you have finished.</p></div>`,
  choices: ["Finish"],
  data: { task: "debrief" },
});

// ---------------------------------------------------------------------
// Saving (used at the end, and when the experiment is aborted with Esc)
// ---------------------------------------------------------------------
function saveData(aborted) {
  if (state.saved) return Promise.resolve();
  state.saved = true;

  // Number test trials within each block
  const counts = {};
  jsPsych.data.get().filter({ task: "AX_test" }).values().forEach((t) => {
    counts[t.block] = (counts[t.block] || 0) + 1;
    t.trial_in_block = counts[t.block];
  });
  jsPsych.data.addProperties({ aborted: aborted });

  const pid = state.participant_id || "noID";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `AX_${pid}_${stamp}${aborted ? "_ABORTED" : ""}.csv`;
  const keep = jsPsych.data.get().filterCustom((t) => !["fixation", "feedback", "setup"].includes(t.task));
  const csv = keep.csv();

  if (CONFIG.save_local_csv && SIMULATE !== "data-only") keep.localSave("csv", filename);
  window.__AX_LAST_CSV__ = { filename, csv }; // for testing

  if (!CONFIG.datapipe_experiment_id) return Promise.resolve();
  return fetch("https://pipe.jspsych.org/api/data/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "*/*" },
    body: JSON.stringify({ experimentID: CONFIG.datapipe_experiment_id, filename, data: csv }),
  }).catch(() => {});
}

// ---------------------------------------------------------------------
// Esc aborts the experiment: data so far are saved (file name ends in _ABORTED)
// ---------------------------------------------------------------------
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || state.aborting) return;
  state.aborting = true;
  const ctx = jsPsych.pluginAPI.audioContext();
  if (ctx && ctx.state === "running") ctx.suspend(); // stop any sound
  document.querySelectorAll("audio").forEach((a) => a.pause());
  counterEl.style.display = "none";
  const alreadySaved = state.saved;
  saveData(true).then(() => {
    jsPsych.endExperiment(`<div class="text"><h2>Experiment stopped</h2>
      <p>${alreadySaved ? "The data were already saved." :
        "The responses so far have been saved (the file name ends in _ABORTED)."}</p></div>`);
  });
});

// ---------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------
if (SIMULATE) {
  if (!state.participant_id) state.participant_id = "SIM" + Math.floor(Math.random() * 1000);
  jsPsych.simulate(timeline, SIMULATE);
} else {
  jsPsych.run(timeline);
}
