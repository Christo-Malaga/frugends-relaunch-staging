/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — MAIN (site-wide vanilla JS, no framework, no jQuery)
   ───────────────────────────────────────────────────────────────
   SHOPIFY PORT of the static build's main.js. Differences vs static:
     • data-include fetch shim REMOVED — header/footer are
       server-rendered by Liquid ({% sections %} / {% render %}).
     • static-preview link shim (STATIC_MAP) REMOVED — real Shopify
       routes (/pages/…) work natively.
     • SHOP DEAKTIVIERT 2026-09-24 (audit/DECISIONS.md E16): the shop
       hooks (cart drawer, product buybar, [data-product], FrugendsCart)
       are commented out below — search for "SHOP DEAKTIVIERT".
   Everything else (FAQ, reveal, parallax, modals, creator modal,
   sticky CTA, active nav) is IDENTICAL to the verified static build.

   Load order:  scroll-cinema.js (per section, if used) → main.js
   (`defer`, wired in layout/theme.liquid). cart.js is no longer loaded
   while the shop is off (see sections/fg-shell-header.liquid).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ─── 2. FAQ accordion ──────────────────────────────────────────
     Markup:
       <div class="faq__item">
         <button class="faq__question" aria-expanded="false"
                 aria-controls="faq-a-1" id="faq-q-1"> … </button>
         <div class="faq__answer" id="faq-a-1" role="region"
              aria-labelledby="faq-q-1"><div>…</div></div>
       </div> */
  function initFaq() {
    var questions = document.querySelectorAll('.faq__question');
    Array.prototype.forEach.call(questions, function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.faq__item');
        if (!item) return;
        var isOpen = item.classList.contains('is-open');

        // close siblings within the same .faq group (one-open accordion)
        var group = item.closest('.faq');
        if (group) {
          Array.prototype.forEach.call(group.querySelectorAll('.faq__item.is-open'), function (open) {
            if (open !== item) {
              open.classList.remove('is-open');
              var q = open.querySelector('.faq__question');
              if (q) q.setAttribute('aria-expanded', 'false');
            }
          });
        }

        item.classList.toggle('is-open', !isOpen);
        btn.setAttribute('aria-expanded', String(!isOpen));
      });
    });
  }

  /* ─── 4. Reveal-on-scroll ───────────────────────────────────────
     Adds .visible to .reveal elements once. Reduced-motion users get
     everything visible immediately. */
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    if (reduceMQ.matches || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add('visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  }

  /* ─── 4b. Parallax ──────────────────────────────────────────────
     Elements with [data-parallax="0.2"] shift on scroll at that factor
     of the distance from viewport-center (negative = opposite way).
     rAF-coalesced, passive, disabled under reduced motion. */
  function initParallax() {
    var els = document.querySelectorAll('[data-parallax]');
    if (!els.length || reduceMQ.matches) return;
    var items = Array.prototype.map.call(els, function (el) {
      return { el: el, f: parseFloat(el.getAttribute('data-parallax')) || 0.2 };
    });
    var ticking = false;
    function update() {
      ticking = false;
      var mid = window.innerHeight / 2;
      items.forEach(function (it) {
        var r = it.el.getBoundingClientRect();
        var delta = (r.top + r.height / 2) - mid;
        it.el.style.transform = 'translate3d(0,' + (-delta * it.f).toFixed(1) + 'px,0)';
      });
    }
    function onScroll() { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ─── 5. Footer year ────────────────────────────────────────────*/
  function initYear() {
    var spans = document.querySelectorAll('.footer-year');
    var y = String(new Date().getFullYear());
    Array.prototype.forEach.call(spans, function (s) { s.textContent = y; });
  }

  /* ─── 6a. App-download modal ────────────────────────────────────
     Any [data-app-modal] button opens #app-modal (the store chooser).
     Focus-trapped, ESC + backdrop close, restores focus to the opener. */
  function initAppModal() {
    var modal = document.getElementById('app-modal');
    if (!modal) return;
    var opener = null;

    function focusable() {
      return Array.prototype.slice.call(
        modal.querySelectorAll('a[href], button:not([disabled])')
      ).filter(function (el) { return el.offsetParent !== null; });
    }

    function onKeydown(e) {
      if (e.key === 'Escape' || e.key === 'Esc') { close(); return; }
      if (e.key !== 'Tab') return;
      var f = focusable();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function open(trigger) {
      opener = trigger || document.activeElement;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKeydown, true);
      var f = focusable();
      if (f.length) f[0].focus();
    }

    function close() {
      if (modal.hidden) return;
      modal.hidden = true;
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeydown, true);
      if (opener && typeof opener.focus === 'function') opener.focus();
      opener = null;
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-app-modal]'), function (btn) {
      btn.addEventListener('click', function (e) { e.preventDefault(); open(btn); });
    });
    Array.prototype.forEach.call(modal.querySelectorAll('[data-app-close]'), function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); close(); });
    });

    // expose for other pages/triggers if needed
    window.FrugendsAppModal = { open: open, close: close };
  }

  /* ─── 6a-bis. Shared sponsor "coming soon" modal ────────────────
     One skeleton modal (#sponsor-modal) shared by every sponsor
     tile. Mirrors initAppModal's focus
     trap / ESC / backdrop / body-lock / return-focus. The opening
     tile's data-accent (cyan|gold) tints the modal card. No-op on
     pages without the modal. */
  function initSponsorModal() {
    var modal = document.getElementById('sponsor-modal');
    if (!modal) return;
    var card = modal.querySelector('.sponsor-modal__card');
    var opener = null;

    function focusable() {
      return Array.prototype.slice.call(
        modal.querySelectorAll('a[href], button:not([disabled])')
      ).filter(function (el) { return el.offsetParent !== null; });
    }

    function onKeydown(e) {
      if (e.key === 'Escape' || e.key === 'Esc') { close(); return; }
      if (e.key !== 'Tab') return;
      var f = focusable();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function open(trigger) {
      opener = trigger || document.activeElement;
      if (card) {
        card.classList.remove('sponsor-modal__card--cyan', 'sponsor-modal__card--gold');
        var accent = trigger && trigger.getAttribute('data-accent');
        if (accent) card.classList.add('sponsor-modal__card--' + accent);
      }
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKeydown, true);
      var f = focusable();
      if (f.length) f[0].focus();
    }

    function close() {
      if (modal.hidden) return;
      modal.hidden = true;
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeydown, true);
      if (opener && typeof opener.focus === 'function') opener.focus();
      opener = null;
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-sponsor-open]'), function (btn) {
      btn.addEventListener('click', function (e) { e.preventDefault(); open(btn); });
    });
    Array.prototype.forEach.call(modal.querySelectorAll('[data-sponsor-close]'), function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); close(); });
    });

    window.FrugendsSponsorModal = { open: open, close: close };
  }

  /* ─── 6d. "Creator werden" modal — speaking character + typewriter +
     form. Mirrors initAppModal (focus-trap/Esc/backdrop/body-lock/
     return-focus). Markup ships in the fg-shell-header section. */
  function initCreatorModal() {
    var modal = document.getElementById('creator-modal');
    if (!modal) return;
    var card   = modal.querySelector('.creator-modal__card');
    var msgEl  = modal.querySelector('#creator-msg');
    var form   = modal.querySelector('[data-creator-form]');
    var viewForm = modal.querySelector('[data-creator-view="form"]');
    var viewOk   = modal.querySelector('[data-creator-view="success"]');
    var submitBtn = modal.querySelector('[data-creator-submit]');
    var opener = null;
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    /* typewriter */
    var typed = msgEl ? msgEl.querySelector('.creator-chat__typed') : null;
    var caret = msgEl ? msgEl.querySelector('.creator-chat__caret') : null;
    var full  = msgEl ? (msgEl.getAttribute('data-typewriter') || '') : '';
    var chars = typeof Array.from === 'function' ? Array.from(full) : full.split('');
    var twTimer = null, ti = 0;
    var PAUSE = { ',': 180, ':': 180, ';': 180, '.': 360, '!': 360, '?': 360, '…': 360 };
    function twStop() { if (twTimer) { clearTimeout(twTimer); twTimer = null; } }
    function twTick() {
      if (ti >= chars.length) { if (caret) caret.classList.add('is-done'); return; }
      var ch = chars[ti]; typed.textContent += ch; ti++;
      var delay = (PAUSE[ch] || 34) + (Math.random() * 12 - 6);
      twTimer = setTimeout(twTick, Math.max(16, delay));
    }
    function twStart() {
      twStop();
      if (!typed) return;
      if (caret) caret.classList.remove('is-done');
      if (reduceMQ.matches) { typed.textContent = full; if (caret) caret.classList.add('is-done'); return; }
      typed.textContent = ''; ti = 0; twTick();
    }

    /* form */
    function clearErrors() {
      Array.prototype.forEach.call(modal.querySelectorAll('.creator-field'), function (fld) { fld.classList.remove('is-invalid'); });
      Array.prototype.forEach.call(modal.querySelectorAll('.creator-field__err'), function (er) { er.hidden = true; er.textContent = ''; });
    }
    function showErr(input, msg) {
      var fld = input.closest('.creator-field'); if (fld) fld.classList.add('is-invalid');
      var er = fld && fld.querySelector('.creator-field__err'); if (er) { er.textContent = msg; er.hidden = false; }
    }
    function showSuccess() {
      if (viewForm) viewForm.hidden = true;
      if (viewOk) viewOk.hidden = false;
      var f = modal.querySelector('[data-creator-success-focus]'); if (f) f.focus();
    }
    function resetView() {
      if (viewOk) viewOk.hidden = true;
      if (viewForm) viewForm.hidden = false;
      if (form) form.reset();
      clearErrors();
      if (submitBtn) submitBtn.classList.remove('is-busy');
    }
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        clearErrors();
        var nick = form.querySelector('#cf-nick'), name = form.querySelector('#cf-name'), mail = form.querySelector('#cf-mail');
        // Plattform-Chips: Auswahl ins Hidden-Feld schreiben (Checkboxen
        // selbst haben kein name-Attribut und posten nicht einzeln)
        var platformBoxes = form.querySelectorAll('[data-creator-platform]');
        var platformsHidden = form.querySelector('[data-creator-platforms]');
        var picked = [];
        Array.prototype.forEach.call(platformBoxes, function (cb) { if (cb.checked) picked.push(cb.value); });
        if (platformsHidden) platformsHidden.value = picked.join(', ');
        var errs = [];
        if (!nick.value.trim()) errs.push([nick, 'Bitte gib deinen Creator Namen ein.']);
        if (platformBoxes.length && !picked.length) errs.push([platformBoxes[0], 'Bitte wähle mindestens eine Plattform aus.']);
        if (!name.value.trim()) errs.push([name, 'Bitte gib deinen echten Namen ein.']);
        if (!mail.value.trim()) errs.push([mail, 'Bitte gib deine E-Mail ein.']);
        else if (!EMAIL_RE.test(mail.value.trim())) errs.push([mail, 'Diese E-Mail sieht nicht gültig aus.']);
        if (errs.length) { errs.forEach(function (p) { showErr(p[0], p[1]); }); errs[0][0].focus(); return; }
        // Versand direkt als E-Mail an info@frugends.com via FormSubmit
        // (kein Shopify-/contact-POST). fetch() auf den AJAX-Endpoint hält
        // den Besucher im Modal; ohne fetch()-Support nativer POST auf die
        // action-URL — FormSubmit leitet über _next mit ?creator-sent=1
        // zurück und der Marker-Check unten zeigt den Success-State.
        submitBtn.classList.add('is-busy');
        if (!window.fetch) { form.submit(); return; }
        var payload = {};
        Array.prototype.forEach.call(form.elements, function (el) {
          if (!el.name || el.disabled || el.name === '_next') return;
          if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
          payload[el.name] = el.value;
        });
        fetch('https://formsubmit.co/ajax/info@frugends.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function (res) {
          return res.json().then(
            function (data) { return { ok: res.ok, data: data }; },
            function () { return { ok: res.ok, data: null }; }
          );
        }).then(function (r) {
          if (!r.ok || !r.data || (r.data.success !== true && r.data.success !== 'true')) throw new Error('formsubmit');
          submitBtn.classList.remove('is-busy');
          showSuccess();
        }).catch(function () {
          submitBtn.classList.remove('is-busy');
          showErr(mail, 'Senden hat leider nicht geklappt. Versuch es gleich nochmal – oder schreib uns direkt an info@frugends.com.');
        });
      });
    }

    /* modal shell (mirrors initAppModal) */
    function focusable() {
      return Array.prototype.slice.call(
        modal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter(function (el) { return el.offsetParent !== null; });
    }
    function onKeydown(e) {
      if (e.key === 'Escape' || e.key === 'Esc') { close(); return; }
      if (e.key !== 'Tab') return;
      var f = focusable(); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    function open(trigger) {
      opener = trigger || document.activeElement;
      resetView();
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKeydown, true);
      modal.querySelector('.creator-modal__close').focus();
      twStart();
    }
    function close() {
      if (modal.hidden) return;
      twStop();
      modal.hidden = true;
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeydown, true);
      if (opener && opener.focus) opener.focus();
      opener = null;
    }
    // delegated open (nav trigger lives in the shell section)
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-creator-open]') : null;
      if (t) { e.preventDefault(); open(t); }
    });
    Array.prototype.forEach.call(modal.querySelectorAll('[data-creator-close]'), function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); close(); });
    });
    window.FrugendsCreatorModal = { open: open, close: close };

    // Rückkehr vom nativen FormSubmit-POST (No-fetch-Fallback): _next
    // hängt ?creator-sent=1 an die URL — Modal im Success-State öffnen.
    if (/[?&]creator-sent(?:[=&]|$)/.test(window.location.search)) {
      open();
      showSuccess();
    } else if (/[?&]creator(?:[=&]|$)/.test(window.location.search)) {
      // Deep-Link: ?creator öffnet das Modal auf jeder Seite
      // (z. B. https://frugends.com/?creator) — der creator-sent-Check
      // oben hat Vorrang, damit der POST-Rücksprung nicht überschrieben wird.
      open();
    }
  }

  /* ─── 6b. Hero phone video (mute toggle + reduced-motion guard) ──
     The trailer autoplays muted (browser policy). A toggle un-mutes;
     under prefers-reduced-motion the video is paused so only the
     poster frame shows. */
  function initHeroVideo() {
    var video = document.querySelector('.iphone__screen');
    if (!video || video.tagName !== 'VIDEO') return;

    if (reduceMQ.matches) {
      try {
        video.removeAttribute('autoplay');
        video.pause();
        video.currentTime = 0;
      } catch (err) { /* poster remains visible */ }
    }

    var toggle = document.querySelector('[data-video-mute]');
    if (!toggle) return;
    toggle.addEventListener('click', function () {
      video.muted = !video.muted;
      var on = !video.muted;
      toggle.setAttribute('aria-pressed', String(on));
      toggle.setAttribute('aria-label', on ? 'Ton ausschalten' : 'Ton einschalten');
      // first interaction: the attention pulse has done its job — stop it.
      toggle.classList.remove('is-pulse');
      if (on) {
        // Ton an ⇒ Clip von vorne, damit Bild und Sound zusammen starten.
        try { video.currentTime = 0; } catch (err) { /* noch kein seekbarer Buffer */ }
        if (!reduceMQ.matches) { video.play().catch(function () {}); }
      }
    });
  }

  /* ─── 7. Active-section nav highlight ───────────────────────────
     Marks the nav link for the current page with aria-current="page"
     (CSS draws the amber, pulsing underline). */
  function markActiveNav() {
    function key(path) {
      path = (path || '').replace(/\/+$/, '');
      var last = path.substring(path.lastIndexOf('/') + 1);
      if (last === '' || last === 'index.html') return 'home';
      return last.replace(/\.html$/, '');
    }
    var here = key(location.pathname);
    var links = document.querySelectorAll(
      '.site-nav a.nav-link, .nav-menu a.nav-link, .nav-more__link'
    );
    Array.prototype.forEach.call(links, function (a) {
      // Externe Links haben oft denselben Pfad wie die Startseite
      // (z. B. „/“) — nur Links auf eigene Seiten markieren.
      if (a.host === location.host && key(a.pathname) === here) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    // Liegt die aktive Seite in einem „Mehr“-Dropdown, markiert der
    // Toggle das mit — sonst wirkt die Bar auf der Unterseite tot.
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav-more]'), function (more) {
      var t = more.querySelector('[data-nav-more-toggle]');
      if (t) t.classList.toggle('is-current', !!more.querySelector('[aria-current="page"]'));
    });
  }

  /* ─── Sammel-Menüpunkt „Mehr“ (Desktop-Dropdown) ────────────────
     CSS öffnet das Panel bereits per :hover / :focus-within — das
     hier ergänzt Klick-Toggle, ESC, Außenklick und hält dabei
     aria-expanded korrekt. Ohne JS bleibt das Menü bedienbar. */
  function initNavMore() {
    var groups = Array.prototype.slice.call(document.querySelectorAll('[data-nav-more]'));
    if (!groups.length) return;

    function close(g) {
      g.classList.remove('is-open');
      var t = g.querySelector('[data-nav-more-toggle]');
      if (t) t.setAttribute('aria-expanded', 'false');
    }
    function closeAll(except) {
      groups.forEach(function (g) { if (g !== except) close(g); });
    }

    groups.forEach(function (g) {
      var toggle = g.querySelector('[data-nav-more-toggle]');
      if (!toggle) return;

      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        var open = !g.classList.contains('is-open');
        closeAll(g);
        g.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });

      g.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' && e.key !== 'Esc') return;
        if (!g.classList.contains('is-open')) return;
        close(g);
        toggle.focus();
      });

      // Panel-Link geklickt → Zustand nicht über den Seitenwechsel schleppen
      g.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.nav-more__link')) close(g);
      });
    });

    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-nav-more]')) return;
      closeAll(null);
    });
  }

  /* Shared collision test for the floating CTAs (app pill + Discord FAB):
     true while an overlay or bottom-fixed element owns the same screen
     real estate. BOTTOM_BLOCKERS is the "someone else sits at the bottom"
     set; the app pill additionally yields to the wiki section bar. */
  var BOTTOM_BLOCKERS  = ['.wiki-secsheet.is-open', /* SHOP DEAKTIVIERT 2026-09-24 — zum Reaktivieren Kommentar entfernen (siehe audit/DECISIONS.md E16): '.buybar.is-visible', */ '[data-sticky-cta-block]'];
  var APP_CTA_BLOCKERS = ['.wiki-secbar'].concat(BOTTOM_BLOCKERS);
  function anyBlocker(list) {
    /* SHOP DEAKTIVIERT 2026-09-24 — zum Reaktivieren Kommentar entfernen (siehe audit/DECISIONS.md E16)
    if (document.querySelector('.cart-drawer.is-open')) return true;
    */
    for (var i = 0; i < list.length; i++) {
      var n = document.querySelector(list[i]);
      if (n && n.offsetParent !== null && !n.hasAttribute('hidden')) return true;
    }
    return false;
  }

  /* ─── global mobile "App holen" sticky CTA ──────────────────────
     Hidden at the top; fades in smoothly the moment the hero CTA(s)
     leave the viewport, then stays (gently bobbing/glowing) while the
     user scrolls. Fades out whenever a bottom/overlay sticky element
     would collide (cart drawer, wiki "Auf dieser Seite" bar/sheet,
     product buybar, or any [data-sticky-cta-block]); fades back once
     clear. Hard-suppressed on shop/product pages ([data-product]). */
  function initStickyCTA() {
    var el = document.querySelector('[data-app-cta]');
    if (!el) return;
    /* SHOP DEAKTIVIERT 2026-09-24 — zum Reaktivieren Kommentar entfernen (siehe audit/DECISIONS.md E16)
    if (document.querySelector('[data-product]')) { el.parentNode && el.parentNode.removeChild(el); return; }
    */
    // reveal only once the hero CTA(s) — or the hero itself — have
    // scrolled up past the top (behind the sticky header), i.e. left view
    var anchor = document.querySelector('.hero__ctas')
              || document.querySelector('.tn-hero__ctas')
              || document.querySelector('.page-hero__inner')
              || document.querySelector('#hero, .hero, .page-hero, .tn-hero')
              || document.querySelector('#main section');
    function headerH() { var h = document.querySelector('.site-header'); return h ? h.getBoundingClientRect().height : 64; }
    function heroPassed() { return anchor ? anchor.getBoundingClientRect().bottom <= headerH() : true; }
    var shown = null;
    function update() {
      var show = heroPassed() && !anyBlocker(APP_CTA_BLOCKERS);
      if (show !== shown) { shown = show; el.classList.toggle('is-hidden', !show); }
    }
    el.classList.add('is-enabled');
    update();
    var raf = false;
    function schedule() { if (raf) return; raf = true; window.requestAnimationFrame(function () { raf = false; update(); }); }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    try {
      new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    } catch (e) {}
  }

  /* ─── global Discord community FAB ──────────────────────────────
     Unlike the app CTA it is visible from the first paint (no hero
     gate) — CSS already renders it, JS only steps it aside while a
     bottom-fixed element (cart drawer, product buybar, wiki sheet)
     would collide, then fades it back. */
  function initDiscordFab() {
    var el = document.querySelector('[data-dc-fab]');
    if (!el) return;
    var hidden = null;
    function update() {
      var hide = anyBlocker(BOTTOM_BLOCKERS);
      if (hide !== hidden) { hidden = hide; el.classList.toggle('is-hidden', hide); }
    }
    update();
    var raf = false;
    function schedule() { if (raf) return; raf = true; window.requestAnimationFrame(function () { raf = false; update(); }); }
    window.addEventListener('resize', schedule);
    try {
      new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    } catch (e) {}
  }

  /* ─── boot ──────────────────────────────────────────────────────
     Shell + drawer are server-rendered → no include shim, everything
     binds in one pass. */
  function boot() {
    initYear();
    markActiveNav();
    initNavMore();
    /* SHOP DEAKTIVIERT 2026-09-24 — zum Reaktivieren Kommentar entfernen (siehe audit/DECISIONS.md E16)
    if (window.FrugendsCart) window.FrugendsCart.mount();
    */
    initStickyCTA();
    initDiscordFab();
    initCreatorModal();
    initFaq();
    initReveal();
    initAppModal();
    initSponsorModal();
    initHeroVideo();
    initParallax();
    if (window.ScrollCinema && typeof window.ScrollCinema.refresh === 'function') {
      window.ScrollCinema.refresh();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
