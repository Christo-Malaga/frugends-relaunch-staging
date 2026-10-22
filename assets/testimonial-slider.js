/* ══════════════════════════════════════════════════════════════════
   Testimonial slider — "Das sagen Spieler"
   Vanilla, Liquid-safe. Horizontal scroll-snap track driven by
   prev/next arrow buttons + clickable dots. Native scroll handles
   touch-drag/swipe; keyboard works via the focusable track and the
   real <button> controls. Respects reduced-motion (CSS side).
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function initSlider(root) {
    var track = root.querySelector('[data-voices-track]');
    var prev = root.querySelector('[data-voices-prev]');
    var next = root.querySelector('[data-voices-next]');
    var dotsWrap = root.querySelector('[data-voices-dots]');
    if (!track) return;

    var cards = Array.prototype.slice.call(track.children);
    if (!cards.length) return;

    // How many cards are (roughly) fully visible — used to disable arrows
    // at the ends and to build the right number of dot "pages".
    function step() {
      // distance from one card start to the next (incl. gap)
      if (cards.length < 2) return cards[0].offsetWidth;
      return cards[1].offsetLeft - cards[0].offsetLeft;
    }

    function maxScroll() {
      return track.scrollWidth - track.clientWidth;
    }

    // Build dots (one per card).
    var dots = [];
    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      cards.forEach(function (card, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'voices-dot';
        b.setAttribute('aria-label', 'Zu Stimme ' + (i + 1));
        b.addEventListener('click', function () {
          track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: 'smooth' });
        });
        dotsWrap.appendChild(b);
        dots.push(b);
      });
    }

    function nearestIndex() {
      var pos = track.scrollLeft;
      var best = 0;
      var bestDist = Infinity;
      cards.forEach(function (card, i) {
        var d = Math.abs((card.offsetLeft - track.offsetLeft) - pos);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    }

    function update() {
      var idx = nearestIndex();
      dots.forEach(function (d, i) {
        d.setAttribute('aria-current', i === idx ? 'true' : 'false');
      });
      var atStart = track.scrollLeft <= 2;
      var atEnd = track.scrollLeft >= maxScroll() - 2;
      if (prev) prev.disabled = atStart;
      if (next) next.disabled = atEnd;
    }

    if (prev) prev.addEventListener('click', function () {
      track.scrollBy({ left: -step(), behavior: 'smooth' });
    });
    if (next) next.addEventListener('click', function () {
      track.scrollBy({ left: step(), behavior: 'smooth' });
    });

    // Keyboard: arrow keys on the focused track move by one card.
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); track.scrollBy({ left: step(), behavior: 'smooth' }); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); track.scrollBy({ left: -step(), behavior: 'smooth' }); }
    });

    var ticking = false;
    track.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { update(); ticking = false; });
    });
    window.addEventListener('resize', update);

    update();
  }

  function boot() {
    var sliders = document.querySelectorAll('[data-voices-slider]');
    Array.prototype.forEach.call(sliders, initSlider);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
