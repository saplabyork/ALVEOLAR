// =====================================================================
// AXB triad categorization experiment, version r1: /aː/ only (jsPsych 7.3.4)
// Listeners hear three sounds (A, X, B) and judge whether the middle one (X)
// is more similar to the first (F key) or the last (J key).
//
// Timeline: preload -> participant ID -> consent -> language questionnaire
// -> volume setting -> instructions -> 8 practice trials (feedback)
// -> 2 test blocks of 40 trials (break between) -> save data -> debrief
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
const TIMINGS_FILE = STIM_DIR + "AXB_timings.csv"; // written by stitch_AXB_trials.praat
const DEFAULT_DURATION_S = 5.0; // used only if a sound's length can't be read
const VERSION = "axb-r1";
const KEY_FIRST = "f";
const KEY_LAST = "j";

const state = {
  participant_id: urlParams.get("pid") || null,
  durations: {},   // stimulus path -> duration in seconds
  timings: {},     // Output_wav -> {A:[onset,dur], X:[...], B:[...]} in ms
  saved: false,
  saved_filename: null,
  uploadStatus: "not used", // "not used" | "sending" | "ok" | "failed" (Drive relay)
  queue: [], current: null, blockTotal: 0, blockDone: 0, // block runner
  highlightTimers: [],
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

// Countdown clock in the upper-right corner (response window only)
const clockEl = document.createElement("div");
clockEl.id = "countdown";
clockEl.style.display = "none";
document.documentElement.appendChild(clockEl);
let clockTimer = null;
function startClock(soundMs) {
  stopClock();
  const t0 = performance.now();
  const tick = () => {
    const elapsed = performance.now() - t0;
    if (elapsed < soundMs) { clockEl.style.display = "none"; return; }
    const left = Math.max(0, soundMs + CONFIG.response_window_ms - elapsed);
    clockEl.textContent = Math.ceil(left / 1000);
    clockEl.style.display = "block";
  };
  tick();
  clockTimer = setInterval(tick, 50);
}
function stopClock() {
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = null;
  clockEl.style.display = "none";
}

// ---------------------------------------------------------------------
// Trial screen: three squares, arrows from the middle one, question marks
// ---------------------------------------------------------------------
const arrowSvg = (dir) => `<svg class="axb-arrow" viewBox="0 0 90 24" aria-hidden="true">
    ${dir === "left"
      ? '<line x1="86" y1="12" x2="10" y2="12"/><polyline points="20,3 6,12 20,21"/>'
      : '<line x1="4" y1="12" x2="80" y2="12"/><polyline points="70,3 84,12 70,21"/>'}
  </svg>`;

function trialScreen() {
  return `<div class="axb">
    <p class="axb-question">Is the <b>middle</b> sound more like the <b>first</b> or the <b>last</b>?</p>
    <div class="axb-row">
      <div class="axb-col"><div class="axb-square" id="sq-A"></div><div class="axb-label">first</div><div class="axb-key">F</div></div>
      <div class="axb-link"><div class="axb-q">?</div>${arrowSvg("left")}</div>
      <div class="axb-col"><div class="axb-square axb-middle" id="sq-X"></div><div class="axb-label">middle</div><div class="axb-key axb-key-blank">&nbsp;</div></div>
      <div class="axb-link"><div class="axb-q">?</div>${arrowSvg("right")}</div>
      <div class="axb-col"><div class="axb-square" id="sq-B"></div><div class="axb-label">last</div><div class="axb-key">J</div></div>
    </div>
  </div>`;
}

// Light up each square while its sound plays (needs AXB_timings.csv)
function startHighlights(outputWav) {
  stopHighlights();
  const t = state.timings[outputWav];
  if (!t) return;
  for (const pos of ["A", "X", "B"]) {
    const [onset, dur] = t[pos];
    state.highlightTimers.push(setTimeout(() => {
      const el = document.getElementById("sq-" + pos); if (el) el.classList.add("playing");
    }, onset));
    state.highlightTimers.push(setTimeout(() => {
      const el = document.getElementById("sq-" + pos); if (el) el.classList.remove("playing");
    }, onset + dur));
  }
}
function stopHighlights() {
  state.highlightTimers.forEach(clearTimeout);
  state.highlightTimers = [];
}

// ---------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------
const tokensOf = (t) => [t.A_file, t.X_file, t.B_file];
const sharesToken = (a, b) => tokensOf(a).some((f) => tokensOf(b).includes(f));

// Order one block's trials so that
//   - consecutive trials never share a recording, and
//   - no more than 3 trials in a row have the same order (e.g. DEN-ALV-RET).
function orderBlock(trials) {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const pool = jsPsych.randomization.shuffle(trials.slice());
    const seq = [];
    let ok = true;
    while (pool.length) {
      const prev = seq[seq.length - 1];
      const run = seq.slice(-3);
      const idx = pool.findIndex((t) => {
        if (prev && sharesToken(prev, t)) return false;
        if (run.length === 3 && run.every((r) => r.Order === t.Order)) return false;
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

// Each block runs from a queue. A trial that times out is put back at the end
// of the queue, so it is repeated at the end of the same block (up to
// CONFIG.max_repeats extra times per trial).
const cur = () => state.current;
function nextFromQueue(prev) {
  let idx = state.queue.findIndex((t) => !prev || !sharesToken(prev, t));
  if (idx === -1) idx = 0;
  return state.queue.splice(idx, 1)[0] || null;
}

const stimPath = (trial) => STIM_DIR + trial.Output_wav;
const soundMs = (wav) => Math.round((state.durations[STIM_DIR + wav] || DEFAULT_DURATION_S) * 1000);

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
    // Each trial starts with a fixation cross, so advance the counter here.
    // The total grows if timed-out trials are added back to the block.
    state.blockDone += 1;
    counterEl.textContent = state.blockDone + "/" + state.blockTotal;
  },
};

function axbTrial(phase) {
  return {
    type: jsPsychAudioKeyboardResponse,
    stimulus: () => STIM_DIR + cur().Output_wav,
    choices: [KEY_FIRST, KEY_LAST],
    prompt: () => trialScreen(),
    response_allowed_while_playing: false,
    trial_ends_after_audio: false,
    show_counter: true,
    trial_duration: () => soundMs(cur().Output_wav) + CONFIG.response_window_ms,
    post_trial_gap: phase === "test" ? CONFIG.iti_ms : 0,
    data: () => ({
      task: phase === "test" ? "AXB_test" : "AXB_practice",
      block: cur().Block,
      Trial_ID: cur().Trial_ID,
      Trial_name: cur().Trial_name,
      Output_wav: cur().Output_wav,
      Trial_type: cur().Trial_type,       // Critical / Anchor / Catch
      Order: cur().Order,                 // e.g. DEN-ALV-RET (A-X-B)
      V1: cur().V1,
      A_file: cur().A_file, X_file: cur().X_file, B_file: cur().B_file,
      A_cat: cur().A_cat, X_cat: cur().X_cat, B_cat: cur().B_cat,
      correct_response: cur().Correct_response, // first / last / none
      attempt: cur().attempt,             // 1 = first presentation, 2+ = repeat after a timeout
      is_repeat: cur().attempt > 1,
    }),
    on_load: () => {
      startClock(soundMs(cur().Output_wav));
      startHighlights(cur().Output_wav);
    },
    on_finish: (data) => {
      stopClock();
      stopHighlights();
      const durMs = soundMs(data.Output_wav);
      data.stim_duration_ms = durMs;
      data.timed_out = data.response === null;
      data.key_pressed = data.response;
      if (data.response === null) {
        data.response_label = null; data.chosen_cat = null; data.chosen_file = null; data.chose_first = null;
      } else {
        const first = jsPsych.pluginAPI.compareKeys(data.response, KEY_FIRST);
        data.response_label = first ? "first" : "last";
        data.chose_first = first;
        data.chosen_cat = first ? data.A_cat : data.B_cat;
        data.chosen_file = first ? data.A_file : data.B_file;
      }
      // Correct only exists for catch/practice trials (X matches one side)
      data.correct = data.correct_response === "none" ? null
        : (data.response_label === data.correct_response);
      // Critical trials: 1 = grouped the alveolar with the dental, 0 = with the retroflex
      data.chose_dental = (data.Trial_type === "Critical" && data.chosen_cat)
        ? (data.chosen_cat === "DEN" ? 1 : 0) : null;
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
  audio: Array.from(new Set(allStimuli.concat([volumeSample]))),
  message: "<p>Loading sounds&hellip;</p>",
  show_detailed_errors: true,
  continue_after_error: false,
  max_load_time: 120000,
  error_message: "<p>Some sound files could not be loaded. Please tell the experimenter.</p>",
});

// 2. Read each sound's length, and the timings of the three sounds in each file
timeline.push({
  type: jsPsychCallFunction,
  async: true,
  func: (done) => {
    const paths = Array.from(new Set(allStimuli));
    const lengths = Promise.all(paths.map((p) =>
      jsPsych.pluginAPI.getAudioBuffer(p)
        .then((buf) => { state.durations[p] = buf.duration; })
        .catch(() => {})
    ));
    const timings = fetch(TIMINGS_FILE)
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return;
        const h = lines[0].split(",").map((s) => s.replace(/"/g, ""));
        const col = (name) => h.indexOf(name);
        for (const line of lines.slice(1)) {
          const v = line.split(",").map((s) => s.replace(/"/g, ""));
          state.timings[v[col("Output_wav")]] = {
            A: [Number(v[col("A_onset_ms")]), Number(v[col("A_dur_ms")])],
            X: [Number(v[col("X_onset_ms")]), Number(v[col("X_dur_ms")])],
            B: [Number(v[col("B_onset_ms")]), Number(v[col("B_dur_ms")])],
          };
        }
      })
      .catch(() => {});
    Promise.all([lengths, timings]).then(() => done());
  },
  data: { task: "setup" },
});

// 3. Participant ID (skipped if ?pid= is in the URL)
timeline.push({
  timeline: [{
    type: jsPsychSurveyHtmlForm,
    preamble: "<p>Please enter your initials (in caps) followed by the month (MM) and year (YYYY) of your birth (e.g., MG012006 for MG, January 2006).</p>",
    html: '<p><input name="pid" type="text" required autofocus style="font-size:20px;width:12em"></p>',
    button_label: "Start",
    data: { task: "participant_id" },
    on_finish: (data) => { state.participant_id = data.response.pid.trim(); },
  }],
  conditional_function: () => !state.participant_id,
});
timeline.push({
  type: jsPsychCallFunction,
  func: () => jsPsych.data.addProperties({
    experiment_version: VERSION,
    participant_id: state.participant_id,
    key_first: KEY_FIRST.toUpperCase(),
    key_last: KEY_LAST.toUpperCase(),
  }),
  data: { task: "setup" },
});

// 4. Consent
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div class="text">
    <h2>Consent to participate</h2>
    <p>Before commencing with the study, you will be asked to fill out a brief
    language-background questionnaire. We will then proceed with the listening
    experiment. You can withdraw at any point during the task by pressing the
    'ESC' key.</p>
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

// 5. Language background questionnaire (same as AX r1)
// Coded columns in the data:
//   q_born_in_canada: 1 = born in Canada, 0 = not born in Canada
//   q_home_language:  0 = English only, 1 = English and another language
//   q_home_language_other: the other language(s), typed (empty if English only)
// (skipped in ?simulate runs, because this plugin can't be simulated)
timeline.push({ timeline: [{
  type: jsPsychSurveyHtmlForm,
  preamble: '<h2>About you</h2>',
  html: `<div class="form">
    <label>Gender<br><input name="gender" type="text"></label>
    <label>Age (years)<br><input name="age" type="number" min="18" max="100" required></label>
    <label>Were you born in Canada?<br>
      <select name="born_in_canada" required>
        <option value="">Choose&hellip;</option>
        <option value="1">Yes, I was born in Canada</option>
        <option value="0">No, I was not born in Canada</option>
      </select></label>
    <label>Which language(s) are spoken at home?<br>
      <select name="home_language" id="home_language" required>
        <option value="">Choose&hellip;</option>
        <option value="0">English only</option>
        <option value="1">English and another language</option>
      </select></label>
    <label id="other_language_label" style="opacity:0.45">If English and another language: which other language(s)?<br>
      <input name="home_language_other" id="home_language_other" type="text" disabled></label>
  </div>`,
  button_label: "Continue",
  data: { task: "questionnaire" },
  on_load: () => {
    const sel = document.getElementById("home_language");
    const box = document.getElementById("home_language_other");
    const lab = document.getElementById("other_language_label");
    sel.addEventListener("change", () => {
      const other = sel.value === "1";
      box.disabled = !other; box.required = other;
      lab.style.opacity = other ? "1" : "0.45";
      if (!other) box.value = "";
    });
  },
  on_finish: (data) => {
    const r = data.response;
    data.q_gender = r.gender || "";
    data.q_age = r.age === "" ? null : Number(r.age);
    data.q_born_in_canada = Number(r.born_in_canada);
    data.q_home_language = Number(r.home_language);
    data.q_home_language_other = r.home_language_other || "";
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
      <p>Please put on the headphones. You will hear three short words.</p>
      <p>Adjust the volume so the sounds are clear and comfortable.</p>
      <p>Press <b>SPACE</b> to hear them again, or <b>ENTER</b> to continue.</p></div>`,
    data: { task: "volume" },
  }],
  loop_function: (data) => jsPsych.pluginAPI.compareKeys(data.values()[0].response, " "),
});

// 7. Instructions
timeline.push({
  type: jsPsychInstructions,
  pages: [
    `<div class="text"><h2>Instructions</h2>
      <p>On each trial you will hear three short words from a <u>made-up language</u>, one after the other.</p>
      <p>Your job is to decide whether you think the <b>middle</b> word sounds more like the
      <b>first</b> word or the <b>last</b> word.</p>
      <p>The speaker said each word several times, so <u>no two recordings will sound exactly
      identical</u>. Decide which <i>word</i> the middle one sounds more like.</p>
      <p>The three squares on the screen stand for the three words, and each square
      lights up while its word plays.</p></div>`,
    `<div class="text"><h2>Responding</h2>
      <p>After the third word, press:</p>
      <div class="keys">
        <div class="keybox"><span class="key">F</span><br>middle is more like the FIRST</div>
        <div class="keybox"><span class="key">J</span><br>middle is more like the LAST</div>
      </div>
      <p>Keep your fingers on the F and J keys throughout. You can respond only after the
      third word has finished, and you then have <b>${CONFIG.response_window_ms / 1000} seconds</b>
      to answer. <u>Please respond as fast as you can!</u> A countdown in the top-right corner shows the time left.</p>
      <p>If you don't answer in time, that trial will come back later in the same part.
      Go with your first impression.</p></div>`,
    `<div class="text"><h2>There are no wrong answers</h2>
      <p>In the main part, the three words will often all be slightly different, and
      there is <b>no right or wrong answer</b>. We are interested in what <i>you</i> hear.
      Go with your first impression.</p>
      <p>First you will do a few practice trials with an easy answer, so you can get used
      to the task. You will be told whether each answer was correct.</p>
      <p>Click <b>Next</b> to begin the practice.</p></div>`,
  ],
  show_clickable_nav: true,
  data: { task: "instructions" },
});

// Runs one block: trials in the given order, then any timed-out trials again.
function runBlock(phase, trials) {
  const afterTrial = phase === "test" ? slowMessage : practiceFeedback;
  return [
    {
      type: jsPsychCallFunction,
      func: () => {
        state.queue = trials.map((t) => Object.assign({}, t, { attempt: 1 }));
        state.blockTotal = state.queue.length;
        state.blockDone = 0;
        state.current = state.queue.shift();
      },
      data: { task: "setup" },
    },
    {
      timeline: [fixation, axbTrial(phase), afterTrial],
      loop_function: () => {
        const last = jsPsych.data.get().filterCustom((t) => t.task === "AXB_test" || t.task === "AXB_practice").last(1).values()[0];
        if (last && last.timed_out && state.current.attempt <= CONFIG.max_repeats) {
          state.queue.push(Object.assign({}, state.current, { attempt: state.current.attempt + 1 }));
          state.blockTotal += 1;
        }
        state.current = nextFromQueue(state.current);
        return state.current !== null;
      },
    },
  ];
}

// 8. Practice (8 trials, feedback)
timeline.push(...runBlock("practice", jsPsych.randomization.shuffle(PRACTICE_TRIALS.slice())));

timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `<div class="text"><h2>Practice complete</h2>
    <p>Now the main part begins. It works the same way, but you will
    <b>no longer be told</b> whether your answers are correct, and most trials have
    no right or wrong answer. Go with your first impression.</p>
    <p>There are two parts with a short break in between. It takes about 10 minutes.</p>
    <p>Remember: you have <b>${CONFIG.response_window_ms / 1000} seconds</b> to answer after the third word.</p>
    <div class="keys">
      <div class="keybox"><span class="key">F</span><br>more like the FIRST</div>
      <div class="keybox"><span class="key">J</span><br>more like the LAST</div>
    </div>
    <p>Press <b>SPACE</b> when you are ready.</p></div>`,
  choices: [" "],
  data: { task: "instructions" },
});

// 9. Test blocks
const block1 = orderBlock(TEST_TRIALS.filter((t) => t.Block === 1));
const block2 = orderBlock(TEST_TRIALS.filter((t) => t.Block === 2));
timeline.push(...runBlock("test", block1));
timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `<div class="text"><h2>Break</h2>
    <p>You have finished the first part. Take a short rest.</p>
    <p>Press <b>SPACE</b> when you are ready to continue.</p></div>`,
  choices: [" "],
  data: { task: "break" },
});
timeline.push(...runBlock("test", block2));

// 10. Save data
timeline.push({
  type: jsPsychCallFunction,
  async: true,
  func: (done) => { saveData(false).then(() => done()); },
  data: { task: "setup" },
});

// 11. Debrief
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: () => `<div class="text"><h2>Thank you!</h2>
    <p><i>Thank you for participating in this experiment and helping us learn about how people hear speech sounds.</i></p>
    ${saveStatusHtml()}
    <p>Please let the experimenter know you have finished.</p></div>`,
  choices: ["Finish"],
  data: { task: "debrief" },
});

// ---------------------------------------------------------------------
// Saving (used at the end, and when the experiment is aborted with Esc)
// ---------------------------------------------------------------------
function saveData(aborted) {
  if (state.saved) return Promise.resolve();
  state.saved = true;

  const counts = {};
  jsPsych.data.get().filter({ task: "AXB_test" }).values().forEach((t) => {
    counts[t.block] = (counts[t.block] || 0) + 1;
    t.trial_in_block = counts[t.block];
  });
  jsPsych.data.addProperties({ aborted: aborted });

  const pid = state.participant_id || "noID";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `AXB_r1_${pid}_${stamp}${aborted ? "_ABORTED" : ""}.csv`;
  const keep = jsPsych.data.get().filterCustom((t) => !["fixation", "feedback", "setup"].includes(t.task));
  const csv = keep.csv();

  // Local download: always if save_local_csv is on, or if there is no Drive upload set up
  if ((CONFIG.save_local_csv || !CONFIG.upload_endpoint) && SIMULATE !== "data-only") keep.localSave("csv", filename);
  window.__AX_LAST_CSV__ = { filename, csv }; // for testing

  state.saved_filename = filename;
  const uploads = [];
  if (CONFIG.upload_endpoint) {
    state.uploadStatus = "sending";
    uploads.push(driveUpload(filename, csv, aborted).then((ok) => {
      state.uploadStatus = ok ? "ok" : "failed";
      // Backup: if the upload failed and no local copy was saved, save one now
      if (!ok && !CONFIG.save_local_csv && SIMULATE !== "data-only") keep.localSave("csv", filename);
    }));
  }
  if (CONFIG.datapipe_experiment_id) {
    uploads.push(fetch("https://pipe.jspsych.org/api/data/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify({ experimentID: CONFIG.datapipe_experiment_id, filename, data: csv }),
    }).catch(() => {}));
  }
  return Promise.all(uploads);
}

// Send the CSV to the Google Apps Script relay, which saves it to Google
// Drive. Tries up to 3 times; resolves true on success.
function driveUpload(filename, csv, aborted) {
  const payload = JSON.stringify({
    key: CONFIG.upload_key,
    filename: filename,
    csv: csv,
    participant_id: state.participant_id || "noID",
    experiment_version: VERSION,
    aborted: aborted,
  });
  const attempt = (n) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    // text/plain keeps this a "simple" request, which Apps Script accepts
    return fetch(CONFIG.upload_endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: payload,
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((j) => { clearTimeout(timer); if (!j.ok) throw new Error(j.error || "rejected"); return true; })
      .catch((err) => {
        clearTimeout(timer);
        console.warn("Upload attempt " + n + " failed:", err.message);
        if (n >= 3) return false;
        return new Promise((res) => setTimeout(res, 2000)).then(() => attempt(n + 1));
      });
  };
  return attempt(1);
}

// One line for the end screens about where the data went
function saveStatusHtml() {
  if (state.uploadStatus === "failed") {
    return `<p style="color:#c62828"><b>Note for the experimenter:</b> the data could not be sent
      automatically. A copy was saved on this computer as <code>${state.saved_filename}</code>
      (usually in the Downloads folder). Please send that file to the researcher.</p>`;
  }
  return "<p>Your responses have been saved.</p>";
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
  stopClock();
  stopHighlights();
  const alreadySaved = state.saved;
  saveData(true).then(() => {
    jsPsych.endExperiment(`<div class="text"><h2>Experiment stopped</h2>
      ${alreadySaved ? "<p>The data were already saved.</p>" :
        "<p>The responses so far have been saved (the file name ends in _ABORTED).</p>" +
        (state.uploadStatus === "failed" ? saveStatusHtml() : "")}</div>`);
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
