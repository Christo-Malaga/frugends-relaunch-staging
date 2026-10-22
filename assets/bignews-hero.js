/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — Big News · Hero-Parallax (sections/fg-bignews-hero)

   Schreibt den Scroll-Fortschritt der gepinnten Hero-Bühne als CSS-
   Variable --p (0 … 1) auf die Section. Die Ebenen bewegen sich per
   calc(var(--p) …) in bignews-a.css unterschiedlich schnell.
   • passiver Scroll-Listener, rAF-gedrosselt
   • nur aktiv, solange die Section in Viewport-Nähe ist (IO)
   • reduced motion: nichts (die Section pinnt dann auch nicht)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function init(section) {
    var stage = section.querySelector('.bn-hero__stage');
    if (!stage) return;
    var ticking = false;
    var active = false;
    var last = -1;

    function update() {
      ticking = false;
      var rect = section.getBoundingClientRect();
      var travel = rect.height - stage.offsetHeight;
      var p = travel > 1 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0;
      p = Math.round(p * 1000) / 1000;
      if (p !== last) {
        last = p;
        section.style.setProperty('--p', p);
      }
    }
    function onScroll() {
      if (!active || ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        active = entries[0].isIntersecting;
        if (active) onScroll();
      }, { rootMargin: '100px 0px' }).observe(section);
    } else {
      active = true;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  function boot() {
    var list = document.querySelectorAll('[data-bn-hero]');
    for (var i = 0; i < list.length; i++) init(list[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
