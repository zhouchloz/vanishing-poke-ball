/* One-shot frame player. The GIFs were decoded into lossless PNG frames (40 x 50 ms); playing them on a canvas
   guarantees exactly one playback per trial, exact 50 ms timing, identical scaling for every stimulus, and no
   loop/reset to frame 0 at the end (the canvas is hidden the moment the last frame's 50 ms have elapsed). */
(function (root) {
  'use strict';
  var STIM = root.PBCC_STIM;
  var cache = {};
  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { (im.decode ? im.decode().catch(function () {}) : Promise.resolve()).then(function () { resolve(im); }); };
      im.onerror = function () { reject(new Error('Could not load ' + src)); };
      im.src = src;
    });
  }
  function preload(stims, onProgress) {
    var jobs = [], done = 0, total = stims.length * STIM.frames;
    stims.forEach(function (c) {
      if (cache[c]) { done += STIM.frames; return; }
      var arr = new Array(STIM.frames); cache[c] = arr;
      for (var i = 0; i < STIM.frames; i++) {
        (function (i) {
          var src = STIM.frame_dirs[c] + '/f' + (i < 10 ? '0' : '') + i + '.png';
          jobs.push(loadImage(src).then(function (im) { arr[i] = im; done++; if (onProgress) onProgress(done / total); }));
        })(i);
      }
    });
    if (onProgress && done === total) onProgress(1);
    return Promise.all(jobs).catch(function (e) { stims.forEach(function (c) { delete cache[c]; }); throw e; });
  }
  function sizeCanvas(canvas, cssW, cssH) {
    var dpr = Math.max(1, Math.min(3, root.devicePixelRatio || 1));
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    var ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    return ctx;
  }
  function draw(ctx, canvas, im) { ctx.drawImage(im, 0, 0, canvas.width, canvas.height); }
  // Plays stimulus c once. Resolves with timing diagnostics after the last frame has been on screen for 50 ms.
  function play(canvas, c, opts) {
    opts = opts || {};
    var frames = cache[c]; if (!frames) return Promise.reject(new Error('frames not loaded'));
    var ctx = canvas.getContext('2d'), N = STIM.frames, MS = STIM.frame_ms, preRoll = opts.preRollMs === undefined ? 600 : opts.preRollMs;
    var hidden = false; function vis() { if (root.document.hidden) hidden = true; }
    root.document.addEventListener('visibilitychange', vis);
    draw(ctx, canvas, frames[0]);
    return new Promise(function (resolve) {
      setTimeout(function () {
        var t0 = null, last = -1, lags = [], skipped = 0;
        function tick(now) {
          if (t0 === null) { t0 = now; }
          var idx = Math.floor((now - t0) / MS);
          if (idx >= N) {
            root.document.removeEventListener('visibilitychange', vis);
            resolve({ maxFrameLagMs: Math.round(Math.max.apply(null, lags.concat([0]))), skippedFrames: skipped, tabHidden: hidden || root.document.hidden, durationMs: Math.round(now - t0) });
            return;
          }
          if (idx !== last) {
            if (last >= 0 && idx > last + 1) skipped += idx - last - 1;
            draw(ctx, canvas, frames[idx]); lags.push(now - (t0 + idx * MS)); last = idx;
            if (opts.onFrame) opts.onFrame(idx, now - t0);
          }
          root.requestAnimationFrame(tick);
        }
        root.requestAnimationFrame(tick);
      }, preRoll);
    });
  }
  // Display size: same for every stimulus, original aspect ratio, as large as comfortably fits (max 1.6x).
  function displaySize(maxW, maxH) {
    var W = STIM.canvas[0], H = STIM.canvas[1];
    var s = Math.min(maxW / W, maxH / H, 1.6); s = Math.max(s, 0.75);
    return { w: Math.round(W * s), h: Math.round(H * s), scale: s };
  }
  root.PBCC_PLAYER = { preload: preload, play: play, sizeCanvas: sizeCanvas, displaySize: displaySize, cache: cache };
})(window);
