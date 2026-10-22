/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — LEGAL TOC  (vanilla JS, no framework, Liquid-safe)
   ───────────────────────────────────────────────────────────────
   Enhances the legal document pages (AGB · Teilnahmebedingungen ·
   Widerruf · Datenschutz) with a Stripe/Vercel-grade reading UX:

     1. Auto-TOC       → collects h2[id] inside .legal-content and
                         renders the list into every [data-legal-toc]
                         container (desktop aside + mobile <details>).
     2. Scrollspy      → IntersectionObserver marks the section whose
                         heading sits near the viewport top (.is-active).
     3. Smooth scroll  → TOC clicks scroll smoothly (auto under
                         prefers-reduced-motion), update the URL hash.
     4. Heading anchor → subtle “#” copy-link button per h2.
     5. Back-to-top    → floating button after ~800px scroll.
     6. Mobile <details> TOC works without JS; JS closes it on jump.

   Liquid note: everything reads the DOM that {{ page.content }}
   renders — no data dependencies, drop-in for the Shopify theme.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  function scrollBehavior() {
    return reduceMQ.matches ? 'auto' : 'smooth';
  }

  /* ─── 1+2+3. TOC build + scrollspy + smooth scroll ─────────────*/
  function initToc(headings) {
    var containers = document.querySelectorAll('[data-legal-toc]');
    if (!containers.length || !headings.length) return;

    var allLinks = [];

    Array.prototype.forEach.call(containers, function (container) {
      var list = document.createElement('ol');
      list.className = 'legal-toc__list';

      headings.forEach(function (h) {
        var li = document.createElement('li');
        li.className = 'legal-toc__item';
        var a = document.createElement('a');
        a.className = 'legal-toc__link';
        a.href = '#' + h.id;
        a.textContent = h.dataset.tocLabel || h.textContent.trim();
        li.appendChild(a);
        list.appendChild(li);
        allLinks.push(a);
      });

      container.appendChild(list);
    });

    /* click → smooth scroll + hash + close mobile details */
    allLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        var target = document.getElementById(id);
        if (!target) return; // let the browser try
        e.preventDefault();

        if (history.pushState) history.pushState(null, '', '#' + id);
        else location.hash = id;

        target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
        setActive(id);

        var details = a.closest('details.legal-toc-mobile');
        if (details) {
          // let the scroll start before collapsing (avoids layout jump mid-scroll)
          window.setTimeout(function () { details.open = false; }, 120);
        }
      });
    });

    function setActive(id) {
      allLinks.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + id;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    }

    /* scrollspy — the heading closest above the “reading line”
       (top 24% of the viewport) wins. IO fires whenever a heading
       crosses that band; we then pick the last heading above it. */
    function currentHeadingId() {
      var line = window.innerHeight * 0.24;
      var current = headings[0].id;
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= line) current = headings[i].id;
        else break;
      }
      return current;
    }

    var spyTick = false;
    function spy() {
      if (spyTick) return;
      spyTick = true;
      window.requestAnimationFrame(function () {
        spyTick = false;
        setActive(currentHeadingId());
      });
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(spy, {
        // band around the reading line: heading near viewport top wins
        rootMargin: '0px 0px -76% 0px',
        threshold: [0, 1]
      });
      headings.forEach(function (h) { io.observe(h); });
      // IO alone misses fast scrolls between callbacks — cheap rAF-coalesced
      // scroll listener keeps the active state exact.
      window.addEventListener('scroll', spy, { passive: true });
    } else {
      window.addEventListener('scroll', spy, { passive: true });
    }

    spy(); // initial state (incl. deep links)
    window.addEventListener('hashchange', function () {
      var id = location.hash.slice(1);
      if (id && document.getElementById(id)) setActive(id);
    });
  }

  /* ─── 4. Heading copy-link anchors ─────────────────────────────*/
  function initAnchors(headings) {
    headings.forEach(function (h) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'legal-anchor';
      btn.textContent = '#';
      btn.setAttribute('aria-label', 'Link zu „' + (h.dataset.tocLabel || h.textContent.trim()) + '“ kopieren');
      btn.title = 'Abschnitts-Link kopieren';

      btn.addEventListener('click', function () {
        var url = location.origin + location.pathname + location.search + '#' + h.id;
        var done = function () {
          btn.classList.add('is-copied');
          btn.textContent = '✓';
          btn.title = 'Kopiert!';
          window.setTimeout(function () {
            btn.classList.remove('is-copied');
            btn.textContent = '#';
            btn.title = 'Abschnitts-Link kopieren';
          }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, function () {
            location.hash = h.id; done();
          });
        } else {
          location.hash = h.id; done();
        }
      });

      h.appendChild(btn);
    });
  }

  /* ─── 5. Back-to-top button ────────────────────────────────────*/
  function initBackToTop() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'legal-top-btn';
    btn.setAttribute('aria-label', 'Zurück nach oben');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 19V5"></path><path d="M5 12l7-7 7 7"></path></svg>';
    document.body.appendChild(btn);

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
    });

    var tick = false;
    function onScroll() {
      if (tick) return;
      tick = true;
      window.requestAnimationFrame(function () {
        tick = false;
        btn.classList.toggle('is-visible', window.scrollY > 800);
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ─── boot ─────────────────────────────────────────────────────*/
  function boot() {
    var content = document.querySelector('.legal-content');
    if (!content) return;

    var headings = Array.prototype.slice.call(content.querySelectorAll('h2[id]'));
    // pin the clean label before anchor buttons are appended
    headings.forEach(function (h) { h.dataset.tocLabel = h.textContent.trim(); });

    initToc(headings);
    initAnchors(headings);
    initBackToTop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
