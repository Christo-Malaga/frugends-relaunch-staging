/* ═══════════════════════════════════════════════════════════════════════════
   FRUGENDS — KOPF-VERHALTEN (Relaunch 2026-10, Builder A „Atlas“)
   Markup: sections/fg-shell-header.liquid · Gestalt: assets/fg-design.css §6

   1  (entfallen) Lesefortschritt: Runde 3 „nav2“ (Atlas 7, N1-NAV-SOTA.md) — die
      aktive Seite zeigt einen ruhenden Strich, kein Fortschritt mehr.
   2  Menü-Tafel (Handy): modaler Dialog (Schließen-Knopf im Dialog), ESC und Zurück
      schließen, Fokusfalle, Seite dahinter steht still.
   3  „App laden“ (Kopf und Menü-Tafel): iPhone/iPad → App Store, Android → Google Play (je mit
      Kennung), sonst das App-Fenster #app-modal (main.js initAppModal,
      window.FrugendsAppModal). Gerätelogik wie frontend/hero/Aufrufe.jsx.
   4  QR-Code im App-Fenster zeigt auf /?app=laden: Auf dem Handy geht es
      von dort sofort in den passenden Store (Kennung „qr“).
   5  Mini-Visuals der drei Wege (Kopf und Menü, fg-design.css §6): Zeiger
      und Tastaturfokus schaltet CSS selbst (:hover, :focus-visible). Hier nur
      .spielt für Tipp (Touch) und beim Öffnen des Menüs (die drei kurz
      nacheinander, als Antwort auf den Tipp); danach wieder Standbild. In Ruhe
      läuft nichts, kein Autostart. Reduzierte Bewegung: nur Standbilder.
   Ohne Abhängigkeiten, ES5-sicher wie main.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduziert = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function geraet() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
  }

  function melden(platz, ziel) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'fg_app_laden', fg_platz: platz, fg_ziel: ziel });
  }

  /* ─── 4 QR-Weiche (läuft vor allem anderen) ─── */
  function qrWeiche(kopf) {
    if (!/[?&]app=laden(&|$)/.test(location.search)) return false;
    var art = geraet();
    var ziel = art === 'ios' ? kopf.getAttribute('data-store-ios-qr')
             : art === 'android' ? kopf.getAttribute('data-store-android-qr') : null;
    if (!ziel) return false;
    melden('qr', art);
    location.replace(ziel);
    return true;
  }

  /* ─── 5 Mini-Visuals der drei Wege ─── */
  var MINI_MS = 900; // 600 ms hin (gestaffelt), kurz stehen, dann zurück ins Standbild
  function spielen(a) {
    if (reduziert || !a || a.classList.contains('spielt')) return;
    a.classList.add('spielt');
    window.setTimeout(function () { a.classList.remove('spielt'); }, MINI_MS);
  }
  function reihe(liste, start) {
    if (reduziert) return;
    for (var i = 0; i < liste.length; i++) {
      (function (a, t) { window.setTimeout(function () { spielen(a); }, t); })(liste[i], start + i * 130);
    }
  }
  function initMini() {
    var alle = document.querySelectorAll('[data-fg-mini]');
    function tipp(e) {
      if (e.pointerType === 'mouse') return;
      // Haptik beim Antippen (Android/Chrome; iOS-Safari hat keine Vibrations-Schnittstelle)
      if (!reduziert && navigator.vibrate) { try { navigator.vibrate(8); } catch (_) { /* nicht erlaubt */ } }
      spielen(e.currentTarget);
    }
    for (var i = 0; i < alle.length; i++) alle[i].addEventListener('pointerdown', tipp);
  }

  /* ─── 2 Menü-Tafel ─── */
  function initMenue() {
    var knopf = document.querySelector('[data-fg-burger]');
    var tafel = document.getElementById('fg-menue');
    if (!knopf || !tafel) return;
    // Schließen-Knopf IM Dialog (aria-modal: Elemente außerhalb sind für Screenreader gesperrt)
    var zu = tafel.querySelector('[data-fg-menue-zu]');

    var offen = false;
    var verlauf = false;      // liegt ein eigener Eintrag im Verlauf (für „Zurück“)?
    var ziel = null;          // Link, zu dem nach dem Schließen navigiert wird
    var timer = 0;
    var breit = window.matchMedia('(min-width: 1000px)');

    function fokussierbar() {
      var liste = [];
      var el = tafel.querySelectorAll('a[href], button:not([disabled])');
      for (var i = 0; i < el.length; i++) liste.push(el[i]);
      return liste;
    }

    function tasten(e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        schliessen(true);
        return;
      }
      if (e.key !== 'Tab') return;
      var f = fokussierbar();
      var erstes = f[0];
      var letztes = f[f.length - 1];
      var aktiv = document.activeElement;
      if (f.indexOf(aktiv) === -1) { e.preventDefault(); erstes.focus(); return; }
      if (e.shiftKey && aktiv === erstes) { e.preventDefault(); letztes.focus(); }
      else if (!e.shiftKey && aktiv === letztes) { e.preventDefault(); erstes.focus(); }
    }

    // Bilder der Menü-Visuals vorladen, sobald sich der Finger dem Menü-Knopf nähert (sie sind lazy)
    var minis = tafel.querySelectorAll('[data-fg-mini]');
    function vorladen() {
      var b = tafel.querySelectorAll('.fg-mini img[loading="lazy"]');
      for (var i = 0; i < b.length; i++) b[i].loading = 'eager';
    }
    knopf.addEventListener('pointerdown', vorladen);
    knopf.addEventListener('pointerenter', vorladen);
    knopf.addEventListener('focus', vorladen);

    function oeffnen() {
      if (offen) return;
      offen = true;
      window.clearTimeout(timer);
      tafel.hidden = false;
      // erst sichtbar, dann im nächsten Bild der Endzustand → die Tafel fährt ein
      void tafel.offsetHeight;
      tafel.classList.add('ist-offen');
      doc.classList.add('fg-menue-offen');
      knopf.setAttribute('aria-expanded', 'true');
      knopf.setAttribute('aria-label', 'Menü schließen');
      document.addEventListener('keydown', tasten, true);
      // Fokus in den Dialog (der Menü-Knopf im Kopf tritt zurück, an seiner Stelle steht der Schließen-Knopf)
      if (zu) zu.focus({ preventScroll: true });
      // Antwort aufs Öffnen: die drei Mini-Visuals spielen kurz nacheinander, wenn die Tafel fast steht
      reihe(minis, 280);
      try {
        history.pushState({ fgMenue: true }, '');
        verlauf = true;
      } catch (err) { verlauf = false; }
    }

    // ausVerlauf: true, wenn der Eintrag noch im Verlauf liegt und zurückgenommen werden soll
    function schliessen(fokusZurueck) {
      if (!offen) return;
      offen = false;
      tafel.classList.remove('ist-offen');
      doc.classList.remove('fg-menue-offen');
      knopf.setAttribute('aria-expanded', 'false');
      knopf.setAttribute('aria-label', 'Menü öffnen');
      document.removeEventListener('keydown', tasten, true);
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { if (!offen) tafel.hidden = true; }, reduziert ? 0 : 200);
      if (fokusZurueck) knopf.focus();
      if (verlauf) {
        verlauf = false;
        try { history.back(); } catch (err) { /* egal */ }
      }
    }

    knopf.addEventListener('click', function () {
      if (offen) schliessen(false);
      else oeffnen();
    });
    if (zu) zu.addEventListener('click', function () { schliessen(true); });

    // Zurück (Android-Taste, Wischgeste): schließt die Tafel statt die Seite zu verlassen
    window.addEventListener('popstate', function () {
      if (ziel) { var z = ziel; ziel = null; location.href = z; return; }
      if (offen) { verlauf = false; schliessen(false); }
    });

    // Link in der Tafel: erst den eigenen Verlaufseintrag zurücknehmen, dann gehen.
    // Sonst bräuchte „Zurück“ auf der Zielseite zwei Schritte.
    tafel.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      if (a.target === '_blank' || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        if (a.target === '_blank') schliessen(false);
        return;
      }
      if (!verlauf) { schliessen(false); return; }
      e.preventDefault();
      ziel = a.href;
      schliessen(false); // ruft history.back() → popstate → location.href = ziel
      window.setTimeout(function () { if (ziel) { var z = ziel; ziel = null; location.href = z; } }, 400);
    });

    function aufBreite() { if (breit.matches) { verlauf = false; schliessen(false); } }
    if (breit.addEventListener) breit.addEventListener('change', aufBreite);
    else if (breit.addListener) breit.addListener(aufBreite);

    // Aus dem Zurück-Cache wiederhergestellt: immer zu
    window.addEventListener('pageshow', function (e) {
      if (e.persisted && offen) { verlauf = false; schliessen(false); }
    });
  }

  /* ─── 3 „App laden“ ─── */
  function initApp() {
    var art = geraet();
    var knoepfe = document.querySelectorAll('[data-fg-app]');
    for (var i = 0; i < knoepfe.length; i++) {
      (function (el) {
        var platz = el.getAttribute('data-fg-app') || 'header';
        if (art === 'ios' || art === 'android') {
          var store = el.getAttribute(art === 'ios' ? 'data-store-ios' : 'data-store-android');
          if (store) {
            el.setAttribute('href', store);
            el.removeAttribute('aria-haspopup');
          }
          el.addEventListener('click', function () { melden(platz, art); });
          return;
        }
        el.addEventListener('click', function (e) {
          if (!window.FrugendsAppModal || !document.getElementById('app-modal')) return; // ohne Fenster: Link folgen
          e.preventDefault();
          melden(platz, 'auswahl');
          // Knopf in der Menü-Tafel (schmales Desktop-Fenster): erst die Tafel schließen, der Fokus kehrt danach
          // zum Menü-Knopf zurück (der Knopf in der Tafel ist dann verborgen)
          var tafel = el.closest ? el.closest('[data-fg-menue]') : null;
          if (tafel) {
            var zu = tafel.querySelector('[data-fg-menue-zu]');
            if (zu) zu.click();
          }
          window.FrugendsAppModal.open(tafel ? (document.querySelector('[data-fg-burger]') || el) : el);
        });
      })(knoepfe[i]);
    }
  }

  function start() {
    var kopf = document.querySelector('[data-fg-kopf]');
    if (kopf && qrWeiche(kopf)) return;
    initMenue();
    initApp();
    initMini();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
