/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — SURPRISE BOX (nachgeahmte Produktseite, Relaunch 2026-10)
   ───────────────────────────────────────────────────────────────
   Verhalten von sections/fg-surprise-produkt.liquid. Kein Produkt,
   kein Warenkorb: nur Galerie, Röntgenlicht, Benachrichtigen-Formular
   und die Leiste unten (Handy). Den Creator-Orbit startet die Insel
   assets/fgi-surprise.js (frontend/insel-surprise.jsx).

   1  Galerie   initSlider aus assets/product.js (Shop deaktiviert, dort
                auskommentiert), umgestellt auf scroll-snap: Wischen ist
                natives Scrollen, Pfeile/Punkte/Tasten springen zum Bild.
   2  Röntgen   VX1 P4: Linse folgt Zeiger/Finger (120 ms linear, nur
                transform), Pfeiltasten verschieben, Ruhe auf der Fuge.
                Unter der Linse liegt die gepackte Box (business-Foto).
   3  Formular  Aufklapper (<details>) öffnet sich nach dem Absenden
                (?customer_posted=true) oder bei Fehlern; Prüfen vor dem
                Absenden.
   4  Leiste    buybar aus product.js: sichtbar, wenn der Kaufbereich
                oben aus dem Bild ist und weder Formular noch Fuß drin
                sind. Die Pille öffnet das Formular und setzt den Fokus.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduziert = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  /* ── 1 Galerie ── */
  function initSlider(root) {
    var vp = root.querySelector('[data-slider-viewport]');
    var slides = Array.prototype.slice.call(root.querySelectorAll('[data-slider-slide]'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('[data-slider-dot]'));
    var prev = root.querySelector('[data-slider-prev]');
    var next = root.querySelector('[data-slider-next]');
    if (!vp || !slides.length) return;
    var i = 0;

    function render() {
      dots.forEach(function (d, k) {
        d.classList.toggle('is-active', k === i);
        d.setAttribute('aria-current', k === i ? 'true' : 'false');
      });
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === slides.length - 1;
      root.setAttribute('data-folie', String(i + 1));
    }
    function go(k) {
      k = Math.max(0, Math.min(slides.length - 1, k));
      vp.scrollTo({ left: slides[k].offsetLeft, behavior: reduziert() ? 'auto' : 'smooth' });
      i = k;
      render();
    }

    if (prev) prev.addEventListener('click', function () { go(i - 1); });
    if (next) next.addEventListener('click', function () { go(i + 1); });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { go(k); }); });
    vp.addEventListener('keydown', function (e) {
      if (e.target !== vp) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
    });

    // Aktives Bild aus der Scroll-Lage (Wischen, Trackpad, Tab in einen Link der Folie)
    var t = 0;
    vp.addEventListener('scroll', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var k = Math.round(vp.scrollLeft / Math.max(1, vp.clientWidth));
        if (k !== i) { i = Math.max(0, Math.min(slides.length - 1, k)); render(); }
      }, 60);
    }, { passive: true });

    render();
    root.classList.add('ist-bereit');
  }

  /* ── 2 Röntgen ── */
  function initRoentgen(el) {
    var box = el.querySelector('.sb-roe__box');
    if (!box) return;
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    // Ruhe: auf der Fuge zwischen den Deckelklappen (box-zu.webp 900 × 675, Mitte der Fuge ≈ 440/85)
    var RUHE = { x: 440 / 900, y: 92 / 675 };
    var pos = { x: RUHE.x, y: RUHE.y };
    var aktiv = false;

    function setzen() {
      var w = box.clientWidth;
      var h = box.clientHeight;
      box.style.setProperty('--lx', (pos.x * w).toFixed(1) + 'px');
      box.style.setProperty('--ly', (pos.y * h).toFixed(1) + 'px');
    }
    function modus() {
      var an = !(mq && mq.matches);
      el.classList.toggle('sb-roe--linse', an);
      if (an) setzen();
    }
    function ruhe() { pos.x = RUHE.x; pos.y = RUHE.y; aktiv = false; el.classList.remove('ist-aktiv'); setzen(); }
    function folgen(e) {
      if (!el.classList.contains('sb-roe--linse')) return;
      var r = box.getBoundingClientRect();
      pos.x = Math.max(-0.05, Math.min(1.05, (e.clientX - r.left) / r.width));
      pos.y = Math.max(-0.05, Math.min(1.05, (e.clientY - r.top) / r.height));
      if (!aktiv) { aktiv = true; el.classList.add('ist-aktiv'); }
      setzen();
    }

    el.addEventListener('pointermove', folgen);
    el.addEventListener('pointerdown', folgen);
    el.addEventListener('pointerleave', ruhe);
    el.addEventListener('pointercancel', ruhe);
    el.addEventListener('keydown', function (e) {
      var schritt = e.shiftKey ? 0.12 : 0.06;
      var d = { ArrowLeft: [-schritt, 0], ArrowRight: [schritt, 0], ArrowUp: [0, -schritt], ArrowDown: [0, schritt] }[e.key];
      if (e.key === 'Escape' || e.key === 'Home') { e.preventDefault(); ruhe(); return; }
      if (!d || !el.classList.contains('sb-roe--linse')) return;
      e.preventDefault();
      e.stopPropagation();
      pos.x = Math.max(0, Math.min(1, pos.x + d[0]));
      pos.y = Math.max(0, Math.min(1, pos.y + d[1]));
      el.classList.add('ist-aktiv');
      setzen();
    });
    el.addEventListener('blur', function () { if (!aktiv) el.classList.remove('ist-aktiv'); });

    if (mq && mq.addEventListener) mq.addEventListener('change', modus);
    if ('ResizeObserver' in window) new ResizeObserver(setzen).observe(box);
    modus();
  }

  /* ── 3 Formular ── */
  function initFormular(form) {
    var felder = form.querySelector('[data-sb-felder]');
    var erfolg = form.querySelector('[data-sb-erfolg]');
    var email = form.querySelector('input[type="email"]');
    var ok = form.querySelector('input[type="checkbox"]');
    var fehlerEmail = form.querySelector('[data-sb-fehler="email"]');
    var fehlerOk = form.querySelector('[data-sb-fehler="ok"]');
    if (!email || !ok) return;

    var auf = form.querySelector('[data-sb-melden]');
    // Lokale Vorschau rendert form.posted_successfully? nie: Shopify hängt ?customer_posted=true an
    if (/[?&]customer_posted=true/.test(location.search) && erfolg && erfolg.hidden) {
      if (felder) felder.hidden = true;
      var titel = form.querySelector('[data-sb-titel]');
      if (titel) titel.hidden = true;
      erfolg.hidden = false;
    }
    if (auf && erfolg && !erfolg.hidden) auf.open = true;
    if (erfolg && !erfolg.hidden && location.hash === '#sb-benachrichtigen') {
      try { erfolg.focus({ preventScroll: false }); } catch (e) { /* alt */ }
    }

    form.noValidate = true;
    var pruefen = function (feld, fehler, gueltig) {
      if (!fehler) return gueltig;
      fehler.hidden = gueltig;
      if (gueltig) feld.removeAttribute('aria-invalid');
      else feld.setAttribute('aria-invalid', 'true');
      return gueltig;
    };
    var emailGut = function () {
      var v = email.value.trim();
      return v !== '' && email.checkValidity() && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    };
    form.addEventListener('submit', function (e) {
      if (fehlerEmail && fehlerEmail.getAttribute('data-sb-standard')) fehlerEmail.textContent = fehlerEmail.getAttribute('data-sb-standard');
      var a = pruefen(email, fehlerEmail, emailGut());
      var b = pruefen(ok, fehlerOk, ok.checked);
      if (!a || !b) {
        e.preventDefault();
        (a ? ok : email).focus();
      }
    });
    email.addEventListener('input', function () { if (email.getAttribute('aria-invalid') && emailGut()) pruefen(email, fehlerEmail, true); });
    ok.addEventListener('change', function () { if (ok.checked) pruefen(ok, fehlerOk, true); });
  }

  /* ── 4 Leiste unten (Handy) ── */
  function initLeiste(root) {
    var leiste = root.querySelector('[data-buybar]');
    var ziel = root.querySelector('#benachrichtigen');
    var kauf = root.querySelector('[data-sb-kauf]');
    if (!leiste || !ziel) return;
    var kaufOben = false;   // Kaufbereich oben aus dem Bild (vorbeigescrollt)
    var formSicht = false;
    var fussSicht = false;
    var stellen = function () {
      var an = kaufOben && !formSicht && !fussSicht;
      leiste.classList.toggle('is-visible', an);
      leiste.setAttribute('aria-hidden', an ? 'false' : 'true');
      leiste.inert = !an;
    };
    stellen();
    if ('IntersectionObserver' in window) {
      // Kaufbereich über die Lage beim Scrollen (ein Sprung von unterhalb nach oberhalb kreuzt das Bild nicht,
      // ein IntersectionObserver meldet ihn dann nicht)
      if (kauf) {
        var wartet = false;
        var lage = function () {
          wartet = false;
          var oben = kauf.getBoundingClientRect().bottom < 0;
          if (oben !== kaufOben) { kaufOben = oben; stellen(); }
        };
        window.addEventListener('scroll', function () {
          if (!wartet) { wartet = true; requestAnimationFrame(lage); }
        }, { passive: true });
        lage();
      }
      new IntersectionObserver(function (es) {
        formSicht = es[0].isIntersecting;
        stellen();
      }, { rootMargin: '0px 0px -10% 0px' }).observe(ziel);
      var fuss = document.querySelector('.fg-fuss');
      if (fuss) new IntersectionObserver(function (es) { fussSicht = es[0].isIntersecting; stellen(); }).observe(fuss);
    }
    // Pille in der Leiste: Formular aufklappen, hinscrollen, Fokus ins E-Mail-Feld
    var knopf = leiste.querySelector('[data-sb-zum-formular]');
    if (knopf) knopf.addEventListener('click', function (e) {
      var auf = ziel.querySelector('[data-sb-melden]');
      if (auf) auf.open = true;
      var feld = ziel.querySelector('input[type="email"]');
      e.preventDefault();
      ziel.scrollIntoView({ behavior: reduziert() ? 'auto' : 'smooth', block: 'center' });
      if (!feld || feld.closest('[hidden]')) return;
      setTimeout(function () { try { feld.focus({ preventScroll: true }); } catch (x) { feld.focus(); } }, reduziert() ? 0 : 420);
    });
  }

  /* ── 5 Seitenübergang: die Box der Galerie trägt view-transition-name fg-box (Ziel des Tür-Morphs, .fg-vt-box).
        Verlässt man die Seite, morpht sie nur zurück zur Startseite; sonst gibt sie den Namen frei, damit die
        angeklickte Tür (Türen-Insel) oder das Ziel der Kopf-Navigation ihn allein trägt (doppelte Namen brechen den
        Übergang ab). ── */
  function initUebergang(root) {
    var box = root.querySelector('.fg-vt-box');
    if (!box) return;
    window.addEventListener('pageswap', function (e) {
      var ziel = '';
      try { ziel = e.activation && e.activation.entry ? new URL(e.activation.entry.url).pathname : ''; } catch (x) { ziel = ''; }
      if (ziel !== '/' && ziel !== new URL('./', document.baseURI).pathname.replace(/pages\/[^/]+\/$/, '')) box.style.viewTransitionName = 'none';
    });
    window.addEventListener('pageshow', function () { box.style.viewTransitionName = ''; });
  }

  function init() {
    var root = document.querySelector('[data-fg-sb]');
    if (!root) return;
    var slider = root.querySelector('[data-slider]');
    if (slider) initSlider(slider);
    Array.prototype.forEach.call(root.querySelectorAll('[data-sb-roentgen]'), initRoentgen);
    var form = root.querySelector('[data-sb-form]');
    if (form) initFormular(form);
    initLeiste(root);
    initUebergang(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
