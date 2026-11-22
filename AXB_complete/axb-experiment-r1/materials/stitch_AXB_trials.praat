# stitch_AXB_trials.praat
# Builds one wav per AXB trial: A + silence (ISI) + X + silence (ISI) + B.
# Reads AXB_trials_for_praat.csv from the script's own folder
# (columns: Trial_ID, Output_wav, A_file, X_file, B_file, ISI_ms).
# Optionally scales every token to the same RMS intensity before stitching.
# Optionally adds background noise (white or speech-shaped) at a chosen SNR.
#
# Put this script, AXB_trials_for_praat.csv and all token wavs in ONE folder.
# Output subfolder:
#   Noise = None  -> "AXB_trials"
#   Noise on      -> e.g. "AXB_trials_white_SNR12" or "AXB_trials_speechshaped_SNR12"
#
# The output folder also gets AXB_timings.csv: when each of the three sounds
# starts and how long it lasts in every trial file. The web experiment uses it
# to light up the matching square while each sound plays, so copy it into the
# experiment's stimuli/ folder together with the wavs.
#
# Noise details (only when Noise is not None):
#   - Noise runs continuously through the whole trial, including both ISIs,
#     starting Pad ms before the first sound and ending Pad ms after the last.
#   - Noise is ramped on and off over Ramp ms.
#   - Noise level = (Target intensity - SNR) dB. Requires Scale intensity on.

form Stitch AXB trials
    boolean Scale_intensity 1
    positive Target_intensity_(dB) 70
    optionmenu Noise 1
        option None
        option White
        option Speech-shaped
    real SNR_(dB) 12
    positive Pad_(ms) 100
    positive Ramp_(ms) 15
endform

addNoise = noise > 1
pad = pad / 1000
ramp = ramp / 1000
if addNoise and not scale_intensity
    exitScript: "Noise needs Scale intensity switched on, so the SNR is defined."
endif
lead = 0
if addNoise
    lead = pad
endif

token_folder$ = defaultDirectory$
trial_list$ = token_folder$ + "/AXB_trials_for_praat.csv"
if not fileReadable (trial_list$)
    exitScript: "Cannot find AXB_trials_for_praat.csv in ", token_folder$
endif
if noise = 1
    output_folder$ = token_folder$ + "/AXB_trials"
elsif noise = 2
    output_folder$ = token_folder$ + "/AXB_trials_white_SNR" + fixed$ (sNR, 0)
else
    output_folder$ = token_folder$ + "/AXB_trials_speechshaped_SNR" + fixed$ (sNR, 0)
endif
createDirectory: output_folder$

table = Read Table from comma-separated file: trial_list$
nTrials = Get number of rows
timings = Create Table with column names: "timings", nTrials, "Output_wav A_onset_ms A_dur_ms X_onset_ms X_dur_ms B_onset_ms B_dur_ms Total_ms"
nClipped = 0
clippedList$ = ""

if noise = 3
    @makeSpeechShapedNoise
    longNoise = makeSpeechShapedNoise.id
    longNoiseDur = makeSpeechShapedNoise.dur
endif

