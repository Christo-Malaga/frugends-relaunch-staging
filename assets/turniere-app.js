/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — Games & Turniere · Seitenkopf #app (sections/fg-game.liquid,
   Modus „app_kopf“). Relaunch 2026-10, H1 E8 + VX1 §5.2.

     1. Gold-Pille „App herunterladen“: iPhone/iPad → App Store,
        Android → Google Play (Links mit Kennung aus data-apple /
        data-google), sonst Store-Auswahl #app-modal über
        window.FrugendsAppModal (Atlas, main.js). Fehlt das Modal, folgt
        der Link dem App Store. Jeder Klick schreibt ein Ereignis in den
        dataLayer (wie hero/Aufrufe.jsx).
     2. Gameplay-Video: stumm, startet erst im Bild, läuft zwei Mal und
        bleibt dann als Standbild stehen (data-still in Sekunden). Pause-
        Knopf (WCAG 2.2.2), pausiert auch außerhalb des Bildes. Bei
        prefers-reduced-motion bleibt das Poster stehen, der Knopf startet
        auf Wunsch.
     3. Tür-Morph: die Winner Box trägt view-transition-name fg-box (CSS).
        Beim Verlassen der Seite gibt sie den Namen ab, damit eine Tür-Box
        ihn übernehmen kann (keine doppelten Namen).
     4. Kartenspiel-Bühne #spiele (Runde 3): beim ersten Sichtkontakt
        fächern sich die Karten auf (.is-bereit → .is-da, nur CSS-Transition,
        einmal). Das In-Game-Video läuft nur im Bild, höchstens vier Mal,
        dann Standbild; Pause-Knopf wie oben. Reduzierte Bewegung: Endlage.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__fgTurniereApp) return;
  window.__fgTurniereApp = true;

  function geraet() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
  }

  function melden(ziel) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'fgi_cta', fgi_anlass: 'app-turniere', fgi_ziel: ziel });
  }

  function initCta(root) {
    var art = geraet();
    Array.prototype.forEach.call(root.querySelectorAll('[data-tg-app-cta]'), function (a) {
      if (art === 'ios') a.href = a.getAttribute('data-apple');
      else if (art === 'android') a.href = a.getAttribute('data-google');
      else a.setAttribute('aria-haspopup', 'dialog');
      a.addEventListener('click', function (e) {
        if (art !== 'desktop') { melden(art === 'ios' ? 'apple' : 'google'); return; }
        if (window.FrugendsAppModal && document.getElementById('app-modal')) {
          e.preventDefault();
          melden('auswahl');
          window.FrugendsAppModal.open(a);
        } else {
          melden('apple');
        }
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll('.tg-stores a'), function (a) {
      a.addEventListener('click', function () { melden(/apple/.test(a.href) ? 'apple' : 'google'); });
    });
  }

  function initVideo(v, btn, maxRuns) {
    if (!v || !btn) return;
    var label = btn.querySelector('[data-tg-pause-label]');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var still = parseFloat(v.getAttribute('data-still')) || 0;
    var runs = 0;
    var MAX_RUNS = maxRuns || 2;
    var userPaused = reduce;   // reduzierte Bewegung: nichts startet von selbst
    var finished = false;
    var visible = false;

    function setBtn(playing) {
      btn.setAttribute('aria-pressed', String(!playing));
      btn.classList.toggle('is-paused', !playing);
      if (label) label.textContent = playing ? 'Video anhalten' : (finished ? 'Video noch einmal abspielen' : 'Video abspielen');
    }

    function play() {
      if (v.preload === 'none') v.preload = 'auto';
      var p = v.play();
      if (p && p.catch) p.catch(function () { setBtn(false); });
    }

    function toStill() {
      finished = true;
      try { v.currentTime = still; } catch (e) {}
      v.pause();
      setBtn(false);
    }

    v.addEventListener('play', function () { setBtn(true); });
    v.addEventListener('pause', function () { setBtn(false); });
    v.addEventListener('ended', function () {
      runs += 1;
      if (runs < MAX_RUNS && !userPaused) {
        v.currentTime = 0;
        play();
      } else {
        toStill();
      }
    });

    btn.hidden = false;
    setBtn(false);
    btn.addEventListener('click', function () {
      if (v.paused) {
        userPaused = false;
        if (finished) { finished = false; runs = 0; try { v.currentTime = 0; } catch (e) {} }
        play();
      } else {
        userPaused = true;
        v.pause();
      }
    });

    if (!('IntersectionObserver' in window)) { if (!userPaused) play(); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        visible = en.isIntersecting;
        if (visible && !userPaused && !finished) play();
        else if (!visible && !v.paused) v.pause();
      });
    }, { threshold: 0.35 }).observe(v);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && !v.paused) v.pause();
      else if (!document.hidden && visible && !userPaused && !finished) play();
    });
  }

  function initMorph(root) {
    var box = root.querySelector('[data-tg-box]');
    if (!box) return;
    window.addEventListener('pageswap', function () { box.style.viewTransitionName = 'none'; });
    window.addEventListener('pageshow', function () { box.style.viewTransitionName = ''; });
  }

  /* 4 · Kartenspiel-Bühne: Auffächern beim ersten Sichtkontakt (einmal) */
  function initTcg(show) {
    initVideo(show.querySelector('[data-tg-tcg-video]'), show.querySelector('[data-tg-tcg-pause]'), 4);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) return;
    var r = show.getBoundingClientRect();
    if (r.top < (window.innerHeight || 800) * 0.8 && r.bottom > 0) return;   // schon im Bild: Endlage, kein Sprung
    show.classList.add('is-bereit');
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      requestAnimationFrame(function () { show.classList.add('is-da'); });
    }, { threshold: 0.35 });
    io.observe(show);
  }

  function init() {
    var root = document.querySelector('[data-tg-app]');
    if (root) {
      initCta(root);
      initVideo(root.querySelector('[data-tg-video]'), root.querySelector('[data-tg-pause]'), 2);
      initMorph(root);
    }
    var show = document.querySelector('[data-tg-show]');
    if (show) initTcg(show);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
