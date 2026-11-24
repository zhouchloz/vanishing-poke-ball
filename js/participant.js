/* Participant flow. Contains no stimulus labels: stimuli are referenced only by number (1-3). */
(function () {
  'use strict';
  var STIM = window.PBCC_STIM, STORE = window.PBCC_STORE, PLAYER = window.PBCC_PLAYER;
  var $ = function (id) { return document.getElementById(id); };
  var session = null, resp = null, respShownAt = 0;

  function show(id) {
    var cur = document.querySelector('.screen.active');
    if (cur) { cur.classList.remove('active', 'shown'); }
    var el = $(id); el.classList.add('active');
    document.body.classList.toggle('stage-mode', id === 's-stage');
    hideCursor(id === 's-stage');
    if (id === 's-stage') { el.classList.add('shown'); }                    // stage appears instantly (no fade)
    else { void el.offsetWidth; requestAnimationFrame(function () { el.classList.add('shown'); }); }
    window.scrollTo(0, 0);
  }
  // Cursor is invisible on the whole page from the click on "Watch the Throw" until the questions appear
  // (600 ms hold + 40 frames). No custom pointer is drawn; mouse events are not blocked.
  function hideCursor(on) {
    document.documentElement.classList.toggle('cursor-hidden', !!on);
    document.body.classList.toggle('cursor-hidden', !!on);
  }
  function save() { session.updatedAt = new Date().toISOString(); STORE.putSession(session); }
  function log(ev, extra) { session.log = session.log || []; session.log.push(Object.assign({ t: new Date().toISOString(), ev: ev }, extra || {})); }

  // ---------- phases ----------
  function list() { return session.state.phase === 'practice' ? session.practiceOrder : session.order; }
  function currentStimulus() { return list()[session.state.index]; }

  function displayDims() {
    if (!session.settings.display) {
      var maxW = Math.min(window.innerWidth - 40, 760), maxH = window.innerHeight - 200;   // leaves room for the header + card on the question screen
      var d = PLAYER.displaySize(maxW, maxH); session.settings.display = { w: d.w, h: d.h }; save();
    }
    return session.settings.display;
  }

  function route() {
    var st = session.state;
    if (st.phase === 'instructions') return show('s-instructions');
    if (st.phase === 'practice' || st.phase === 'trials') {
      if (st.playback === 'playing') {                       // page was refreshed during playback
        st.playback = 'none'; st.pending = null; st.replayNext = true; log('refresh_during_playback', { phase: st.phase, index: st.index }); save();
      }
      if (st.playback === 'done') return showResponse();     // refreshed after playback: never replay, go to questions
      return showReady();
    }
    if (st.phase === 'main_intro') { $('main-intro-title').innerHTML = session.practiceOrder.length ? 'Warm-up complete <span class="star">★</span>' : 'Get ready <span class="star">★</span>'; return show('s-main-intro'); }
    if (st.phase === 'practice_intro') return showPracticeIntro();
    if (st.phase === 'debrief_q') return showDebriefQuestions();
    if (st.phase === 'complete') return showDebrief();
  }
  function showPracticeIntro() {
    var n = session.practiceOrder.length;
    $('practice-intro-text').textContent = 'First, ' + (n === 1 ? 'one warm-up round' : n + ' warm-up rounds') + ' so you can get used to the game. Warm-up rounds don\'t count.';
    show('s-practice-intro');
  }
  function showReady() {
    var st = session.state, practice = st.phase === 'practice';
    $('round-label').textContent = practice ? ('Warm-up ' + (st.index + 1) + ' of ' + session.practiceOrder.length) : ('Round ' + (st.index + 1) + ' of ' + session.order.length);
    $('round-sub').textContent = 'Get ready to watch closely.';
    $('btn-watch').disabled = false;
    show('s-ready');
  }
  function watch() {
    $('btn-watch').disabled = true;
    hideCursor(true);
    var st = session.state, c = currentStimulus(), d = displayDims();
    var cv0 = $('stage-canvas'), ctx0 = PLAYER.sizeCanvas(cv0, d.w, d.h);
    ctx0.drawImage(PLAYER.cache[c][0], 0, 0, cv0.width, cv0.height);       // first frame is on the canvas before it becomes visible
    st.playback = 'playing'; st.pending = { playedAt: new Date().toISOString(), replayedAfterRefresh: !!st.replayNext }; st.replayNext = false; save();
    show('s-stage');
    PLAYER.play($('stage-canvas'), c, { preRollMs: 600 }).then(function (diag) {
      st.playback = 'done'; Object.assign(st.pending, diag); save();
      var cv = $('stage-canvas'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);   // never show frame 0 again
      showResponse();
    });
  }

  function showDebriefQuestions() {
    show('s-debrief-q');
    var fill = function () { if (!$('dq3')) $('dq-extra').innerHTML = window.PBCC_DEBRIEF_QUESTIONS_HTML || ''; };
    if (window.PBCC_DEBRIEF_QUESTIONS_HTML) return fill();
    $('btn-dq').disabled = true;
    var sc = document.createElement('script'); sc.src = 'js/debrief_questions.js';
    sc.onload = function () { fill(); $('btn-dq').disabled = false; };
    sc.onerror = function () { $('btn-dq').disabled = false; };
    document.body.appendChild(sc);
  }
  // Debrief text lives in a separate file that is only requested after the debrief questions were answered,
  // so nothing about the purpose is present on the page while the trials run.
  function showDebrief() {
    show('s-debrief');
    if (window.PBCC_DEBRIEF_HTML) { $('debrief-card').innerHTML = window.PBCC_DEBRIEF_HTML; return; }
    var sc = document.createElement('script'); sc.src = 'js/debrief_text.js';
    sc.onload = function () { $('debrief-card').innerHTML = window.PBCC_DEBRIEF_HTML; };
    sc.onerror = function () { $('debrief-card').innerHTML = '<h2>Thank you for playing!</h2><p>Please ask the researcher for a short explanation of the study.</p>'; };
    document.body.appendChild(sc);
  }

  // ---------- response screen ----------
  function showResponse() {
    var d = displayDims(), pk = $('picker');
    pk.style.width = d.w + 'px'; pk.style.height = d.h + 'px';
    resp = { x: null, y: null, unsure: false, reachedTop: null, confidence: null, clicks: 0, firstClickMs: null };
    $('dot').style.display = 'none'; $('unsure').checked = false; pk.classList.remove('disabled');
    document.querySelectorAll('#q2 .choice, #q3 .choice').forEach(function (b) { b.classList.remove('sel'); });
    $('q3wrap').style.display = session.settings.confidence ? '' : 'none';
    validate();
    show('s-response');
    respShownAt = performance.now();
  }
  function onPick(ev) {
    if (resp.unsure) return;
    var rect = $('picker').getBoundingClientRect();
    var x = (ev.clientX - rect.left) / rect.width * STIM.canvas[0], y = (ev.clientY - rect.top) / rect.height * STIM.canvas[1];
    x = Math.round(Math.min(STIM.canvas[0], Math.max(0, x)) * 10) / 10; y = Math.round(Math.min(STIM.canvas[1], Math.max(0, y)) * 10) / 10;
    resp.x = x; resp.y = y; resp.clicks++;
    if (resp.firstClickMs === null) resp.firstClickMs = Math.round(performance.now() - respShownAt);
    var dot = $('dot'); dot.style.left = (x / STIM.canvas[0] * 100) + '%'; dot.style.top = (y / STIM.canvas[1] * 100) + '%'; dot.style.display = 'block';
    validate();
  }
  function validate() {
    var okLoc = resp.unsure || resp.x !== null, ok = okLoc && resp.reachedTop && (!session.settings.confidence || resp.confidence);
    $('btn-submit').disabled = !ok;
    $('submit-hint').textContent = ok ? '' : (!okLoc ? 'Click the picture (or tick "I\'m not sure").' : 'Please answer all questions.');
  }
  function submit() {
    if ($('btn-submit').disabled) return;
    $('btn-submit').disabled = true;
    var st = session.state, d = displayDims(), p = st.pending || {};
    var rec = { trial: st.index + 1, condition: currentStimulus(), x: resp.unsure ? null : resp.x, y: resp.unsure ? null : resp.y, unsure: resp.unsure,
      reachedTop: resp.reachedTop, confidence: session.settings.confidence ? Number(resp.confidence) : null,
      rtMs: Math.round(performance.now() - respShownAt), firstClickMs: resp.firstClickMs, clicks: resp.clicks,
      displayW: d.w, displayH: d.h, playedAt: p.playedAt || null, respondedAt: new Date().toISOString(),
      maxFrameLagMs: p.maxFrameLagMs === undefined ? null : p.maxFrameLagMs, skippedFrames: p.skippedFrames === undefined ? null : p.skippedFrames,
      tabHidden: !!p.tabHidden, replayedAfterRefresh: !!p.replayedAfterRefresh, resumedAtQuestions: !!p.resumed };
    if (st.phase === 'practice') session.practice.push(rec); else session.trials.push(rec);
    st.index++; st.playback = 'none'; st.pending = null;
    if (st.phase === 'practice' && st.index >= session.practiceOrder.length) { st.phase = 'main_intro'; st.index = 0; }
    else if (st.phase === 'trials' && st.index >= session.order.length) { st.phase = 'debrief_q'; st.index = 0; }
    save(); route();
  }

  // ---------- wiring ----------
  function wire() {
    $('btn-start').onclick = function () {
      displayDims(); log('started');
      session.startedAt = session.startedAt || new Date().toISOString();
      session.state.phase = session.practiceOrder.length ? 'practice_intro' : 'main_intro'; session.state.index = 0; save(); route();   // the reminder screen always precedes the scored rounds
    };
    $('btn-practice-go').onclick = function () { session.state.phase = 'practice'; session.state.index = 0; save(); route(); };
    $('btn-main-go').onclick = function () { session.state.phase = 'trials'; session.state.index = 0; save(); route(); };
    $('btn-watch').onclick = watch;
    $('picker').addEventListener('click', onPick);
    $('unsure').onchange = function () {
      resp.unsure = this.checked; $('picker').classList.toggle('disabled', resp.unsure);
      if (resp.unsure) { resp.x = null; resp.y = null; $('dot').style.display = 'none'; }
      validate();
    };
    document.querySelectorAll('#q2 .choice').forEach(function (b) { b.onclick = function () { document.querySelectorAll('#q2 .choice').forEach(function (o) { o.classList.remove('sel'); }); b.classList.add('sel'); resp.reachedTop = b.dataset.v; validate(); }; });
    document.querySelectorAll('#q3 .choice').forEach(function (b) { b.onclick = function () { document.querySelectorAll('#q3 .choice').forEach(function (o) { o.classList.remove('sel'); }); b.classList.add('sel'); resp.confidence = b.dataset.v; validate(); }; });
    $('btn-submit').onclick = submit;
    $('btn-dq').onclick = function () {
      var v = function (id) { return $(id) ? $(id).value.trim() : null; };
      session.debrief = { noticed: v('dq1'), purpose: v('dq2'), gaze: v('dq3'), colour: v('dq4'), lostSight: v('dq5'), strategy: v('dq6'), submittedAt: new Date().toISOString() };
      session.state.phase = 'complete'; session.completedAt = new Date().toISOString(); log('completed'); save(); route();
    };
    $('still').src = window.PBCC_STILL_DATAURI;
    document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('#s-stage, #picker')) e.preventDefault(); });
  }

  function init() {
    wire();
    session = STORE.getActive();
    if (!session) return show('s-nosession');
    if (session.state.phase === 'done_by_researcher') return show('s-nosession');
    show('s-loading');
    var conds = [1, 2, 3].filter(function (c) { return session.order.indexOf(c) >= 0 || session.practiceOrder.indexOf(c) >= 0; });
    PLAYER.preload(conds, function (f) { $('load-bar').style.width = Math.round(f * 100) + '%'; $('load-text').textContent = Math.round(f * 100) + '%'; })
      .then(function () {
        if (session.state.playback === 'done' && session.state.pending) session.state.pending.resumed = true;
        route();
      })
      .catch(function (e) { $('load-text').textContent = 'Could not load the animations. Please tell the researcher. (' + e.message + ')'; });
  }
  window.PBCC_PARTICIPANT = { init: init, _get: function () { return session; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