for i to nTrials
    selectObject: table
    trialID$ = Get value: i, "Trial_ID"
    out$ = Get value: i, "Output_wav"
    fileA$ = Get value: i, "A_file"
    fileX$ = Get value: i, "X_file"
    fileB$ = Get value: i, "B_file"
    isi = Get value: i, "ISI_ms"
    isi = isi / 1000

    # Objects are created in playing order, because Concatenate follows list order.
    @loadToken: fileA$
    soundA = loadToken.id
    sr = Get sampling frequency
    durA = Get total duration
    if addNoise
        # lead-in pad, then a copy of A so that A comes after the pad in the list
        padA = Create Sound from formula: "padA", 1, 0, pad, sr, "0"
        selectObject: soundA
        copyA = Copy: "A"
        removeObject: soundA
        soundA = copyA
    endif
    silence1 = Create Sound from formula: "isi1", 1, 0, isi, sr, "0"
    @loadToken: fileX$
    soundX = loadToken.id
    srX = Get sampling frequency
    durX = Get total duration
    silence2 = Create Sound from formula: "isi2", 1, 0, isi, sr, "0"
    @loadToken: fileB$
    soundB = loadToken.id
    srB = Get sampling frequency
    durB = Get total duration
    if srX <> sr or srB <> sr
        exitScript: "Sampling rates differ in trial ", trialID$, "."
    endif

    if addNoise
        padB = Create Sound from formula: "padB", 1, 0, pad, sr, "0"
        selectObject: padA, soundA, silence1, soundX, silence2, soundB, padB
    else
        selectObject: soundA, silence1, soundX, silence2, soundB
    endif
    trial = Concatenate
    total = Get total duration

    if addNoise
        if noise = 2
            noiseObj = Create Sound from formula: "noise", 1, 0, total, sr, "randomGauss (0, 1)"
        else
            start = randomUniform (0, longNoiseDur - total)
            selectObject: longNoise
            noiseObj = Extract part: start, start + total, "rectangular", 1, "no"
        endif
        Scale intensity: target_intensity - sNR
        Formula: "if x < 'ramp' then self * x / 'ramp' else if x > xmax - 'ramp' then self * (xmax - x) / 'ramp' else self fi fi"
        selectObject: trial
        Formula: "self + object [noiseObj, col]"
        removeObject: noiseObj
    endif

    # Timings (ms) of the three sounds within the trial file
    onsetA = lead
    onsetX = lead + durA + isi
    onsetB = onsetX + durX + isi
    selectObject: timings
    Set string value: i, "Output_wav", out$
    Set numeric value: i, "A_onset_ms", round (onsetA * 1000)
    Set numeric value: i, "A_dur_ms", round (durA * 1000)
    Set numeric value: i, "X_onset_ms", round (onsetX * 1000)
    Set numeric value: i, "X_dur_ms", round (durX * 1000)
    Set numeric value: i, "B_onset_ms", round (onsetB * 1000)
    Set numeric value: i, "B_dur_ms", round (durB * 1000)
    Set numeric value: i, "Total_ms", round (total * 1000)

    selectObject: trial
    peak = Get absolute extremum: 0, 0, "None"
    if peak >= 1
        nClipped += 1
        clippedList$ = clippedList$ + out$ + newline$
    endif
    Save as WAV file: output_folder$ + "/" + out$
    removeObject: soundA, silence1, soundX, silence2, soundB, trial
    if addNoise
        removeObject: padA, padB
    endif
endfor

selectObject: timings
Save as comma-separated file: output_folder$ + "/AXB_timings.csv"
removeObject: table, timings
if noise = 3
    removeObject: longNoise
endif
writeInfoLine: "Done: ", nTrials, " trial files written to ", output_folder$
appendInfoLine: "Also written: AXB_timings.csv (copy it into the experiment's stimuli folder with the wavs)."
if addNoise
    appendInfoLine: "Noise: ", noise$, " at SNR ", sNR, " dB (noise level ", target_intensity - sNR, " dB), pad ", pad * 1000, " ms, ramp ", ramp * 1000, " ms."
endif
if nClipped > 0
    appendInfoLine: newline$, "WARNING: ", nClipped, " trials clip (peak >= 1). Lower Target intensity and rerun:"
    appendInfoLine: clippedList$
else
    appendInfoLine: "No clipping detected."
endif

procedure loadToken: .file$
    .path$ = token_folder$ + "/" + .file$
    if not fileReadable (.path$)
        exitScript: "Cannot find token file: ", .path$
    endif
    .raw = Read from file: .path$
    .nch = Get number of channels
    if .nch > 1
        .id = Convert to mono
        removeObject: .raw
    else
        .id = .raw
    endif
    selectObject: .id
    if scale_intensity
        Scale intensity: target_intensity
    endif
endproc

procedure makeSpeechShapedNoise
    # Collect every token named in the trial list (each once), scaled like the stimuli
    selectObject: table
    .nRows = Get number of rows
    .seen$ = "|"
    .nTok = 0
    for .r to .nRows
        for .c to 3
            selectObject: table
            if .c = 1
                .f$ = Get value: .r, "A_file"
            elsif .c = 2
                .f$ = Get value: .r, "X_file"
            else
                .f$ = Get value: .r, "B_file"
            endif
            if index (.seen$, "|" + .f$ + "|") = 0
                .seen$ = .seen$ + .f$ + "|"
                @loadToken: .f$
                .nTok += 1
                .tok [.nTok] = loadToken.id
            endif
        endfor
    endfor
    selectObject: .tok [1]
    for .k from 2 to .nTok
        plusObject: .tok [.k]
    endfor
    .speech = Concatenate
    for .k to .nTok
        removeObject: .tok [.k]
    endfor
    selectObject: .speech
    .sr = Get sampling frequency
    .dur = Get total duration
    .spec = To Spectrum: "yes"
    .smooth = Cepstral smoothing: 500
    .white = Create Sound from formula: "white", 1, 0, .dur, .sr, "randomGauss (0, 1)"
    .noiseSpec = To Spectrum: "yes"
    Formula: "self * sqrt (object [.smooth, 1, col] ^ 2 + object [.smooth, 2, col] ^ 2)"
    .shaped = To Sound
    .id = Extract part: 0, .dur, "rectangular", 1, "no"
    Rename: "speechShapedNoise"
    removeObject: .speech, .spec, .smooth, .white, .noiseSpec, .shaped
endproc
