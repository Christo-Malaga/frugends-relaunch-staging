/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — WAHRE HELDEN · Attention-Puls für die Vorschau-Buttons
   ───────────────────────────────────────────────────────────────
   Auf der Heldenseite stehen vier identische „Vorschau anzeigen“-
   Buttons — einer je Brand-Campaign-Slot (4 pro Monat, E19). Alle
   gleichzeitig pulsieren zu lassen wäre Lärm — also feuert immer
   nur EINER, zufällig gewählt aus denen, die gerade im Sichtfeld
   sind, in zufälligen Abständen.

   Regeln:
     · nur sichtbare Buttons (IntersectionObserver)
     · nie zweimal hintereinander derselbe
     · Hover/Fokus wird übersprungen (nicht ins Handeln grätschen)
     · Pause, wenn der Tab im Hintergrund liegt
     · prefers-reduced-motion → gar nichts

   Die Datei kann mehrfach eingebunden werden;
   der Guard unten sorgt dafür, dass sie trotzdem einmal läuft.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (window.__fgHeldenFx) return;
  window.__fgHeldenFx = true;

  var MIN_GAP = 1400;   // ms
  var MAX_GAP = 3400;   // ms

  function init() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-hh-attention]'));
    if (buttons.length < 2) return;   // bei einem einzelnen Button wirkt es wie ein Fehler

    var visible = [];
    var last = null;
    var timer = null;

    if (!('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = visible.indexOf(e.target);
        if (e.isIntersecting && i === -1) visible.push(e.target);
        else if (!e.isIntersecting && i !== -1) visible.splice(i, 1);
      });
      schedule();
    }, { threshold: 0.55 });

    buttons.forEach(function (b) { io.observe(b); });

    function pick() {
      var pool = visible.filter(function (b) {
        if (b === last && visible.length > 1) return false;
        if (b.classList.contains('is-attention')) return false;
        if (b === document.activeElement) return false;
        if (b.matches(':hover')) return false;
        return true;
      });
      if (!pool.length) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    function fire() {
      timer = null;
      if (!document.hidden) {
        var btn = pick();
        if (btn) {
          last = btn;
          btn.classList.add('is-attention');
          var done = function () {
            btn.classList.remove('is-attention');
            btn.removeEventListener('animationend', done);
          };
          btn.addEventListener('animationend', done);
          // Fallback, falls animationend verschluckt wird (Tab-Wechsel o. ä.)
          window.setTimeout(done, 1600);
        }
      }
      schedule();
    }

    function schedule() {
      if (timer !== null) return;
      if (!visible.length || document.hidden) return;
      timer = window.setTimeout(fire, MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP));
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (timer !== null) { window.clearTimeout(timer); timer = null; }
      } else {
        schedule();
      }
    });

    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
