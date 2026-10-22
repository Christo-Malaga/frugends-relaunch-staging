/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — TEAM BIOS
   Desktop (fine pointer): bio pops up next to the cursor on hover
   (and on keyboard focus). Mobile / coarse pointer: tap a card to
   toggle the bio; tap outside or scroll to dismiss. Bios live in
   each card's data-bio attribute (also mirrored visually-hidden
   for no-JS / screen readers).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function init() {
    var pop = document.getElementById('team-pop');
    if (!pop) return;
    var txt = pop.querySelector('.team-pop__text');
    var cards = Array.prototype.slice.call(document.querySelectorAll('.team-card--bio'));
    if (!cards.length) return;
    var coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    var openCard = null;

    function show(card) { txt.textContent = card.getAttribute('data-bio') || ''; pop.hidden = false; pop.getBoundingClientRect(); pop.classList.add('is-visible'); }
    function hide() { pop.classList.remove('is-visible'); pop.hidden = true; openCard = null; }
    function moveTo(x, y) {
      var pw = pop.offsetWidth, ph = pop.offsetHeight, m = 14;
      var left = x + 16, top = y + 16;
      if (left + pw + m > window.innerWidth) left = x - pw - 16;
      if (left < m) left = m;
      if (top + ph + m > window.innerHeight) top = y - ph - 16;
      if (top < m) top = m;
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
    }
    function centerOn(card) {
      var r = card.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, m = 12;
      var left = Math.max(m, Math.min(r.left + r.width / 2 - pw / 2, window.innerWidth - pw - m));
      var top = r.bottom + 10;
      if (top + ph + m > window.innerHeight) top = r.top - ph - 10;
      pop.style.left = left + 'px'; pop.style.top = Math.max(m, top) + 'px';
    }

    if (coarse) {
      cards.forEach(function (card) {
        card.addEventListener('click', function () {
          if (openCard === card) { hide(); return; }
          openCard = card; show(card); centerOn(card);
        });
      });
      document.addEventListener('click', function (e) { if (openCard && !e.target.closest('.team-card--bio')) hide(); });
      window.addEventListener('scroll', function () { if (openCard) hide(); }, { passive: true });
    } else {
      cards.forEach(function (card) {
        card.addEventListener('pointerenter', function (e) { if (e.pointerType === 'touch') return; show(card); moveTo(e.clientX, e.clientY); });
        card.addEventListener('pointermove',  function (e) { if (e.pointerType === 'touch') return; moveTo(e.clientX, e.clientY); });
        card.addEventListener('pointerleave', function (e) { if (e.pointerType === 'touch') return; hide(); });
        card.addEventListener('focus', function () { show(card); centerOn(card); });
        card.addEventListener('blur', hide);
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(card); centerOn(card); } });
      });
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
