/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — TCG card tilt + touch flip (vanilla, Liquid-safe)
   ───────────────────────────────────────────────────────────────
   Progressive enhancement for the Frugends-Helden section.

     · Pointer tilt is attached on EVERY device and simply ignores
       `touch` pointer events. This is deliberate: hybrid laptops
       (touchscreen + trackpad, e.g. Surface) report a coarse primary
       pointer, so gating the tilt behind `(hover:hover)` silently
       killed the 3D effect on exactly those machines. Now a mouse /
       trackpad always gets the ±7° tilt; a finger never does.
     · Touch: a tap toggles `.is-flipped` (there is no hover on touch).
       A tap anywhere outside clears every flip, so a card never stays
       "selected".
     · Keyboard / desktop hover: the CSS owns the art→card crossfade via
       :hover / :focus-visible — a mouse *click* no longer sticks the
       reveal (that was the old :focus-within behaviour).
     · prefers-reduced-motion: no tilt (touch flip still works).

   Pure enhancement — the CSS static + hover state works without JS.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var MAX = 7; // degrees

  function init() {
    var frames = document.querySelectorAll('.tcg-card__frame');
    if (!frames.length) return;

    Array.prototype.forEach.call(frames, function (frame) {
      var lastType = 'mouse';

      /* Pointer tilt — every device, touch pointers excluded. */
      if (!reduceMQ.matches) {
        frame.addEventListener('pointermove', function (e) {
          lastType = e.pointerType;
          if (e.pointerType === 'touch') return;
          var r = frame.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width;   // 0..1
          var py = (e.clientY - r.top) / r.height;   // 0..1
          frame.style.setProperty('--ry', ((px - 0.5) * 2 * MAX).toFixed(2) + 'deg');
          frame.style.setProperty('--rx', (-(py - 0.5) * 2 * MAX).toFixed(2) + 'deg');
        });
        frame.addEventListener('pointerleave', function () {
          frame.style.setProperty('--rx', '0deg');
          frame.style.setProperty('--ry', '0deg');
        });
      }

      /* Track the pointer type so the click handler only flips on touch. */
      frame.addEventListener('pointerdown', function (e) { lastType = e.pointerType; });

      /* Touch tap → toggle reveal. Desktop uses hover, so ignore mouse clicks. */
      frame.addEventListener('click', function () {
        if (lastType !== 'touch') return;
        var flipped = frame.classList.toggle('is-flipped');
        frame.setAttribute('aria-pressed', String(flipped));
      });
    });

    /* A touch anywhere outside the cards clears every flip → nothing
       stays "selected". */
    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      if (e.target.closest && e.target.closest('.tcg-card__frame')) return;
      Array.prototype.forEach.call(
        document.querySelectorAll('.tcg-card__frame.is-flipped'),
        function (f) { f.classList.remove('is-flipped'); f.setAttribute('aria-pressed', 'false'); }
      );
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
