/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — TURNIERE PAGE FX  (vanilla, Liquid-safe, no framework)
   ───────────────────────────────────────────────────────────────
   Two page-local behaviours:

     1. Coming-soon CTAs  → [data-soon] buttons in "Bald geht's los!"
        are not links. On click they flip to a greyed-out "lights off"
        state (cyan → muted) with a single flicker, once. Guarded so a
        second click does nothing. Reduced-motion skips the flicker.

     2. Prize marquee     → [data-marquee] auto-scrolls a duplicated
        logo strip via CSS; this adds pointer-drag (grab/scrub) with a
        seamless wrap, pausing the CSS animation while dragging and
        resuming it from the current offset without a jump.

   No globals leak; guards if the elements are absent. In the Shopify
   port this file ships as-is (DOM-only).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Mehrere Sections binden diese Datei ein (jedes <script src> führt
     eigenständig aus) — ohne Guard hingen Drag- und Click-Listener
     mehrfach am selben Element. */
  if (window.__fgTurniereFx) return;
  window.__fgTurniereFx = true;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── 1. Coming-soon CTAs ─────────────────────────────────────── */
  function initComingSoon() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-soon]') : null;
      if (!btn) return;
      e.preventDefault();
      if (btn.classList.contains('is-off')) return; // already switched off
      btn.classList.add('is-off');
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('aria-label', 'Coming soon');
      if (!reduce) {
        btn.classList.add('is-flicker');
        btn.addEventListener('animationend', function once() {
          btn.classList.remove('is-flicker');
          btn.removeEventListener('animationend', once);
        });
      }
    });
  }

  /* ─── 2. Prize marquee drag ───────────────────────────────────── */
  function currentX(node) {
    var t = window.getComputedStyle(node).transform;
    if (!t || t === 'none') return 0;
    try { return new DOMMatrixReadOnly(t).m41; } catch (err) { return 0; }
  }

  function initMarquee(el) {
    var track = el.querySelector('[data-marquee-track]');
    if (!track) return;

    if (reduce) { track.style.animation = 'none'; } // no auto-scroll; drag still works

    var dragging = false, startX = 0, baseX = 0, groupW = 0, pid = null;

    function onDown(e) {
      dragging = true;
      el.classList.add('is-drag');
      startX = e.clientX;
      baseX = currentX(track);
      var g = track.firstElementChild;
      groupW = g ? g.getBoundingClientRect().width : track.getBoundingClientRect().width / 2;
      track.style.animation = 'none';
      track.style.transform = 'translateX(' + baseX + 'px)';
      try { el.setPointerCapture(e.pointerId); pid = e.pointerId; } catch (err) {}
    }

    function onMove(e) {
      if (!dragging) return;
      var x = baseX + (e.clientX - startX);
      if (groupW > 0) { x = ((x % groupW) + groupW) % groupW - groupW; } // wrap into [-groupW, 0]
      track.style.transform = 'translateX(' + x + 'px)';
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('is-drag');
      if (pid !== null) { try { el.releasePointerCapture(pid); } catch (err) {} pid = null; }
      if (reduce) return;
      var x = currentX(track);
      track.style.transform = '';
      track.style.animation = '';          // restore the CSS rule
      if (groupW > 0) {
        var frac = Math.abs(x % groupW) / groupW;   // 0..1 within one group
        // Dauer aus dem CSS lesen statt hart annehmen — .pz-marquee und
        // .hh-marquee dürfen unterschiedlich schnell laufen.
        var dur = parseFloat(window.getComputedStyle(track).animationDuration) || 32;
        track.style.animationDelay = (-frac * dur) + 's'; // nahtloser Wiedereinstieg
      }
    }

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onUp);
    // don't let an image drag-ghost hijack the gesture
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }

  /* ─── 3. Sticky channel nav — scrollspy + smooth jump ────────── */

  /* Sprung über Scroll-Szenen (Pietro, Winner-Box-Bühne 2026-09-30):
     Elemente mit [data-scroll-skip] (Burst-Spur der Rewards-Bühne) sind
     Szenen, die man nicht im Schnelldurchlauf sehen soll — ein Smooth-
     Scroll quer durch die Spur jagt Box, Explosion und Weißblitz in unter
     einer Sekunde durch. Liegt eine solche Spur zwischen aktueller Position
     und Ziel (oder steht man mitten darin), springt die Seite sofort.
     Zone = alle Scrollpositionen, in denen die Spur im Bild ist, bis sie
     endet: [top − vh, bottom − vh]. Ohne Live-Modus ist die Spur
     display:none (Höhe 0) und zählt nicht. */
  function jumpBehavior(target) {
    if (reduce) return 'auto';
    var y0 = window.scrollY || window.pageYOffset || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var margin = parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
    var y1 = target.getBoundingClientRect().top + y0 - margin;
    var lo = Math.min(y0, y1), hi = Math.max(y0, y1);
    var zones = document.querySelectorAll('[data-scroll-skip]');
    for (var i = 0; i < zones.length; i++) {
      var r = zones[i].getBoundingClientRect();
      if (!r.height) continue;
      var zs = r.top + y0 - vh, ze = r.bottom + y0 - vh;
      if (hi > zs && lo < ze) return 'auto';
    }
    return 'smooth';
  }

  function initChannelNav() {
    var nav = document.querySelector('[data-channelnav]');
    if (!nav) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('[data-channel-link]'));
    if (!links.length) return;

    /* Scrollspy-Zonen: Ein Sprungziel mit [data-spy-zone="<Selektor>"]
       zählt für den Spy als der umschließende Bereich (Rewards: #preise
       liegt im Endbild der Bühne, der Spy zählt Spur A, Spur B und den
       Fluss darunter, also die ganze .tn-rewards-Section). */
    var spy = [];
    links.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var sec = document.getElementById(id);
      if (sec) {
        var zoneSel = sec.getAttribute('data-spy-zone');
        var zone = (zoneSel && sec.closest && sec.closest(zoneSel)) || sec;
        spy.push({ el: zone, link: a });
        /* Runde 3: ein Kapitel aus mehreren Sections (Spiele = Kartenspiel + Game Nr. 2) */
        var extra = sec.getAttribute('data-spy-extra');
        if (extra) {
          Array.prototype.forEach.call(document.querySelectorAll(extra), function (x) { spy.push({ el: x, link: a }); });
        }
      }
      // jump that respects the sticky offset (CSS scroll-margin-top):
      // smooth, außer eine Scroll-Szene liegt auf dem Weg (dann sofort)
      a.addEventListener('click', function (e) {
        if (!sec) return;
        e.preventDefault();
        sec.scrollIntoView({ behavior: jumpBehavior(sec), block: 'start' });
        if (history.replaceState) history.replaceState(null, '', '#' + id);
      });
    });

    if (!('IntersectionObserver' in window)) return;
    function setActive(link) {
      links.forEach(function (l) { l.classList.remove('is-active'); l.removeAttribute('aria-current'); });
      if (link) { link.classList.add('is-active'); link.setAttribute('aria-current', 'true'); }
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        for (var i = 0; i < spy.length; i++) {
          if (spy[i].el === e.target) { setActive(spy[i].link); return; }
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    spy.forEach(function (s) { io.observe(s.el); });

    initChannelNavReveal(nav);
  }

  /* Chris 2026-10-22: Subnav vorher nie sichtbar, Fade-in genau beim Kleben.
     .is-stuck sobald die Leiste an ihrer sticky-Kante (CSS top) anliegt; beim
     Zurückscrollen erst wieder weg, wenn sie > 12 px unter der Kante liegt
     (Hysterese gegen Flackern an der Grenze). Fade/Slide macht das CSS.
     .is-visible bleibt für ältere Selektoren erhalten. */
  function initChannelNavReveal(nav) {
    nav.classList.add('is-visible');
    var stuck = false;
    var queued = false;
    function check() {
      queued = false;
      // Lage ohne den eigenen Slide (transform) gegen die sticky-Kante messen
      var cs = getComputedStyle(nav);
      var edge = parseFloat(cs.top) || 0;
      var ty = 0;
      if (cs.transform && cs.transform !== 'none' && window.DOMMatrixReadOnly) ty = new DOMMatrixReadOnly(cs.transform).m42;
      var d = nav.getBoundingClientRect().top - ty - edge;
      var next = stuck ? d <= 12 : d <= 1;
      if (next !== stuck) { stuck = next; nav.classList.toggle('is-stuck', stuck); }
    }
    function onScroll() { if (!queued) { queued = true; requestAnimationFrame(check); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    check();
  }

  function init() {
    initComingSoon();
    initChannelNav();
    Array.prototype.forEach.call(document.querySelectorAll('[data-marquee]'), initMarquee);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
