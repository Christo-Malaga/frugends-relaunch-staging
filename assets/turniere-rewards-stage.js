/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — Turniere · Rewards-Bühne (snippets/fg-rewards-stage)
   Pietro, 2026-09-30 · vanilla, Liquid-safe, kein Build-Schritt.

   Arbeitet nur, wenn das Inline-Script des Snippets .is-live gesetzt
   hat (kein reduced motion, WebGL, IO, Custom Elements). Sonst steht
   Spur B im Endbild und dieses Skript tut nichts.

   1 · MOUNT      Spur A kommt in die Nähe (IO, 150 %) => three.min.js
                  über den Guard aus fg-bignews-burst (script[data-fg-three]),
                  surprise-box.js ebenso lazy, dann <surprise-box> nach
                  Konfigurationsvertrag (scene burst, objects 13, stretch
                  0.6, hud false; bullet aus den Settings, mobil/desktop).
                  surprise-box.js, frugends-burst.css, three.min.js werden
                  NUR benutzt, nie verändert.
   2 · BLITZ      Runde 3 Fix (Coulson #7): kein Weiß mehr. Die Szene läuft per
                  Scroll nur bis vor ihre Weiß-Phase (SZENE_MAX); an der Schwelle
                  BLITZ_BEI zündet ein zeitgebundener Goldblitz (240 ms, ≤ 40 %).
   3 · NACHT      Navy-Ebene blendet mit dem Blitz in 260 ms ein (CSS-Übergang,
                  nicht scroll-gebunden). Bei voller Deckung ruht die Bühne nach
                  600 ms (display:none => surprise-box zeichnet nicht mehr, QA J-04).
   4 · ANDOCKEN   Spur B ist bis zum Andocken (top ≤ 0) unsichtbar und liegt
                  dann pixelgleich über A (gleicher Grund, gleiche Headline).
   5 · BEATS B    data-fx-* für scroll-cinema.js: Headline gleitet aus der
                  Blitz-Position hoch (Versatz gemessen), Boxen steigen auf,
                  Haufen blendet dahinter ein, Scheibe, Chip, Legende,
                  Caption. Danach ScrollCinema.refresh().
   6 · SZENE      Die Szene (Haufen + vier Boxen, festes Seitenverhältnis)
                  bekommt genau den Platz, den Chip, H2, Legende und Caption
                  lassen (--rs-vis-w-js, gemessen).
   7 · BLOCKER    [data-sticky-cta-block] sichtbar, solange die Bühne steht
                  => App-Pille + Discord-Button weichen (main.js anyBlocker
                  prüft offsetParent + hidden). Alle Breiten, siehe update().
   8 · TITEL      Runde 3 (Chris 2026-10-22: Textanimation über der Boxanimation,
                  nicht nacheinander, sondern übereinander): „Rewards“ steht ab
                  dem Andocken groß über der Box, darunter „Scroll für deine
                  Rewards“. Die Buchstaben laden sich mit dem Scroll auf (spreizen,
                  kippen), knallen beim Burst und setzen sich vor dem Andocken von
                  B exakt zurück (Übergabe pixelgleich). Ein Schreibzugriff je
                  Frame (CSS-Variablen am Titel).
   9 · EIN KONTEXT  Game Nr. 2 (fg-bignews-game Modus „turniere“, bignews-game.js
                  unverändert) und diese Bühne teilen sich die Seite: Wer näher am
                  Bild ist, hat WebGL. Die andere Szene gibt ihren Kontext frei
                  (Burst: Element raus + forceContextLoss; Game Nr. 2: über die
                  Section-Ereignisse des Skripts, frischer Canvas beim Zurückholen).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (window.__fgRewardsStage) return;
  window.__fgRewardsStage = true;

  var MOBILE = window.matchMedia('(max-width: 767px)');
  var REST_AFTER_MS = 600;
  /* Runde 3 Fix (Coulson #7, 2026-10-22): kein scroll-gebundenes Weiß mehr. Die Szene läuft per Scroll nur bis
     vor ihre Übernahme-Phase (gemessen: ab Szene ≈ 0.53 deckt der Plasmakern > 30 % hell, whiteAt ab 0.675):
     Spur-A-Fortschritt 0 … BLITZ_BEI bildet auf Szenen-Fortschritt 0 … SZENE_MAX ab. Bei BLITZ_BEI zündet ein
     zeitgebundener Goldblitz (CSS, 240 ms, höchstens 40 % Deckkraft) und die Nacht blendet in 260 ms ein; danach
     dockt Spur B an und die vier Winner Boxen steigen klar auf. Rückwärts (unter BLITZ_ZURUECK) blendet die Nacht
     wieder aus, ohne Blitz. */
  var SZENE_MAX = 0.48;
  var BLITZ_BEI = 0.93;
  var BLITZ_ZURUECK = 0.88;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ramp(p, a, b) { return clamp01((p - a) / (b - a)); }
  function smooth(u) { u = clamp01(u); return u * u * (3 - 2 * u); }
  function outCubic(u) { u = clamp01(u); var k = 1 - u; return 1 - k * k * k; }
  function r3(v) { var n = Math.round(v * 1000) / 1000; return n === 0 ? 0 : n; }

  /* scroll-cinema-Spur „stops | values“ mit Easing zwischen p0 und p1 */
  function track(p0, p1, v0, v1, unit, ease, n) {
    var stops = [], vals = [];
    for (var i = 0; i <= n; i++) {
      var u = i / n;
      stops.push(r3(p0 + (p1 - p0) * u));
      vals.push(r3(v0 + (v1 - v0) * ease(u)) + unit);
    }
    return stops.join(',') + ' | ' + vals.join(',');
  }

  /* offsetTop-Summe bis zum Container (ignoriert Transforms) */
  function offsetIn(el, container) {
    var y = 0, n = el;
    while (n && n !== container) { y += n.offsetTop; n = n.offsetParent; }
    return n === container ? y : null;
  }

  function setStyle(el, cache, key, prop, val) {
    if (cache[key] === val) return;
    cache[key] = val;
    el.style[prop] = val;
  }

  function setVar(el, cache, key, prop, val) {
    if (cache[key] === val) return;
    cache[key] = val;
    el.style.setProperty(prop, val);
  }

  /* 8 · Titel in Buchstaben teilen (inline-block-Spans: gleiches Box-Modell, gleiche Umbrüche) */
  var WUERFEL = [0.6, 1, 0.35, 0.85, 0.5, 0.95, 0.4, 0.75, 0.55, 0.9];
  function splitLetters(nodes) {
    Array.prototype.forEach.call(nodes, function (el) {
      var txt = el.textContent;
      var chars = Array.from ? Array.from(txt) : txt.split('');
      var n = 0;
      el.textContent = '';
      chars.forEach(function (ch) {
        if (ch === ' ') { el.appendChild(document.createTextNode(' ')); return; }
        var sp = document.createElement('span');
        sp.className = 'rs-bs';
        sp.textContent = ch;
        sp.style.setProperty('--k', n);
        sp.style.setProperty('--s', n % 2 ? -1 : 1);
        sp.style.setProperty('--w', WUERFEL[n % WUERFEL.length]);
        el.appendChild(sp);
        n++;
      });
      el.style.setProperty('--n', n);
    });
  }

  /* 9 · Game Nr. 2: Kontext freigeben / zurückholen (Skript unverändert, nur dessen Section-Ereignisse) */
  var G2 = {
    el: null,
    find: function () {
      if (this.el && this.el.isConnected) return this.el;
      this.el = document.querySelector('.bnb--tg[data-bnb]');
      return this.el;
    },
    rect: function () {
      var el = this.find();
      var f = el && el.querySelector('.bnb-scene__frame');
      return f ? f.getBoundingClientRect() : null;
    },
    fire: function (name) {
      var el = this.find();
      if (!el || !el.parentElement) return;
      var ev;
      try { ev = new CustomEvent(name, { bubbles: true }); }
      catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent(name, true, false, null); }
      el.parentElement.dispatchEvent(ev);
    },
    release: function () {
      var el = this.find();
      if (!el || !el.__bnb) return;
      this.fire('shopify:section:unload');
    },
    resume: function () {
      var el = this.find();
      if (!el || el.__bnb) return;
      /* Der alte Canvas hält einen verlorenen Kontext: frischen einsetzen, Rückfallbild zeigen, bis GL steht */
      var c = el.querySelector('[data-bnb-scene-gl]');
      if (c && c.parentNode) c.parentNode.replaceChild(c.cloneNode(false), c);
      var sc = el.querySelector('[data-bnb-scene]');
      if (sc) sc.classList.remove('is-gl', 'is-nogl');
      this.fire('shopify:section:load');
    }
  };
  function abstand(r, vh) {
    if (!r) return Infinity;
    if (r.bottom < 0) return -r.bottom;
    if (r.top > vh) return r.top - vh;
    return 0;
  }

  /* ─── Lader (Guard wie fg-bignews-burst: nur einfügen, wenn noch kein Tag existiert) ─── */
  function loadThree(src) {
    return new Promise(function (resolve, reject) {
      if (window.THREE) { resolve(); return; }
      var tag = document.querySelector('script[data-fg-three]');
      if (!tag) {
        tag = document.createElement('script');
        tag.src = src;
        tag.setAttribute('data-fg-three', '');
        document.head.appendChild(tag);
      }
      tag.addEventListener('error', function () { reject(new Error('three.min.js nicht ladbar')); });
      var tries = 0;
      (function poll() {
        if (window.THREE) { resolve(); return; }
        if (++tries > 600) { reject(new Error('three.min.js: Zeitüberschreitung')); return; }
        setTimeout(poll, 50);
      })();
    });
  }

  function loadSurpriseBox(src) {
    if (window.customElements.get('surprise-box')) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var tag = document.querySelector('script[data-fg-sbox]') ||
                document.querySelector('script[src*="surprise-box.js"]');
      if (!tag) {
        tag = document.createElement('script');
        tag.src = src;
        tag.async = true;
        tag.setAttribute('data-fg-sbox', '');
        document.head.appendChild(tag);
      }
      tag.addEventListener('error', function () { reject(new Error('surprise-box.js nicht ladbar')); });
      window.customElements.whenDefined('surprise-box').then(resolve);
    });
  }

  /* ─── Eine Bühne ────────────────────────────────────────────────── */
  function Stage(root) {
    var q = function (sel) { return root.querySelector(sel); };
    this.root = root;
    this.a = q('[data-rs-a]');
    this.sticky = q('[data-rs-a-sticky]');
    this.night = q('[data-rs-night]');
    this.blitz = q('[data-rs-blitz]');
    this.nacht = false;       // Nacht steht (nach dem Blitz)
    this.lastP = null;
    this.flash = q('[data-rs-flash]');
    this.flashTitle = q('[data-rs-flash-title]');
    this.ink = q('[data-rs-ink]');
    this.gold = q('[data-rs-gold]');
    this.b = q('[data-rs-b]');
    this.stage = this.b && this.b.querySelector('.rs-b__stage');
    this.cover = q('[data-rs-cover]');
    this.inner = q('[data-rs-inner]');
    this.title = q('[data-rs-beat="title"]');
    this.chip = q('[data-rs-beat="chip"]');
    this.boxes = q('[data-rs-beat="boxes"]');
    this.heap = q('[data-rs-beat="heap"]');
    this.visual = q('[data-rs-visual]');
    this.floor = q('[data-rs-beat="floor"]');
    this.legend = q('[data-rs-beat="legend"]');
    this.caption = q('[data-rs-beat="caption"]');
    this.imgs = root.querySelectorAll('[data-rs-img]');   // Haufen + vier Boxen
    this.block = q('[data-sticky-cta-block]');
    this.hint = q('[data-rs-hint]');
    this.hintPfeil = this.hint ? this.hint.querySelector('svg') : null;
    this.mountToken = 0;
    this.owner = null;
    splitLetters(root.querySelectorAll('[data-rs-letters]'));
    this.bulletD = root.getAttribute('data-bullet-d') || '0.85';
    this.bulletM = root.getAttribute('data-bullet-m') || '0.75';

    this.cache = {};
    this.box = null;
    this.ready = false;       // Canvas steht (sonst Blitz-Headline direkt in Gold)
    this.restTimer = 0;
    this.nightFull = false;
    this.blocking = null;
    this.lastBTop = null;
    this.lastRefresh = 0;
  }

  Stage.prototype.ok = function () {
    return this.a && this.sticky && this.night && this.flash && this.b && this.stage &&
           this.cover && this.inner && this.title && this.boxes && this.visual;
  };

  /* 1 · Mount */
  Stage.prototype.mount = function () {
    if (this.mounted) return;
    this.mounted = true;
    G2.release();
    var token = ++this.mountToken;
    var self = this, root = this.root;
    /* Haufen (594 KB) und Boxen erst jetzt laden (nahe der Spur), und
       vordekodieren, bevor sie aufsteigen */
    Array.prototype.forEach.call(this.imgs, function (img) {
      if (img.loading === 'lazy') img.loading = 'eager';
      if (img.decode) img.decode().catch(function () {});
    });
    Promise.all([
      loadThree(root.getAttribute('data-three-src')),
      loadSurpriseBox(root.getAttribute('data-sbox-src'))
    ]).then(function () {
      if (token !== self.mountToken || !self.mounted) return;   // inzwischen wieder freigegeben
      var box = document.createElement('surprise-box');
      box.setAttribute('scene', 'burst');
      box.setAttribute('objects', '13');
      box.setAttribute('bullet', MOBILE.matches ? self.bulletM : self.bulletD);
      box.setAttribute('stretch', '0.6');
      box.setAttribute('hud', 'false');
      box.setAttribute('logo', root.getAttribute('data-logo') || '');
      box.setAttribute('aria-hidden', 'true');
      /* Szenen-Fortschritt kommt von hier (surprise-box.js bleibt unverändert, nur die Instanz-Methode wird
         überdeckt): die Szene endet vor ihrer Weiß-Phase, siehe SZENE_MAX. */
      box._progress = function () { return self.szene(); };
      self.sticky.insertBefore(box, self.night);
      self.box = box;
      self.ready = true;
      self.update();
    }).catch(function (e) {
      /* Kein Rethrow: Spur A bleibt Navy-Bühne, die Headline kommt direkt in Gold. */
      if (window.console) console.warn('[rewards-stage] Animation nicht geladen.', e);
    });
  };

  /* 9 · Kontext freigeben: Element raus, Renderer weg, Kontext verlieren */
  Stage.prototype.unmount = function () {
    if (!this.mounted) return;
    this.mounted = false;
    this.mountToken++;
    if (this.restTimer) { window.clearTimeout(this.restTimer); this.restTimer = 0; }
    var box = this.box;
    this.box = null;
    this.ready = false;
    if (box) {
      if (box.parentNode) box.parentNode.removeChild(box);
      try {
        if (box._renderer) { box._renderer.dispose(); if (box._renderer.forceContextLoss) box._renderer.forceContextLoss(); }
        if (box._io) box._io.disconnect();
        if (box._ro) box._ro.disconnect();
      } catch (e) { /* Freigabe ist Bestpraxis, kein Pflichtpfad */ }
    }
  };

  /* 9 · Wer ist näher am Bild? (Hysterese 15 % Bildschirmhöhe) */
  Stage.prototype.arbiter = function (ra, vh) {
    var dR = abstand(ra, vh);
    var dG = abstand(G2.rect(), vh);
    var owner = this.owner;
    if (!owner) owner = dR <= dG ? 'rs' : 'g2';
    else if (owner === 'rs' && dG + vh * 0.15 < dR) owner = 'g2';
    else if (owner === 'g2' && dR + vh * 0.15 < dG) owner = 'rs';
    if (owner !== this.owner) {
      this.owner = owner;
      if (owner === 'g2') { this.unmount(); G2.resume(); }
      else G2.release();
    }
    /* Burst nur laden, wenn er dran ist und in die Nähe kommt (1,5 Bildschirme) */
    if (owner === 'rs' && !this.mounted && dR < vh * 1.5) this.mount();
  };

  Stage.prototype.onMedia = function () {
    if (this.box) this.box.setAttribute('bullet', MOBILE.matches ? this.bulletM : this.bulletD);
    this.layout();
  };

  /* 6 · Szenengröße: freien Platz im Endbild messen und der Szene geben.
     Die Szene hat ein festes Seitenverhältnis; unter ihr steht die Scheibe
     mit dem Überstand --rs-over × Breite. Gesetzt wird die Breite. */
  Stage.prototype.fit = function () {
    var inner = this.inner, first = null, last = null;
    for (var n = inner.firstElementChild; n; n = n.nextElementSibling) {
      if (n.offsetParent === null) continue;   // display:none (z. B. Chip im Querformat)
      if (!first) first = n;
      last = n;
    }
    if (!first || !last) return;
    var cs = window.getComputedStyle(inner);
    var avail = inner.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (!(avail > 0)) return;
    var target = avail * 0.985;   // etwas Luft über und unter der Gruppe
    var over = parseFloat(cs.getPropertyValue('--rs-over')) || 0.04;
    for (var i = 0; i < 4; i++) {
      var group = (last.offsetTop + last.offsetHeight) - first.offsetTop;
      var free = target - group;
      if (Math.abs(free) < 2) break;
      var w = this.visual.offsetWidth, h = this.visual.offsetHeight;
      if (!(h > 0)) break;
      var ar = w / h;
      var nextH = Math.max(90, h + free / (1 + over * ar));
      var nextW = Math.round(nextH * ar);
      if (Math.abs(nextW - w) < 1) break;   // an der Obergrenze (--rs-vis-cap)
      inner.style.setProperty('--rs-vis-w-js', nextW + 'px');
    }
    /* Hawkeye 2026-10-22: Am Handy stößt das Bild an die Breite, die Gruppe steht mittig, unter der Caption bleibt
       Luft. Diese Luft gibt der Fluss zurück: page-game.css zieht .tn-rewards__flow am Handy um --rs-luft hoch (die
       Seite wird kürzer, nichts wird überdeckt). Auf kurzen Bildschirmen füllt die Gruppe den Platz, dann ist sie 0. */
    var gruppe = (last.offsetTop + last.offsetHeight) - first.offsetTop;
    var luft = MOBILE.matches ? Math.max(0, Math.floor((avail - gruppe) / 2 - 8)) : 0;
    (this.root.parentNode || this.root).style.setProperty('--rs-luft', luft + 'px');   // Eltern: der Fluss ist Geschwister der Bühne
  };

  /* 5 · Beats für Spur B */
  Stage.prototype.beats = function () {
    /* Tinten-Box in A und H2 in B haben dasselbe Box-Modell => Mitte auf Mitte */
    var ref = this.ink || this.flashTitle;
    var a = offsetIn(ref, this.sticky);
    var b = offsetIn(this.title, this.stage);
    var dy = 0;
    if (a !== null && b !== null) {
      dy = (a + ref.offsetHeight / 2) - (b + this.title.offsetHeight / 2);
    }
    /* Takt (Fortschritt Spur B):
         0–0.10  Atempause, Gold-Headline allein (= letzter Frame von A)
         0.10–0.42 Headline gleitet hoch
         0.22–0.58 Bühnenscheibe geht auf
         0.30–0.64 Boxen steigen an der Explosionsstelle auf — erst, wenn die
                   Headline fast oben ist, sonst schieben sie sich durch die Schrift
         0.40–0.68 der Haufen blendet hinter den Boxen ein
         0.48–0.78 Chip, Legende, Caption
         0.78–1   Endbild steht */
    /* Bild-Ebenen starten bei 0.004 statt 0: unsichtbar, aber Chromium
       rastert sie vor (bei exakt 0 überspringt es das Rastern, und das Bild
       fehlt im ersten Moment des Einblendens — gemessen, SwiftShader ~1 s). */
    this.title.setAttribute('data-fx-y', track(0.10, 0.42, dy, 0, 'px', smooth, 8));
    this.boxes.setAttribute('data-fx-opacity', track(0.32, 0.54, 0.004, 1, '', outCubic, 4));
    this.boxes.setAttribute('data-fx-y', track(0.30, 0.64, 6, 0, 'vh', outCubic, 6));
    this.boxes.setAttribute('data-fx-scale', track(0.30, 0.64, 0.9, 1, '', outCubic, 6));
    if (this.heap) {
      this.heap.setAttribute('data-fx-opacity', track(0.40, 0.66, 0.004, 1, '', smooth, 4));
      this.heap.setAttribute('data-fx-scale', track(0.40, 0.68, 0.94, 1, '', outCubic, 5));
    }
    if (this.floor) {
      this.floor.setAttribute('data-fx-opacity', track(0.22, 0.50, 0.004, 1, '', outCubic, 4));
      this.floor.setAttribute('data-fx-scale', track(0.22, 0.58, 0.6, 1, '', outCubic, 6));
    }
    if (this.chip) this.chip.setAttribute('data-fx-opacity', track(0.48, 0.62, 0, 1, '', smooth, 3));
    if (this.legend) this.legend.setAttribute('data-fx-opacity', track(0.54, 0.72, 0, 1, '', smooth, 3));
    if (this.caption) this.caption.setAttribute('data-fx-opacity', track(0.62, 0.78, 0, 1, '', smooth, 3));
    this.refreshCinema(true);
  };

  Stage.prototype.refreshCinema = function (force) {
    var now = Date.now();
    if (!force && now - this.lastRefresh < 250) return;
    this.lastRefresh = now;
    if (window.ScrollCinema && typeof window.ScrollCinema.refresh === 'function') {
      window.ScrollCinema.refresh();
    }
  };

  Stage.prototype.layout = function () {
    this.inner.style.removeProperty('--rs-vis-w-js');
    this.fit();
    this.beats();
    this.lastBTop = null;
    this.update();
  };

  /* Roher Fortschritt der Spur A (wie surprise-box._progress) und der daraus abgeleitete Szenen-Fortschritt */
  Stage.prototype.roh = function (ra, vh) {
    var travel = ra.height - vh;
    return travel > 1 ? clamp01(-ra.top / travel) : (ra.top < 0 ? 1 : 0);
  };
  Stage.prototype.szene = function () {
    var p = this.roh(this.a.getBoundingClientRect(), window.innerHeight || 1);
    return Math.min(p / BLITZ_BEI, 1) * SZENE_MAX;
  };

  /* Nacht an/aus. Mit Blitz: Goldblitz (240 ms) + Nacht blendet über 260 ms ein (CSS). Ohne Blitz beim
     Einschalten (Anker-Sprung, Laden mitten in der Spur): sofort, ohne Übergang. Ausschalten blendet aus. */
  Stage.prototype.setNacht = function (an, mitBlitz) {
    this.nacht = an;
    var n = this.night, root = this.root;
    if (an && !mitBlitz) {
      root.classList.add('ist-sofort');
      n.classList.add('ist-an');
      root.classList.add('ist-enthuellt');
      void n.offsetWidth;
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { root.classList.remove('ist-sofort'); });
      });
    } else {
      n.classList.toggle('ist-an', an);
      /* Enthüllung (Spur B, Endbild) zeitgebunden: CSS staffelt Titel, Scheibe, Boxen, Legende, Caption */
      root.classList.toggle('ist-enthuellt', an);
    }
    var b = this.blitz;
    if (an && mitBlitz && b) {
      b.classList.remove('ist-blitz');
      void b.offsetWidth;   // Animation neu starten
      b.classList.add('ist-blitz');
    } else if (b && !an) {
      b.classList.remove('ist-blitz');
    }
  };

  /* 2–4, 7 · pro Frame (rAF-gedrosselt) */
  Stage.prototype.update = function () {
    var vh = window.innerHeight || 1;
    var c = this.cache;

    /* Spur A: roher Fortschritt wie surprise-box._progress() */
    var ra = this.a.getBoundingClientRect();
    var p = this.roh(ra, vh);

    /* 8 · Titel steht von Anfang an über der Box, immer in Gold (kein Weiß mehr, also keine Tinte).
       Aufladen mit dem Scroll, Schlag zum Blitz, vor dem Andocken exakt zurück (Übergabe an B pixelgleich). */
    var aus = 1 - smooth(ramp(p, BLITZ_BEI, 0.99));
    var lade = smooth(ramp(p, 0.03, 0.7)) * aus;           // aufladen: spreizen, kippen
    var knall = smooth(ramp(p, 0.8, BLITZ_BEI)) * aus;     // Schlag zum Blitz
    var sc = 1 + 0.06 * knall;

    setStyle(this.flash, c, 'fo', 'opacity', '1');
    setStyle(this.flash, c, 'fv', 'visibility', 'visible');
    setStyle(this.flashTitle, c, 'fs', 'transform', sc < 1.0001 ? 'none' : 'scale(' + sc.toFixed(4) + ')');
    setVar(this.flashTitle, c, 'vl', '--rs-lade', lade.toFixed(3));
    setVar(this.flashTitle, c, 'vk', '--rs-knall', knall.toFixed(3));
    if (this.ink) setStyle(this.ink, c, 'io', 'opacity', '0');
    if (this.gold) setStyle(this.gold, c, 'go', 'opacity', '1');
    if (this.hint) {
      var h = 1 - smooth(ramp(p, 0.1, 0.32));
      setStyle(this.hint, c, 'ho', 'opacity', h.toFixed(3));
      setStyle(this.hint, c, 'hv', 'visibility', h > 0.001 ? 'visible' : 'hidden');
      // Endlos-Hüpfer des Pfeils (CSS rs-hinweis) nur, solange der Hinweis zu sehen ist: Chrome animiert SVG-Elemente
      // auf dem Hauptthread, versteckt tickte er weiter (gemessen ~700 ms/s Hauptthread am Seitenende, Bolt 5)
      if (this.hintPfeil) setStyle(this.hintPfeil, c, 'hp', 'animationPlayState', h > 0.001 ? 'running' : 'paused');
    }
    this.arbiter(ra, vh);

    /* Blitz + Nacht: zeitgebunden (CSS-Übergang), ausgelöst an einer Scroll-Schwelle */
    var sprung = this.lastP === null || Math.abs(p - this.lastP) > 0.35;   // Anker-Sprung, Laden mitten in der Spur
    if (!this.nacht && p >= BLITZ_BEI) this.setNacht(true, !sprung && this.ready);
    else if (this.nacht && p < BLITZ_ZURUECK) this.setNacht(false, false);
    this.lastP = p;

    /* Ruhe unter voller Deckung */
    this.nightFull = this.nacht;
    if (this.box) {
      var self = this;
      if (this.nightFull) {
        if (!this.restTimer && this.box.style.display !== 'none') {
          this.restTimer = window.setTimeout(function () {
            self.restTimer = 0;
            if (self.nightFull && self.box) self.box.style.display = 'none';
          }, REST_AFTER_MS);
        }
      } else {
        if (this.restTimer) { window.clearTimeout(this.restTimer); this.restTimer = 0; }
        if (this.box.style.display === 'none') this.box.style.display = '';
      }
    }

    /* Spur B: sichtbar ab dem Blitz (CSS über .ist-enthuellt). Bis zum Andocken liegt ihre Bühne noch
       (1 − BLITZ_BEI) × Spurlänge tiefer: um genau diesen Abstand hochschieben, damit das Endbild steht. */
    var rb = this.b.getBoundingClientRect();
    var versatz = this.nacht && rb.top > 0.5 ? rb.top : 0;
    setStyle(this.stage, c, 'sv', 'transform', versatz ? 'translate3d(0,' + (-versatz).toFixed(1) + 'px,0)' : '');

    /* Layout darüber verschoben (Bilder, Fonts)? scroll-cinema neu messen */
    var bTop = rb.top + (window.scrollY || window.pageYOffset || 0);
    if (this.lastBTop === null) this.lastBTop = bTop;
    else if (Math.abs(bTop - this.lastBTop) > 1) { this.lastBTop = bTop; this.refreshCinema(false); }

    /* Pille/Discord weichen, solange die Bühne steht. Widow §4 nennt nur
       mobil; gemessen verdeckt der Discord-Button bei 1024 × 768 aber die
       Pflicht-Caption, und im Querformat liegt die Pille auf der Legende =>
       auf allen Breiten. */
    var rr = this.root.getBoundingClientRect();
    var block = rr.top <= 0 && rr.bottom >= vh - 1;
    if (block !== this.blocking && this.block) {
      this.blocking = block;
      if (block) this.block.removeAttribute('hidden');
      else this.block.setAttribute('hidden', '');
    }
  };

  Stage.prototype.init = function () {
    var self = this;
    this.b.setAttribute('data-scrub', '');   // falls das Inline-Script es nicht mehr geschafft hat

    /* Mount nahe der Spur: entscheidet arbiter() in update() (ein WebGL-Kontext je Moment) */

    /* Pro Scroll-Frame: drei Rect-Messungen, Schreibzugriffe nur bei
       Änderung (Cache). Bewusst ohne IO-Gate: Ein Sofortsprung (#preise)
       muss schon im ersten Frame das richtige Bild zeigen. */
    var raf = 0;
    function frame() { raf = 0; self.update(); }
    function onScroll() { if (!raf) raf = window.requestAnimationFrame(frame); }
    window.addEventListener('scroll', onScroll, { passive: true });

    var rt = 0;
    function onResize() {
      window.clearTimeout(rt);
      rt = window.setTimeout(function () { self.layout(); }, 150);
    }
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    if (MOBILE.addEventListener) MOBILE.addEventListener('change', function () { self.onMedia(); });
    else if (MOBILE.addListener) MOBILE.addListener(function () { self.onMedia(); });

    window.addEventListener('load', function () { self.layout(); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) self.layout(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { self.layout(); });

    this.layout();
  };

  function boot() {
    var roots = document.querySelectorAll('[data-rs]');
    Array.prototype.forEach.call(roots, function (root) {
      if (!root.classList.contains('is-live')) return;   // statisch: Endbild, nichts zu tun
      var st = new Stage(root);
      if (!st.ok()) return;
      st.init();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
