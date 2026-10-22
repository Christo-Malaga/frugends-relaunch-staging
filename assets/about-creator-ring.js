/* ═══════════════════════════════════════════════════════════════════════════
   FRUGENDS — ÜBER UNS · Creator-Ring um Elias (sections/fg-about-creator-ring)
   Der eine orchestrierte Moment der Seite (H1 §2, VX1 §5.5, §6, M3 + M4).

   1  Messen: Elias' Karte in der Insel fg-island-elias (.fge__karte, ohne
      Neigung gemessen) bestimmt den Ring: flache Ellipse mit der Proportion
      aller Ringe (--ring-neigung 0,36), etwas breiter als die Karte, die
      Vorderkante knapp unter dem Kartenfuß.
   2  Tiefe: jedes Teil steht zweimal da, hinter der Karte (Ebene „hinten“)
      und davor („vorn“); sichtbar ist die Ebene seiner Ringhälfte. Die
      Hälften wechseln an den Seiten des Rings, wo kein Teil die Karte
      berührt. Hinten kleiner und dunkler, vorn größer.
   3  Runde: beim Sichtbarwerden laufen die Teile einmal über den Ring in ihre
      Ruhelage, Ring und Licht blenden auf. Unter 5 s (WCAG 2.2.2), dann
      steht alles. Nur transform, opacity, z-index (VX1 §3.4 Nr. 7).
   4  Reduzierte Bewegung, kein IntersectionObserver, Größenwechsel nach der
      Runde: Standbild in Ruhelage.
   Die Insel bleibt unberührt: der Ring liegt in seiner eigenen Section und
   misst nur. Ohne Abhängigkeiten, ES5-nah wie fg-nav.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var NEIGUNG = 0.36;            // Höhe : Breite aller Ringe (fg-design.css --ring-neigung)
  var DAUER = 3500;              // ms je Teil
  var STAFFEL = 120;             // ms Versatz je Teil (8 Teile: letzter endet nach 4,34 s)
  var SCHRITTE = 48;             // Stützstellen der Bahn je Teil
  var GRAD = Math.PI / 180;

  function ausgang(t) { return 1 - Math.pow(1 - t, 3); } // kommt an, ohne Überschwingen

  function init(host) {
    if (host.__fgaRing) return;
    host.__fgaRing = true;
    var insel = document.querySelector('[data-fg-island="elias"]');
    var licht = host.querySelector('[data-ebene="licht"]');
    var hinten = host.querySelector('[data-ebene="hinten"]');
    if (!insel || !licht || !hinten) return;

    var vorn = hinten.cloneNode(true);
    vorn.setAttribute('data-ebene', 'vorn');
    vorn.className = 'fga-ring__ebene fga-ring__ebene--vorn';
    host.appendChild(vorn);

    var teileH = Array.prototype.slice.call(hinten.querySelectorAll('.fga-ring__teil'));
    var teileV = Array.prototype.slice.call(vorn.querySelectorAll('.fga-ring__teil'));
    var boegen = [hinten.querySelector('[data-bogen]'), vorn.querySelector('[data-bogen]')];
    var bahnen = [hinten.querySelector('.fga-ring__bahn'), vorn.querySelector('.fga-ring__bahn')];
    var schein = licht.querySelector('[data-licht="schein"]');
    var boden = licht.querySelector('[data-licht="boden"]');

    var ruhe = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var kannAnimieren = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
    var zustand = (ruhe || !kannAnimieren || typeof IntersectionObserver === 'undefined') ? 'still' : 'wartet';
    var g = null;            // Geometrie
    var laeufe = [];         // laufende Animationen

    function messen() {
      var karte = insel.querySelector('.fge__karte');
      var rahmen = insel.querySelector('.fge-rahmen');
      if (!karte || !rahmen) return null;
      var k = karte.getBoundingClientRect();
      var h = host.getBoundingClientRect();
      var W = k.width;
      var H = rahmen.offsetHeight;
      if (!W || !H) return null;
      // Platz neben der Karte: links bis zum Rand; rechts bis zum Text (zweispaltig) oder bis zum Rand (Handy)
      var text = insel.querySelector('.fge__text');
      var t = text ? text.getBoundingClientRect() : null;
      var links = k.left - h.left - 4;
      var rechts = (t && t.left >= k.right - 1) ? t.left - k.right - 14 : h.right - k.right - 4;
      // Ring etwas zur Seite mit mehr Platz (höchstens 8 % der Kartenbreite), damit beide Seiten gleich viel haben
      var schub = Math.max(-W * 0.08, Math.min(W * 0.08, (rechts - links) / 2));
      var raum = Math.min(links + schub, rechts - schub);
      var gr = Math.min(46, Math.max(26, W * 0.135));                // Kachelkante
      var ueber = Math.min(80, Math.max(44, W * 0.235));               // so weit reicht der Ring über die Karte
      ueber = Math.min(ueber, raum - gr * 0.6);
      if (ueber < gr * 0.6) {                                          // eng (z. B. 900–1100 px): Teile kleiner
        gr = Math.max(24, Math.min(gr, raum * 0.75));
        ueber = Math.max(gr * 0.3, raum - gr * 0.6);
      }
      var rx = W / 2 + ueber;
      var ry = rx * NEIGUNG;
      var cx = k.left - h.left + W / 2 + schub;
      var kartenOben = k.top - h.top;
      var cy = kartenOben + H - ry * 0.9;
      var rand = gr * 2.2;
      return {
        W: W, H: H, rx: rx, ry: ry, gr: gr, cx: cx, cy: cy, km: k.left - h.left + W / 2,
        kartenOben: kartenOben,
        oben: cy - ry - rand,            // Oberkante der Ring-Ebenen
        hoehe: 2 * ry + rand * 1.6,
        breite: h.width
      };
    }

    // Lage eines Teils bei Winkel w (Grad)
    function lage(teil, w) {
      var s = Math.sin(w * GRAD);
      var tiefe = (1 + s) / 2;                       // 0 hinten … 1 vorn
      var kachel = teil.classList.contains('fga-ring__teil--kachel');
      var b = kachel ? g.gr : g.gr * 1.16;
      var hh = kachel ? g.gr : g.gr * 1.35;          // Silhouette 48 × 56, etwas größer als die Kacheln
      var x = g.cx + g.rx * Math.cos(w * GRAD);
      var y = g.cy + g.ry * s - g.oben;               // in Ebenen-Koordinaten
      var heben = kachel ? g.gr * 0.32 : g.gr * 0.04; // Kacheln schweben über dem Ring
      var skala = 0.72 + 0.28 * tiefe;
      return {
        b: b, h: hh,
        transform: 'translate(' + (x - b / 2).toFixed(1) + 'px,' + (y - hh - heben).toFixed(1) + 'px) scale(' + skala.toFixed(3) + ')',
        deck: 0.58 + 0.42 * tiefe,
        vorn: s >= 0,
        z: Math.round(100 + s * 100)
      };
    }

    function ebenenSetzen() {
      [hinten, vorn].forEach(function (e) {
        e.style.top = g.oben.toFixed(1) + 'px';
        e.style.height = g.hoehe.toFixed(1) + 'px';
      });
      var cyE = g.cy - g.oben;
      var l = g.cx - g.rx, r = g.cx + g.rx;
      // hinterer Bogen (obere Hälfte, hinter der Karte) und vorderer Bogen (untere Hälfte, vor der Karte)
      boegen[0].setAttribute('d', 'M' + l + ' ' + cyE + 'A' + g.rx + ' ' + g.ry + ' 0 0 1 ' + r + ' ' + cyE);
      boegen[1].setAttribute('d', 'M' + r + ' ' + cyE + 'A' + g.rx + ' ' + g.ry + ' 0 0 1 ' + l + ' ' + cyE);
      bahnen.forEach(function (svg) {
        svg.setAttribute('width', Math.round(g.breite));
        svg.setAttribute('height', Math.round(g.hoehe));
      });
      // Licht: Schein hinter der Karte, Bodenlicht im Ring
      var lOben = g.kartenOben - g.H * 0.3;
      licht.style.top = lOben.toFixed(1) + 'px';
      licht.style.height = (g.H * 1.6 + g.ry).toFixed(1) + 'px';
      var sb = g.W * 2.1, sh = g.H * 1.45;
      schein.style.width = sb + 'px';
      schein.style.height = sh + 'px';
      schein.style.transform = 'translate(' + (g.km - sb / 2).toFixed(1) + 'px,' + (g.kartenOben + g.H * 0.46 - sh / 2 - lOben).toFixed(1) + 'px)';
      var bb = g.rx * 2.5, bh = g.ry * 2.9;
      boden.style.width = bb + 'px';
      boden.style.height = bh + 'px';
      boden.style.transform = 'translate(' + (g.cx - bb / 2).toFixed(1) + 'px,' + (g.cy - bh / 2 - lOben).toFixed(1) + 'px)';
    }

    function teilGroesse(teil, L) {
      teil.style.width = L.b.toFixed(1) + 'px';
      teil.style.height = L.h.toFixed(1) + 'px';
    }

    function stillSetzen() {
      teileH.forEach(function (th, i) {
        var tv = teileV[i];
        var L = lage(th, Number(th.getAttribute('data-winkel')) || 0);
        [th, tv].forEach(function (t) {
          teilGroesse(t, L);
          t.style.transform = L.transform;
          t.style.zIndex = L.z;
        });
        th.style.opacity = L.vorn ? 0 : L.deck;
        tv.style.opacity = L.vorn ? L.deck : 0;
      });
      bahnen.forEach(function (b) { b.style.opacity = ''; });
      licht.style.opacity = '';
    }

    function abbrechen() {
      laeufe.forEach(function (a) { try { a.cancel(); } catch (e) { /* schon fertig */ } });
      laeufe = [];
    }

    function gleich(a, b) {
      return a && b && Math.abs(a.cx - b.cx) < 1 && Math.abs(a.cy - b.cy) < 1 && Math.abs(a.W - b.W) < 1 && Math.abs(a.breite - b.breite) < 1;
    }

    function layout() {
      var neu = messen();
      if (!neu) return;
      if (zustand === 'laeuft') {
        if (gleich(neu, g)) return;            // nichts verschoben: Runde läuft weiter
        abbrechen();
        zustand = 'fertig';
      }
      g = neu;
      ebenenSetzen();
      if (zustand === 'wartet') {
        // vor der Runde: Teile in Ruhelage vermessen, aber unsichtbar
        stillSetzen();
        teileH.concat(teileV).forEach(function (t) { t.style.opacity = 0; });
        bahnen.forEach(function (b) { b.style.opacity = 0; });
        licht.style.opacity = 0;
      } else {
        stillSetzen();
      }
      host.classList.add('ist-bereit');
    }

    function runde() {
      if (zustand !== 'wartet' || !g) return;
      zustand = 'laeuft';
      var fertig = 0;
      var n = teileH.length;
      teileH.forEach(function (th, i) {
        var tv = teileV[i];
        var ziel = Number(th.getAttribute('data-winkel')) || 0;
        var weg = 150 + (i % 4) * 28;                 // Grad, die das Teil zurücklegt
        var kfH = [], kfV = [];
        for (var k = 0; k <= SCHRITTE; k++) {
          var t = k / SCHRITTE;
          var w = ziel + weg * (1 - ausgang(t));
          var L = lage(th, w);
          var auf = Math.min(1, t / 0.14);              // erst einblenden
          kfH.push({ offset: t, transform: L.transform, opacity: (L.vorn ? 0 : L.deck) * auf, zIndex: L.z });
          kfV.push({ offset: t, transform: L.transform, opacity: (L.vorn ? L.deck : 0) * auf, zIndex: L.z });
        }
        var opt = { duration: DAUER, delay: i * STAFFEL, easing: 'linear', fill: 'both' };
        var aH = th.animate(kfH, opt);
        var aV = tv.animate(kfV, opt);
        laeufe.push(aH, aV);
        aV.onfinish = function () {
          fertig += 1;
          if (fertig === n && zustand === 'laeuft') {
            zustand = 'fertig';
            stillSetzen();
            abbrechen();
          }
        };
      });
      bahnen.forEach(function (b) {
        laeufe.push(b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' }));
      });
      laeufe.push(licht.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1400, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' }));
      // Endzustand inline vormerken (fill: both hält ihn bis zum Abbruch)
      bahnen.forEach(function (b) { b.style.opacity = ''; });
      licht.style.opacity = '';
    }

    layout();

    if (zustand === 'wartet') {
      var io = new IntersectionObserver(function (eintraege) {
        for (var i = 0; i < eintraege.length; i++) {
          if (eintraege[i].isIntersecting) {
            io.disconnect();
            layout();
            runde();
            return;
          }
        }
      }, { threshold: 0.4 });
      io.observe(insel);
    }

    var takt = 0;
    function spaeter() {
      window.clearTimeout(takt);
      takt = window.setTimeout(layout, 120);
    }
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(spaeter).observe(insel);
    window.addEventListener('resize', spaeter);
    window.addEventListener('load', spaeter);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(spaeter);
  }

  function start() {
    var hosts = document.querySelectorAll('[data-fga-ring]');
    for (var i = 0; i < hosts.length; i++) init(hosts[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  document.addEventListener('shopify:section:load', start);
})();
