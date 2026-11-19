# stitch_AX_trials.praat
# Builds one wav per AX trial: Token1 + silence (ISI) + Token2.
# Reads AX_trials_for_praat.csv from the script's own folder (columns: Trial_ID, Output_wav, Token1_file, Token2_file, ISI_ms).
# Optionally scales every token to the same RMS intensity before stitching.
# Optionally adds background noise (white or speech-shaped) at a chosen SNR.
#
# Put this script, AX_trials_for_praat.csv and all token wavs in ONE folder.
# Output subfolder:
#   Noise = None  -> "AX_trials"
#   Noise on      -> e.g. "AX_trials_white_SNR12" or "AX_trials_speechshaped_SNR12"
#
# Noise details (only when Noise is not None):
#   - Noise runs continuously through the whole trial, including the ISI,
#     starting Pad ms before the first sound and ending Pad ms after the second.
#   - Noise is ramped on and off over Ramp ms.
#   - Noise level = (Target intensity - SNR) dB, i.e. SNR is relative to the
#     tokens' RMS level. Requires Scale intensity to be on.
#   - White: a fresh Gaussian noise sample for every trial.
#   - Speech-shaped: noise filtered to the smoothed long-term spectrum of all
#     tokens in the trial list; each trial uses a different random stretch.

form Stitch AX trials
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

token_folder$ = defaultDirectory$
trial_list$ = token_folder$ + "/AX_trials_for_praat.csv"
if not fileReadable (trial_list$)
    exitScript: "Cannot find AX_trials_for_praat.csv in ", token_folder$
endif
if noise = 1
    output_folder$ = token_folder$ + "/AX_trials"
elsif noise = 2
    output_folder$ = token_folder$ + "/AX_trials_white_SNR" + fixed$ (sNR, 0)
else
    output_folder$ = token_folder$ + "/AX_trials_speechshaped_SNR" + fixed$ (sNR, 0)
endif
createDirectory: output_folder$

table = Read Table from comma-separated file: trial_list$
nTrials = Get number of rows
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
    file1$ = Get value: i, "Token1_file"
    file2$ = Get value: i, "Token2_file"
    isi = Get value: i, "ISI_ms"
    isi = isi / 1000

    # Objects are created in playing order, because Concatenate follows list order.
    # First token
    @loadToken: file1$
    sound1 = loadToken.id
    sr1 = Get sampling frequency

    # Lead-in silence (noise versions only)
    if addNoise
        padA = Create Sound from formula: "padA", 1, 0, pad, sr1, "0"
        # Move the first token after the pad by copying it
        selectObject: sound1
        sound1copy = Copy: "token1"
        removeObject: sound1
        sound1 = sound1copy
    endif

    # ISI silence
    silence = Create Sound from formula: "silence", 1, 0, isi, sr1, "0"

    # Second token
    @loadToken: file2$
    sound2 = loadToken.id
    sr2 = Get sampling frequency
    if sr1 <> sr2
        exitScript: "Sampling rates differ in trial ", trialID$, ": ", file1$, " (", sr1, " Hz) vs ", file2$, " (", sr2, " Hz)."
    endif

    if addNoise
        padB = Create Sound from formula: "padB", 1, 0, pad, sr1, "0"
        selectObject: padA, sound1, silence, sound2, padB
    else
        selectObject: sound1, silence, sound2
    endif
    trial = Concatenate

    if addNoise
        selectObject: trial
        dur = Get total duration
        if noise = 2
            noiseObj = Create Sound from formula: "noise", 1, 0, dur, sr1, "randomGauss (0, 1)"
        else
            start = randomUniform (0, longNoiseDur - dur)
            selectObject: longNoise
            noiseObj = Extract part: start, start + dur, "rectangular", 1, "no"
        endif
        Scale intensity: target_intensity - sNR
        Formula: "if x < 'ramp' then self * x / 'ramp' else if x > xmax - 'ramp' then self * (xmax - x) / 'ramp' else self fi fi"
        selectObject: trial
        Formula: "self + object [noiseObj, col]"
        removeObject: noiseObj
    endif

    selectObject: trial
    peak = Get absolute extremum: 0, 0, "None"
    if peak >= 1
        nClipped += 1
        clippedList$ = clippedList$ + out$ + newline$
    endif
    Save as WAV file: output_folder$ + "/" + out$
    removeObject: sound1, silence, sound2, trial
    if addNoise
        removeObject: padA, padB
    endif
endfor

removeObject: table
if noise = 3
    removeObject: longNoise
endif
writeInfoLine: "Done: ", nTrials, " trial files written to ", output_folder$
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
        for .c to 2
            selectObject: table
            .f$ = Get value: .r, "Token" + string$ (.c) + "_file"
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
    # Smoothed long-term spectrum of the speech
    .spec = To Spectrum: "yes"
    .smooth = Cepstral smoothing: 500
    # White noise of the same length, shaped by the speech spectrum's magnitude
    .white = Create Sound from formula: "white", 1, 0, .dur, .sr, "randomGauss (0, 1)"
    .noiseSpec = To Spectrum: "yes"
    Formula: "self * sqrt (object [.smooth, 1, col] ^ 2 + object [.smooth, 2, col] ^ 2)"
    .shaped = To Sound
    .id = Extract part: 0, .dur, "rectangular", 1, "no"
    Rename: "speechShapedNoise"
    removeObject: .speech, .spec, .smooth, .white, .noiseSpec, .shaped
endproc
