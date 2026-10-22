/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — SCROLL-CINEMA ENGINE (vanilla JS)
   ───────────────────────────────────────────────────────────────
   Re-build of the predecessor's sticky-scrub cinema feel without any
   framework. React drove beats with:

       const o = useTransform(scrollYProgress, [stops], [values]);
       <motion.div style={{ opacity: o }} />

   Here, the same per-beat range mechanic is DECLARED on the DOM:

       <div class="beat"
            data-fx-opacity="0,0.04,0.18,0.24 | 1,1,1,0"
            data-fx-x="0.2,0.6 | -40vw,0vw"
            data-fx-scale="0.2,0.6 | 0.8,1">

   and computed by this engine into CSS vars --o/--x/--y/--s/--r which
   the .beat rule consumes via transform/opacity (compositor-only).

   AUTHORING FORMAT  ──  data-fx-<prop>="stops | values"
     • <prop>   ∈ opacity | x | y | scale | rotate
     • stops    : comma list of scroll-progress points in [0..1],
                  ascending, mapped 1:1 to values
     • values   : comma list, same length; units-aware
                  (vw/vh/%/px/deg/rem/em or plain number)
     • progress p is clamped 0..1; before first stop holds first value,
       after last stop holds last value (matches Motion's clamp).

   PERF (ported learnings):
     • IntersectionObserver marks sections active/inactive; only active
       sections compute in the loop (idle cinemas cost nothing).
     • passive scroll listener flips a dirty flag; ONE rAF loop
       coalesces & recomputes (no per-event layout thrash).
     • section top/height cached; recomputed on resize/orientationchange.
     • will-change toggled (via .is-live on the stage) ONLY while active.
     • reduced-motion: every beat frozen at its hold value, loop never
       starts.

   ANIMATION GATE  ──  data-fx-anim
     A beat carrying data-fx-anim gets the class .is-animating ONLY while
     its section is active AND its computed opacity is > 0. CSS keyframe
     loops inside such a beat are scoped to .is-animating, so they stop
     (animation: none) as soon as the beat has faded out or the cinema
     has left the viewport — opacity:0 alone would keep them painting.

   HIT GATE  ──  data-fx-hit  (+ optional data-fx-focus="<p>")
     Stacked screens are all inset:0, so an invisible later screen
     would swallow clicks meant for a visible earlier one. The section
     gets .is-fx once the engine runs (CSS then sets pointer-events:none
     on the screens); a beat carrying data-fx-hit gets .is-shown while
     its opacity is ≥ 0.5 and only then takes pointer events.
     data-fx-focus: when keyboard focus lands inside the beat while it
     is hidden, the window jumps to that scrub progress so the focused
     element is actually on screen.

   REDUCED MOTION
     No interpolation, no rAF loop. Each beat is snapped per scroll
     position: opacity → 0 or 1 (threshold 0.5), every other track →
     its resting (last) value. Screens therefore swap instantly instead
     of cross-fading, and each screen is fully readable on its own.

   PUBLIC API
     window.ScrollCinema = { refresh() }   // re-measure after dynamic
                                            // content / font / image load
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var FX_PROPS = ['opacity', 'x', 'y', 'scale', 'rotate'];
  // Which CSS var each fx prop writes.
  var VAR_OF = { opacity: '--o', x: '--x', y: '--y', scale: '--s', rotate: '--r' };

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ─── number+unit parsing ────────────────────────────────────────
  // "-40vw" -> { n: -40, unit: "vw" } ; "0.8" -> { n: 0.8, unit: "" }
  function parseValue(raw) {
    var s = String(raw).trim();
    var m = s.match(/^(-?\d*\.?\d+)\s*([a-z%]*)$/i);
    if (!m) return { n: parseFloat(s) || 0, unit: '' };
    return { n: parseFloat(m[1]), unit: m[2] || '' };
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  // ─── lerpStops ─────────────────────────────────────────────────
  // Multi-segment linear interpolation, the vanilla useTransform.
  //   p       : progress 0..1
  //   stops   : ascending number[]   e.g. [0, 0.04, 0.18, 0.24]
  //   values  : parsed {n,unit}[]    same length
  // Returns a string ("0.8" or "-40vw") with the unit re-appended.
  // Clamps to the first/last value outside the stop range (Motion's
  // default clamp behaviour).
  function lerpStops(p, stops, values) {
    var n = stops.length;
    if (n === 0) return '0';
    if (n === 1 || p <= stops[0]) return values[0].n + values[0].unit;
    if (p >= stops[n - 1]) return values[n - 1].n + values[n - 1].unit;

    // find segment [i, i+1] containing p
    for (var i = 0; i < n - 1; i++) {
      var a = stops[i];
      var b = stops[i + 1];
      if (p >= a && p <= b) {
        var span = b - a;
        var t = span === 0 ? 0 : (p - a) / span;
        var va = values[i];
        var vb = values[i + 1];
        var num = va.n + (vb.n - va.n) * t;
        // unit comes from the values; assume consistent within a prop.
        var unit = va.unit || vb.unit;
        // trim float noise a touch for cleaner CSS
        return (Math.round(num * 1000) / 1000) + unit;
      }
    }
    return values[n - 1].n + values[n - 1].unit; // unreachable fallback
  }

  // ─── parse one data-fx-* attribute into {stops, values} ─────────
  // "0,0.04,0.18,0.24 | 1,1,1,0"
  function parseTrack(attr) {
    var parts = String(attr).split('|');
    if (parts.length !== 2) return null;
    var stops = parts[0].split(',').map(function (s) { return parseFloat(s.trim()); });
    var values = parts[1].split(',').map(function (v) { return parseValue(v); });
    if (stops.length !== values.length || stops.length === 0) return null;
    return { stops: stops, values: values };
  }

  // ─── Section model ──────────────────────────────────────────────
  // { el, stage, beats:[{el, tracks:{opacity?,x?,...}}], top, height, active }
  var sections = [];
  var dirty = true;
  var rafId = 0;
  var running = false;

  function buildSections() {
    sections = [];
    var nodes = document.querySelectorAll('[data-scrub]');
    Array.prototype.forEach.call(nodes, function (el) {
      var stage = el.querySelector('.scrub__stage');
      var beatEls = el.querySelectorAll('.beat');
      var beats = [];
      Array.prototype.forEach.call(beatEls, function (b) {
        var tracks = {};
        var has = false;
        FX_PROPS.forEach(function (prop) {
          var attr = b.getAttribute('data-fx-' + prop);
          if (attr) {
            var t = parseTrack(attr);
            if (t) { tracks[prop] = t; has = true; }
          }
        });
        if (has) beats.push({ el: b, tracks: tracks, anim: b.hasAttribute('data-fx-anim'), hit: b.hasAttribute('data-fx-hit') });
      });
      el.classList.add('is-fx');
      sections.push({
        el: el,
        stage: stage,
        beats: beats,
        top: 0,
        height: 0,
        active: false
      });
    });
  }

  function measure() {
    var scrollY = window.scrollY || window.pageYOffset || 0;
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      var rect = s.el.getBoundingClientRect();
      s.top = rect.top + scrollY;
      s.height = s.el.offsetHeight;
    }
  }

  // Apply a beat's computed vars for a given progress.
  function applyBeat(beat, p) {
    var tracks = beat.tracks;
    for (var prop in tracks) {
      if (!tracks.hasOwnProperty(prop)) continue;
      var t = tracks[prop];
      var v = lerpStops(p, t.stops, t.values);
      beat.el.style.setProperty(VAR_OF[prop], v);
      if (prop === 'opacity' && beat.anim) setAnimating(beat, parseFloat(v) > 0.01);
      if (prop === 'opacity' && beat.hit) setShown(beat, parseFloat(v) >= 0.5);
    }
  }

  // Toggle the pointer-event gate of a data-fx-hit beat (only on change).
  function setShown(beat, on) {
    if (beat.shownOn === on) return;
    beat.shownOn = on;
    beat.el.classList.toggle('is-shown', on);
  }

  // Toggle the CSS-loop gate of a data-fx-anim beat (only on change).
  function setAnimating(beat, on) {
    if (beat.animOn === on) return;
    beat.animOn = on;
    beat.el.classList.toggle('is-animating', on);
  }

  // Reduced motion: snap a beat for progress p (see header).
  function applyBeatStatic(beat, p) {
    var tracks = beat.tracks;
    for (var prop in tracks) {
      if (!tracks.hasOwnProperty(prop)) continue;
      var t = tracks[prop];
      var v;
      if (prop === 'opacity') {
        v = parseFloat(lerpStops(p, t.stops, t.values)) >= 0.5 ? '1' : '0';
      } else {
        var last = t.values[t.values.length - 1];
        v = last.n + last.unit;
      }
      beat.el.style.setProperty(VAR_OF[prop], v);
      if (prop === 'opacity' && beat.hit) setShown(beat, v === '1');
    }
    if (beat.anim) setAnimating(beat, false);
  }

  // data-fx-focus: keyboard focus on a hidden beat → scroll to its slot.
  // Delegated once on document (sections can be rebuilt by refresh()).
  var focusBound = false;
  function setupFocus() {
    if (focusBound) return;
    focusBound = true;
    document.addEventListener('focusin', function (e) {
      var beatEl = e.target.closest && e.target.closest('[data-fx-focus]');
      if (!beatEl || beatEl.classList.contains('is-shown')) return;
      var host = beatEl.closest('[data-scrub]');
      var s = host && findSection(host);
      if (!s) return;
      measure();
      var p = clamp01(parseFloat(beatEl.getAttribute('data-fx-focus')) || 0);
      var vh = window.innerHeight || document.documentElement.clientHeight;
      window.scrollTo(0, Math.round(s.top + p * Math.max(0, s.height - vh)));
    });
  }

  function progressOf(s, vh, scrollY) {
    var denom = s.height - vh;
    return denom <= 0 ? 0 : clamp01((scrollY - s.top) / denom);
  }

  function computeAll() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      if (!s.active) continue;
      var p = progressOf(s, vh, scrollY);
      for (var j = 0; j < s.beats.length; j++) {
        applyBeat(s.beats[j], p);
      }
      // expose live progress for debug readouts
      if (s.stage) s.stage.style.setProperty('--p', (Math.round(p * 10000) / 10000));
    }
  }

  function loop() {
    if (dirty) {
      dirty = false;
      computeAll();
    }
    rafId = window.requestAnimationFrame(loop);
  }

  function onScroll() {
    dirty = true;
  }

  function onResize() {
    measure();
    dirty = true;
  }

  // ─── IntersectionObserver — activate/deactivate sections ────────
  var io = null;
  function setupObserver() {
    if (io) io.disconnect();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var s = findSection(entry.target);
        if (!s) return;
        s.active = entry.isIntersecting;
        if (s.stage) s.stage.classList.toggle('is-live', s.active);
        if (s.active) dirty = true; // recompute immediately on entry
        else s.beats.forEach(function (b) { if (b.anim) setAnimating(b, false); });
      });
    }, { threshold: 0 });
    sections.forEach(function (s) { io.observe(s.el); });
  }

  function findSection(el) {
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].el === el) return sections[i];
    }
    return null;
  }

  // ─── reduced-motion static render ───────────────────────────────
  // Stepped, not animated: re-snapped on scroll (rAF-coalesced).
  var staticQueued = false;
  function renderStatic() {
    staticQueued = false;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    sections.forEach(function (s) {
      if (s.stage) s.stage.classList.remove('is-live'); // no will-change
      var p = progressOf(s, vh, scrollY);
      s.beats.forEach(function (b) { applyBeatStatic(b, p); });
    });
  }
  function onStaticScroll() {
    if (staticQueued) return;
    staticQueued = true;
    window.requestAnimationFrame(renderStatic);
  }
  function onStaticResize() {
    measure();
    onStaticScroll();
  }
  function bindStatic(on) {
    var m = on ? 'addEventListener' : 'removeEventListener';
    window[m]('scroll', onStaticScroll, { passive: true });
    window[m]('resize', onStaticResize, { passive: true });
  }

  // ─── smooth-anchor helper ───────────────────────────────────────
  // Global scroll-behavior is `auto`; opt into smooth per anchor click.
  var anchorsBound = false;
  function setupAnchors() {
    if (anchorsBound) return; // start() can run again after a reduced-motion toggle
    anchorsBound = true;
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href === '#') return;
      var target = document.getElementById(href.slice(1));
      if (!target) return;
      e.preventDefault();
      var reduce = reduceMQ.matches;
      target.scrollIntoView({
        behavior: reduce ? 'auto' : 'smooth',
        block: 'start'
      });
      if (history && history.pushState) history.pushState(null, '', href);
    });
  }

  // ─── lifecycle ──────────────────────────────────────────────────
  function start() {
    buildSections();
    if (sections.length === 0) return;

    setupAnchors();
    setupFocus();

    if (reduceMQ.matches) {
      // Reduced motion: stepped static render, never the rAF loop.
      measure();
      renderStatic();
      bindStatic(true);
      return;
    }

    measure();
    setupObserver();
    // initial paint so beats aren't unstyled before first scroll
    sections.forEach(function (s) {
      s.active = true; // compute once
    });
    computeAll();
    sections.forEach(function (s) {
      s.active = false; // observer will flip the truly-visible ones on
    });
    dirty = true;

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });

    if (!running) {
      running = true;
      rafId = window.requestAnimationFrame(loop);
    }
  }

  // React to a runtime change of the reduced-motion preference.
  function onReduceChange() {
    if (reduceMQ.matches) {
      if (rafId) window.cancelAnimationFrame(rafId);
      running = false;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (io) io.disconnect();
      renderStatic();
      bindStatic(true);
    } else {
      bindStatic(false);
      running = false; // allow start() to relaunch the loop
      start();
    }
  }
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', onReduceChange);
  else if (reduceMQ.addListener) reduceMQ.addListener(onReduceChange); // Safari < 14

  // ─── public API ─────────────────────────────────────────────────
  // refresh(): rebuild beat declarations + re-measure. Call after
  // dynamic content, fonts, or images have changed layout.
  window.ScrollCinema = {
    refresh: function () {
      buildSections();
      if (sections.length === 0) return;
      if (reduceMQ.matches) {
        measure();
        renderStatic();
        return;
      }
      measure();
      setupObserver();
      dirty = true;
      if (!running) {
        running = true;
        rafId = window.requestAnimationFrame(loop);
      }
    },
    // exposed for tests / debugging
    _lerpStops: lerpStops,
    _parseTrack: parseTrack
  };

  // ─── boot ───────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
  // Re-measure once fonts/images settle (layout can shift section height).
  window.addEventListener('load', function () {
    measure();
    if (reduceMQ.matches) renderStatic(); else dirty = true;
  });
})();
