/* Poké Ball Catch Challenge — pure experiment logic (no DOM). Used by the browser pages and by the Node test suite. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PBCC_CORE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CANVAS_W = 358, CANVAS_H = 417;
  var EXPERIMENT = { version: 'v3b-skyblue-gaze-instructions', ball_color: '#87C9EF', label: 'Version 3B (sky-blue ball #87C9EF, gaze-attention instructions)' };

  // Researcher-facing condition metadata (never rendered on the participant page).
  var CONDITIONS = {
    1: { label: 'Real Throw', short: 'C1 Real throw', file: 'condition_1_real_throw_skyblue.gif', color: '#2f6fd6' },
    2: { label: 'Vanish + Upward Gaze', short: 'C2 Upward gaze', file: 'condition_2_vanish_upward_gaze_skyblue.gif', color: '#e8590c' },
    3: { label: 'Vanish + Hand Gaze', short: 'C3 Hand gaze', file: 'condition_3_vanish_hand_gaze_skyblue.gif', color: '#2b8a3e' }
  };
  var ALLOCATION = { 1: 4, 2: 3, 3: 3 };

  // ---------- random numbers ----------
  function makeRng(seed) {
    if (seed === undefined || seed === null) {
      return function () {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296;
        }
        return Math.random();
      };
    }
    var s = seed >>> 0;                     // mulberry32 (deterministic, for tests only)
    return function () {
      s += 0x6D2B79F5; var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function maxRun(seq) {
    var best = 0, run = 0;
    for (var i = 0; i < seq.length; i++) { run = (i > 0 && seq[i] === seq[i - 1]) ? run + 1 : 1; if (run > best) best = run; }
    return best;
  }
  // 4/3/3 randomised order with no run of 3+ identical conditions (rejection sampling: unbiased among valid orders).
  function makeTrialOrder(rng, allocation) {
    rng = rng || makeRng(); allocation = allocation || ALLOCATION;
    var pool = [];
    Object.keys(allocation).forEach(function (c) { for (var k = 0; k < allocation[c]; k++) pool.push(Number(c)); });
    for (var attempt = 0; attempt < 10000; attempt++) {
      var seq = shuffle(pool, rng);
      if (maxRun(seq) < 3) return seq;
    }
    return shuffle(pool, rng);  // practically unreachable
  }

  // ---------- coordinates ----------
  // Convert a click on the displayed (scaled) image into ORIGINAL 358 x 417 canvas coordinates.
  function clientToCanvas(clientX, clientY, rect) {
    var x = (clientX - rect.left) / rect.width * CANVAS_W;
    var y = (clientY - rect.top) / rect.height * CANVAS_H;
    x = Math.min(CANVAS_W, Math.max(0, x)); y = Math.min(CANVAS_H, Math.max(0, y));
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }
  function canvasToDisplay(x, y, rect) { return { left: x / CANVAS_W * rect.width, top: y / CANVAS_H * rect.height }; }

  // ---------- analysis ----------
  // stim: { vanish_last_visible_xy:[x,y], real_throw_highest_visible_xy:[x,y] }
  function referenceFor(condition, stim) {
    if (Number(condition) === 1) return { type: 'real throw: highest visible ball position (frame ' + stim.real_throw_highest_visible_frame + ')', x: stim.real_throw_highest_visible_xy[0], y: stim.real_throw_highest_visible_xy[1] };
    return { type: 'vanish: last visible ball position (frame ' + stim.last_visible_frame + ')', x: stim.vanish_last_visible_xy[0], y: stim.vanish_last_visible_xy[1] };
  }
  function round(v, d) { if (v === null || v === undefined || isNaN(v)) return null; var m = Math.pow(10, d === undefined ? 2 : d); return Math.round(v * m) / m; }
  function scoreTrial(t, stim) {
    var ref = referenceFor(t.condition, stim);
    var has = !t.unsure && t.x !== null && t.x !== undefined && t.y !== null && t.y !== undefined;
    return {
      reference_type: ref.type, reference_x: ref.x, reference_y: ref.y,
      // screen y grows downward: positive = reported ABOVE the reference
      upward_displacement_px: has ? round(ref.y - t.y, 2) : null,
      horizontal_offset_px: has ? round(t.x - ref.x, 2) : null,
      distance_px: has ? round(Math.sqrt(Math.pow(t.x - ref.x, 2) + Math.pow(t.y - ref.y, 2)), 2) : null
    };
  }
  function mean(a) { if (!a.length) return null; return a.reduce(function (s, v) { return s + v; }, 0) / a.length; }
  function sd(a) { if (a.length < 2) return null; var m = mean(a); return Math.sqrt(a.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / (a.length - 1)); }
  function analyze(trials, stim) {
    var out = { byCondition: {}, n_trials: trials.length };
    [1, 2, 3].forEach(function (c) {
      var ts = trials.filter(function (t) { return Number(t.condition) === c; });
      var ref = referenceFor(c, stim);
      var raw = ts.filter(function (t) { return !t.unsure && t.y !== null && t.y !== undefined; }).map(function (t) { return ref.y - t.y; });   // unrounded, used for means
      var d = raw.map(function (v) { return round(v, 2); });
      var counts = { Yes: 0, No: 0, Unsure: 0 };
      ts.forEach(function (t) { if (counts[t.reachedTop] !== undefined) counts[t.reachedTop]++; });
      var conf = ts.map(function (t) { return t.confidence; }).filter(function (v) { return v !== null && v !== undefined; });
      out.byCondition[c] = {
        condition: c, label: CONDITIONS[c].label, n_trials: ts.length, n_located: d.length,
        n_location_unsure: ts.filter(function (t) { return t.unsure; }).length,
        mean_upward_displacement_px: round(mean(raw), 2), sd_upward_displacement_px: round(sd(raw), 2),
        displacements: d, reached_top_counts: counts,
        reached_top_proportions: { Yes: ts.length ? round(counts.Yes / ts.length, 3) : null, No: ts.length ? round(counts.No / ts.length, 3) : null, Unsure: ts.length ? round(counts.Unsure / ts.length, 3) : null },
        mean_confidence: round(mean(conf), 2),
        reference: referenceFor(c, stim)
      };
    });
    var m2 = out.byCondition[2].mean_upward_displacement_px, m3 = out.byCondition[3].mean_upward_displacement_px;
    out.difference_upward_minus_hand_px = (m2 !== null && m3 !== null) ? round(m2 - m3, 2) : null;
    return out;
  }
  function fmt(v) { return (v === null || v === undefined) ? 'n/a' : (v > 0 ? '+' : '') + v.toFixed(1); }
  function describe(an, stim) {
    var c2 = an.byCondition[2], c3 = an.byCondition[3], c1 = an.byCondition[1];
    if (!an.n_trials) return 'No experimental trials have been recorded for this session yet.';
    var bd = stim.ball_diameter_px;
    var s = 'The participant reported an average upward displacement of ' + fmt(c2.mean_upward_displacement_px) + ' pixels in the upward-gaze condition (n = ' + c2.n_located + ' located trial' + (c2.n_located === 1 ? '' : 's') + ') and ' + fmt(c3.mean_upward_displacement_px) + ' pixels in the hand-gaze condition (n = ' + c3.n_located + ').';
    if (an.difference_upward_minus_hand_px !== null) {
      var d = an.difference_upward_minus_hand_px;
      s += ' The upward-gaze mean minus the hand-gaze mean is ' + fmt(d) + ' px (about ' + (Math.abs(d) / bd).toFixed(1) + ' ball diameters); ' +
        (d > 0 ? 'descriptively, positions were reported higher after upward gaze than after hand gaze.' : d < 0 ? 'descriptively, positions were reported higher after hand gaze than after upward gaze.' : 'descriptively, the two conditions did not differ.') +
        ' The research hypothesis is two-sided (H1: gaze direction affects the reported location; H0: it does not), so a difference in either direction is of interest.';
    }
    s += ' Displacements are measured from the last visible ball position (y = ' + stim.vanish_last_visible_xy[1] + ' px on the 358 × 417 canvas); positive values mean the reported point was above it.';
    s += ' "Yes, it reached the highest point" was answered on ' + c2.reached_top_counts.Yes + '/' + c2.n_trials + ' upward-gaze trials and ' + c3.reached_top_counts.Yes + '/' + c3.n_trials + ' hand-gaze trials.';
    if (c1.n_trials) s += ' On real throws (reference: the highest visible ball position, y = ' + stim.real_throw_highest_visible_xy[1] + ' px), the mean displacement was ' + fmt(c1.mean_upward_displacement_px) + ' px (n = ' + c1.n_located + ').';
    s += ' This is an exploratory single-participant pilot with three trials per vanish condition (Version 3B, sky-blue ball #87C9EF, gaze-attention instructions); the values are descriptive, cannot by themselves support or reject H0, and no claim of statistical significance is made.';
    return s;
  }

  // ---------- CSV ----------
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = "'" + s;           // spreadsheet formula-injection guard for free text
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  var TRIAL_COLUMNS = ['experiment_version', 'ball_color', 'session_id', 'session_kind', 'phase', 'trial_number', 'condition_number', 'condition_label', 'stimulus_file',
    'reported_x', 'reported_y', 'not_sure_location', 'reached_top_response', 'confidence_1to5', 'response_time_ms', 'first_click_time_ms',
    'n_location_clicks', 'stimulus_id', 'stimulus_sha256', 'reference_type', 'reference_x', 'reference_y', 'upward_displacement_px', 'horizontal_offset_px', 'distance_px',
    'display_width_px', 'display_height_px', 'playback_started_at', 'response_submitted_at', 'playback_max_frame_lag_ms',
    'tab_hidden_during_playback', 'replayed_after_refresh'];
  function trialRows(session, stim, includePractice) {
    var rows = [];
    var list = (includePractice ? (session.practice || []).map(function (t) { return Object.assign({ phase: 'practice' }, t); }) : [])
      .concat((session.trials || []).map(function (t) { return Object.assign({ phase: 'experimental' }, t); }));
    list.forEach(function (t) {
      var sc = scoreTrial(t, stim);
      rows.push({
        experiment_version: session.experimentVersion || EXPERIMENT.version, ball_color: session.ballColor || EXPERIMENT.ball_color,
        stimulus_id: stimInfo(stim, t.condition).stimulus_id, stimulus_sha256: stimInfo(stim, t.condition).sha256,
        session_id: session.id, session_kind: session.kind, phase: t.phase, trial_number: t.trial,
        condition_number: t.condition, condition_label: CONDITIONS[t.condition].label, stimulus_file: CONDITIONS[t.condition].file,
        reported_x: t.unsure ? '' : t.x, reported_y: t.unsure ? '' : t.y, not_sure_location: t.unsure ? 'TRUE' : 'FALSE',
        reached_top_response: t.reachedTop, confidence_1to5: t.confidence, response_time_ms: t.rtMs, first_click_time_ms: t.firstClickMs,
        n_location_clicks: t.clicks, reference_type: sc.reference_type, reference_x: sc.reference_x, reference_y: sc.reference_y,
        upward_displacement_px: sc.upward_displacement_px, horizontal_offset_px: sc.horizontal_offset_px, distance_px: sc.distance_px,
        display_width_px: t.displayW, display_height_px: t.displayH, playback_started_at: t.playedAt, response_submitted_at: t.respondedAt,
        playback_max_frame_lag_ms: t.maxFrameLagMs, tab_hidden_during_playback: t.tabHidden ? 'TRUE' : 'FALSE',
        replayed_after_refresh: t.replayedAfterRefresh ? 'TRUE' : 'FALSE'
      });
    });
    return rows;
  }
  function stimInfo(stim, c) { var f = (stim.files || []).filter(function (x) { return Number(x.condition) === Number(c); })[0] || {}; return { stimulus_id: f.stimulus_id || '', sha256: f.sha256 || '' }; }
  function toCSV(rows, columns) {
    return [columns.join(',')].concat(rows.map(function (r) { return columns.map(function (c) { return csvCell(r[c]); }).join(','); })).join('\r\n') + '\r\n';
  }
  function sessionCSV(session, stim, includePractice) { return toCSV(trialRows(session, stim, includePractice), TRIAL_COLUMNS); }
  function debriefCSV(session) {
    var d = session.debrief || {};
    return toCSV([{ experiment_version: session.experimentVersion || EXPERIMENT.version, ball_color: session.ballColor || EXPERIMENT.ball_color,
      session_id: session.id, session_kind: session.kind, created_at: session.createdAt, completed_at: session.completedAt,
      noticed_about_throws: d.noticed, thought_experiment_was_investigating: d.purpose,
      noticed_where_trainer_was_looking: d.gaze, ball_colour_easy_or_difficult_to_track: d.colour, lost_sight_before_it_disappeared: d.lostSight, strategy_for_final_location: d.strategy,
      debrief_answers_submitted_at: d.submittedAt,
      practice_trials: (session.settings || {}).practice, confidence_collected: (session.settings || {}).confidence ? 'TRUE' : 'FALSE',
      trial_order_conditions: (session.order || []).join(' ') }],
      ['experiment_version', 'ball_color', 'session_id', 'session_kind', 'created_at', 'completed_at', 'noticed_about_throws', 'thought_experiment_was_investigating',
        'noticed_where_trainer_was_looking', 'ball_colour_easy_or_difficult_to_track', 'lost_sight_before_it_disappeared', 'strategy_for_final_location',
        'debrief_answers_submitted_at', 'practice_trials', 'confidence_collected', 'trial_order_conditions']);
  }

  // ---------- sessions ----------
  function newId(rng) {
    rng = rng || makeRng(); var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 6; i++) s += a[Math.floor(rng() * a.length)];
    return s;
  }
  function createSession(opts, rng) {
    opts = opts || {}; rng = rng || makeRng();
    var practice = Math.max(0, Math.min(2, opts.practice === undefined ? 2 : Number(opts.practice)));
    return {
      id: (opts.kind === 'real' ? 'V3B-P-' : 'V3B-TEST-') + newId(rng), kind: opts.kind === 'real' ? 'real' : 'test',
      experimentVersion: EXPERIMENT.version, ballColor: EXPERIMENT.ball_color,
      synthetic: !!opts.synthetic, createdAt: new Date().toISOString(),
      settings: { practice: practice, confidence: opts.confidence !== false },
      order: makeTrialOrder(rng), practiceOrder: Array(practice).fill(1),
      state: { phase: 'instructions', index: 0, playback: 'none' },
      practice: [], trials: [], debrief: null, completedAt: null, log: []
    };
  }

  return { EXPERIMENT: EXPERIMENT, CANVAS_W: CANVAS_W, CANVAS_H: CANVAS_H, CONDITIONS: CONDITIONS, ALLOCATION: ALLOCATION, makeRng: makeRng, shuffle: shuffle,
    maxRun: maxRun, makeTrialOrder: makeTrialOrder, clientToCanvas: clientToCanvas, canvasToDisplay: canvasToDisplay,
    referenceFor: referenceFor, scoreTrial: scoreTrial, analyze: analyze, describe: describe, mean: mean, csvCell: csvCell,
    TRIAL_COLUMNS: TRIAL_COLUMNS, trialRows: trialRows, toCSV: toCSV, sessionCSV: sessionCSV, debriefCSV: debriefCSV,
    createSession: createSession, newId: newId };
});
