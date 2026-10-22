/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — "Wofür wir stehen" · STORY BOOK controller
   Drives the horizontal page-turn module on the Über-uns page.

   Responsibilities (DOM-only, Shopify-Liquid-safe):
     • track current leaf from scroll position
     • prev / next buttons, clickable chapter bars, ← → / Home / End
     • wheel → horizontal page-turn (releases at the edges)
     • parallax the ghost numerals, recolour the accent per chapter
     • announce page changes to assistive tech (aria-live)
     • full prefers-reduced-motion fallback (no smooth, no parallax)

   Boots on DOMContentLoaded, guards if the component is absent, and
   only ever reads the DOM — no globals, no libraries, no build step.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function init() {
    var root = document.querySelector('[data-story-book]');
    if (!root) return;

    var track = root.querySelector('[data-story-track]');
    var leaves = Array.prototype.slice.call(root.querySelectorAll('[data-story-leaf]'));
    if (!track || leaves.length === 0) return;

    var prevBtn = root.querySelector('[data-story-prev]');
    var nextBtn = root.querySelector('[data-story-next]');
    var dots = Array.prototype.slice.call(root.querySelectorAll('[data-story-dot]'));
    var idxEl = root.querySelector('[data-story-index]');
    var live = root.querySelector('[data-story-live]');

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var accents = ['var(--gold)', 'var(--cyan)', 'var(--purple)'];
    var titles = leaves.map(function (l) { return l.getAttribute('data-title') || ''; });
    var last = leaves.length - 1;
    var current = -1;

    // Opt into the page-turn reveal (kept off for the no-JS baseline).
    root.classList.add('is-enhanced');

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    function setCurrent(i) {
      if (i < 0) i = 0; else if (i > last) i = last;
      if (i === current) return;
      current = i;

      for (var k = 0; k < leaves.length; k++) {
        leaves[k].classList.toggle('is-active', k === i);
      }
      for (var d = 0; d < dots.length; d++) {
        var on = d === i;
        dots[d].classList.toggle('is-active', on);
        if (on) dots[d].setAttribute('aria-current', 'true');
        else dots[d].removeAttribute('aria-current');
      }

      if (idxEl) idxEl.textContent = pad(i + 1);
      root.style.setProperty('--sb-accent', accents[i % accents.length]);
      if (prevBtn) prevBtn.disabled = i === 0;
      if (nextBtn) nextBtn.disabled = i === last;
      if (live) live.textContent = 'Seite ' + (i + 1) + ' von ' + leaves.length + ': ' + titles[i];
    }

    function nearestIndex() {
      var center = track.scrollLeft + track.clientWidth / 2;
      var best = 0;
      var bestDist = Infinity;
      for (var k = 0; k < leaves.length; k++) {
        var lc = leaves[k].offsetLeft + leaves[k].offsetWidth / 2;
        var dist = Math.abs(lc - center);
        if (dist < bestDist) { bestDist = dist; best = k; }
      }
      return best;
    }

    function goTo(i) {
      if (i < 0) i = 0; else if (i > last) i = last;
      var leaf = leaves[i];
      var left = leaf.offsetLeft - (track.clientWidth - leaf.offsetWidth) / 2;
      track.scrollTo({ left: left, behavior: reduce.matches ? 'auto' : 'smooth' });
      setCurrent(i);
    }

    // Scroll → indicator sync + ghost parallax (rAF-throttled).
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        setCurrent(nearestIndex());
        if (!reduce.matches) {
          var center = track.scrollLeft + track.clientWidth / 2;
          var w = track.clientWidth || 1;
          for (var k = 0; k < leaves.length; k++) {
            var lc = leaves[k].offsetLeft + leaves[k].offsetWidth / 2;
            var p = (lc - center) / w;
            if (p < -1) p = -1; else if (p > 1) p = 1;
            leaves[k].style.setProperty('--p', p.toFixed(3));
          }
        }
        ticking = false;
      });
    }
    track.addEventListener('scroll', onScroll, { passive: true });

    // Controls.
    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(current + 1); });
    dots.forEach(function (dot, k) {
      dot.addEventListener('click', function () { goTo(k); });
    });

    // Keyboard (track is focusable).
    track.addEventListener('keydown', function (e) {
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown': e.preventDefault(); goTo(current + 1); break;
        case 'ArrowLeft':
        case 'PageUp':   e.preventDefault(); goTo(current - 1); break;
        case 'Home':     e.preventDefault(); goTo(0); break;
        case 'End':      e.preventDefault(); goTo(last); break;
        default: break;
      }
    });

    // NOTE: the wheel handler used to hijack vertical mouse-wheel into a
    // horizontal page-turn, which trapped page scroll when the cursor was
    // over the book (no "traction" to the page). Removed — the page now
    // scrolls normally over this section; the book is navigated via the
    // prev/next arrows, dots, keyboard, and native horizontal swipe/drag.

    // Re-centre the open leaf if the viewport resizes.
    var resizeTimer;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        var i = current;
        onScroll();
        if (i >= 0) {
          var leaf = leaves[i];
          track.scrollLeft = leaf.offsetLeft - (track.clientWidth - leaf.offsetWidth) / 2;
        }
      }, 150);
    });

    // Boot.
    setCurrent(0);
    onScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
