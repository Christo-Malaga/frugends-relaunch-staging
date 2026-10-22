/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — Coming Soon (sections/fg-coming-soon) · E18
   Vanilla-Port des Vorhangs von creator.frugends.com (S01, React +
   motion: useScroll/useTransform → curtainLX/RX, revealLogoOpacity/
   Scale). Hier: ein passiver Scroll-Listener, per rAF gedrosselt,
   nur aktiv solange die Section in Viewport-Nähe ist.

   Fortschritt p (0…1) läuft über LEAD + PIN:
     LEAD = 10 % Viewport, bevor die Bühne unter dem Header pinnt ·
     PIN  = Scrollstrecke der Sticky-Bühne (Section-Höhe − Bühnenhöhe,
            per CSS 55svh).
   Beats (Original-Ranges in Klammern, dort auf 380dvh verteilt):
     0.00–0.12  Vorhang zu                         (0.78–0.82 fade-in)
     0.12–0.60  Hälften gleiten auf ∓95 %          (0.82–0.94)
     0.12–0.60  Reveal-Stage Scale .7→1, Opacity bis 0.42 voll (0.84–0.94)
     0.60–1.00  Scale 1→1.02 (Hold)                (0.94–1.00)
     0.48–0.84  Headline / Unterzeile / CTA gestaffelt (Hint 0.94–0.97)

   Bühnenkante (E22): nach dem Pin scrollt die Bühne nach oben weg;
   q (0…1) misst, wie weit die Section-Unterkante (= Naht zur
   Charakter-Section) vom unteren Viewportrand bis zur Viewportmitte
   gewandert ist, und zieht das Lichtband .fg-cs__edge auf (--q).

   Ohne JS oder bei prefers-reduced-motion: keine Aktivierung →
   Vorhang bleibt verborgen (= offen), normale Section-Höhe.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LEAD = 0.1;
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var seg = function (p, a, b) { return clamp01((p - a) / (b - a)); };
  var easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  function init(root) {
    if (!root || root.__fgcs) return;

    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var stage = root.querySelector('.fg-cs__stage');
    var reveal = root.querySelector('[data-fgcs-reveal]');
    var curtainL = root.querySelector('[data-fgcs-curtain="l"]');
    var curtainR = root.querySelector('[data-fgcs-curtain="r"]');
    var copy = Array.prototype.slice.call(root.querySelectorAll('[data-fgcs-copy]'));
    var edge = root.querySelector('[data-fgcs-edge]');
    // Staffelung der Copy-Elemente (Start, Ende) im Fortschritt p
    var copyRanges = [[0.48, 0.68], [0.54, 0.74], [0.60, 0.84]];

    var state = { enhanced: false, near: false, inView: false, focus: false, raf: 0, last: -1, lastQ: -1 };
    var geo = { vh: 0, top: 0, dist: 1 };

    function measure() {
      geo.vh = window.innerHeight;
      geo.top = parseFloat(getComputedStyle(stage).top) || 0;
      // Scrollstrecke der Sticky-Bühne (Section-Höhe − Bühnenhöhe)
      var pin = root.offsetHeight - stage.offsetHeight;
      geo.lead = LEAD * geo.vh;
      geo.dist = Math.max(1, pin + geo.lead);
      measureEdge();
    }

    // Band in die optische Mitte zwischen CTA-Unterkante (Bühne am
    // Pin-Ende = Section-Ende) und Inhaltsbeginn der nächsten Section.
    // offsetTop-Kette → transformfrei, unabhängig vom Scrollstand.
    function measureEdge() {
      if (!edge || !copy.length) return;
      var el = copy[copy.length - 1], top = 0;
      while (el && el !== stage) { top += el.offsetTop; el = el.offsetParent; }
      if (el !== stage) return;
      var above = stage.offsetHeight - top - copy[copy.length - 1].offsetHeight;
      var host = root.closest('.shopify-section') || root;
      var next = host.nextElementSibling;
      var first = next && (next.matches('section') ? next : next.querySelector('section'));
      var below = first ? parseFloat(getComputedStyle(first).paddingTop) || 0 : above;
      var shift = Math.max(0, (above - below) / 2);
      edge.style.setProperty('--edge-shift', shift.toFixed(1) + 'px');
    }

    function progress(r) {
      return clamp01((geo.top + geo.lead - r.top) / geo.dist);
    }

    // Naht wandert von 100 % auf 50 % Viewporthöhe → Band 0 → 1
    function exitProgress(r) {
      return clamp01((geo.vh - r.bottom) / (geo.vh * 0.5));
    }

    function renderEdge(q) {
      if (edge) edge.style.setProperty('--q', easeOut(q).toFixed(3));
    }

    function render(p) {
      var open = easeInOut(seg(p, 0.12, 0.6));
      curtainL.style.transform = 'translate3d(' + (-95 * open).toFixed(3) + '%,0,0)';
      curtainR.style.transform = 'translate3d(' + (95 * open).toFixed(3) + '%,0,0)';
      root.classList.toggle('is-open', open >= 0.999);

      var rv = seg(p, 0.12, 0.6);
      var scale = 0.7 + 0.3 * easeOut(rv) + 0.02 * seg(p, 0.6, 1);
      reveal.style.opacity = easeOut(seg(p, 0.12, 0.42)).toFixed(3);
      reveal.style.transform = 'scale(' + scale.toFixed(4) + ')';

      for (var i = 0; i < copy.length; i++) {
        var range = copyRanges[Math.min(i, copyRanges.length - 1)];
        var t = easeOut(seg(p, range[0], range[1]));
        var el = copy[i];
        el.style.opacity = t.toFixed(3);
        el.style.transform = i === copy.length - 1
          ? 'translate3d(0,' + ((1 - t) * 18).toFixed(2) + 'px,0) scale(' + (0.86 + 0.14 * t).toFixed(4) + ')'
          : 'translate3d(0,' + ((1 - t) * 24).toFixed(2) + 'px,0)';
      }

      // Endlos-FX nur, wenn sichtbar UND der Vorhang die Bühne freigibt
      root.classList.toggle('is-paused', !state.inView || p < 0.3);
    }

    function update() {
      state.raf = 0;
      var r = root.getBoundingClientRect();
      var q = exitProgress(r);
      if (Math.abs(q - state.lastQ) >= 0.001) { state.lastQ = q; renderEdge(q); }
      var p = state.focus ? 1 : progress(r);
      if (Math.abs(p - state.last) < 0.0005) return;
      state.last = p;
      render(p);
    }

    function schedule() {
      if (!state.raf) state.raf = window.requestAnimationFrame(update);
    }

    function onResize() { measure(); state.last = -1; state.lastQ = -1; schedule(); }

    function listen(on) {
      var fn = on ? 'addEventListener' : 'removeEventListener';
      window[fn]('scroll', schedule, { passive: true });
      window[fn]('resize', onResize, { passive: true });
    }

    // Nahbereich (±1 Viewport) steuert Scroll-Listener + will-change;
    // echter Viewport steuert die Endlos-Animationen.
    var ioNear = new IntersectionObserver(function (entries) {
      var near = entries[entries.length - 1].isIntersecting;
      if (near === state.near) return;
      state.near = near;
      root.classList.toggle('is-live', near && state.enhanced);
      if (!state.enhanced) return;
      listen(near);
      if (near) { measure(); state.last = -1; state.lastQ = -1; schedule(); }
    }, { rootMargin: '100% 0px 100% 0px' });

    var ioView = new IntersectionObserver(function (entries) {
      state.inView = entries[entries.length - 1].isIntersecting;
      if (state.enhanced) { state.last = -1; schedule(); }
      else root.classList.toggle('is-paused', !state.inView);
    });

    function onFocusIn() { state.focus = true; state.last = -1; schedule(); }
    function onFocusOut(e) {
      if (root.contains(e.relatedTarget)) return;
      state.focus = false; state.last = -1; schedule();
    }

    function clearInline() {
      [curtainL, curtainR, reveal].concat(copy).forEach(function (el) {
        el.style.transform = '';
        el.style.opacity = '';
      });
      if (edge) { edge.style.removeProperty('--q'); edge.style.removeProperty('--edge-shift'); }
    }

    function enable() {
      state.enhanced = true;
      root.classList.add('is-enhanced');
      root.classList.toggle('is-live', state.near);
      measure();
      state.last = -1;
      state.lastQ = -1;
      update();
      if (state.near) listen(true);
    }

    function disable() {
      state.enhanced = false;
      listen(false);
      if (state.raf) { window.cancelAnimationFrame(state.raf); state.raf = 0; }
      root.classList.remove('is-enhanced', 'is-live', 'is-open');
      root.classList.toggle('is-paused', !state.inView);
      clearInline();
    }

    function applyMotionPref() { if (mq.matches) disable(); else enable(); }

    if (!stage || !reveal || !curtainL || !curtainR) return;

    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    if (mq.addEventListener) mq.addEventListener('change', applyMotionPref);
    ioNear.observe(root);
    ioView.observe(root);
    applyMotionPref();

    root.__fgcs = {
      destroy: function () {
        disable();
        ioNear.disconnect();
        ioView.disconnect();
        root.removeEventListener('focusin', onFocusIn);
        root.removeEventListener('focusout', onFocusOut);
        if (mq.removeEventListener) mq.removeEventListener('change', applyMotionPref);
        delete root.__fgcs;
      }
    };
  }

  function boot(scope) {
    var list = (scope || document).querySelectorAll('[data-fg-cs]');
    for (var i = 0; i < list.length; i++) init(list[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(); });
  else boot();

  // Theme-Editor: Section neu gerendert / entfernt
  document.addEventListener('shopify:section:load', function (e) { boot(e.target); });
  document.addEventListener('shopify:section:unload', function (e) {
    var root = e.target.querySelector('[data-fg-cs]');
    if (root && root.__fgcs) root.__fgcs.destroy();
  });
})();
