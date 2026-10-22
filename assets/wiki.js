/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — WIKI  (vanilla JS, no framework, no jQuery, Liquid-safe)
   ───────────────────────────────────────────────────────────────
   Client-side renderer + hash-router + scrollspy + instant search
   over assets/data/wiki.json. Drives the static shell in wiki.html.

     Views (hash-router):
       #/                        → HUB   (category cards)
       #/<cat>                   → ARTICLE (all sections of a cat)
       #/<cat>/<sec>             → ARTICLE, scrolled to that section

     Features:
       1. Sidebar nav (all 12 cats, sub-list for the active cat)
       2. Hub cards · 3. Article view · 4. Breadcrumbs · 5. Pager
       6. Scrollspy (reading line ~24% viewport, rAF + IO — mirrors
          legal-toc.js) · 7. Deep-link + anchor scroll
       8. Mobile sidebar toggle
       9. Instant, diacritic-insensitive search with keyboard nav

   Everything reads the DOM + fetches a JSON asset only, so it is a
   drop-in for the Shopify/Liquid theme. All content is emitted via
   textContent / createElement (XSS-safe); the only markup we build
   is controlled <mark> highlight spans, assembled from split text
   nodes — never innerHTML of content text.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  function scrollBehavior() { return reduceMQ.matches ? 'auto' : 'smooth'; }

  /* ─── module state ─────────────────────────────────────────────*/
  var data = null;
  var categories = [];
  var bySlug = {};
  var searchIndex = [];

  // DOM refs (filled at boot)
  var nav, content, crumbs, pager, input, results, searchForm, searchWrap,
      navToggle, sidebar;

  // router / render state
  var state = { rendered: false, catSlug: undefined };
  var firstRoute = true;

  // scrollspy teardown handles
  var spyHandler = null, spyIO = null;

  // search keyboard state
  var activeIndex = -1;

  // mobile section-nav (sticky "Auf dieser Seite" bar + bottom sheet)
  var secbarCurrentEl = null, sheetLinks = [];

  /* ─── small helpers ────────────────────────────────────────────*/
  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function pad(n) { n = Number(n) || 0; return (n < 10 ? '0' : '') + n; }

  var FOLD = { 'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 's' };
  // 1:1 length-preserving fold so match indices are valid in the
  // ORIGINAL string too (lowercasing + these maps never change length).
  function normalize(s) {
    return (s || '').toLowerCase().replace(/[äöüß]/g, function (m) { return FOLD[m]; });
  }

  /* Turn a raw body[] into render blocks, dropping empty items.
     Consecutive li → one <ul class="wiki-list">; p → <p>. */
  function buildBlocks(body) {
    var blocks = [], curUl = null;
    (body || []).forEach(function (item) {
      var text = (item && item.x || '').trim();
      if (!text) return;                 // skip the stray empty li/p noise
      if (item.t === 'li') {
        if (!curUl) { curUl = { type: 'ul', items: [] }; blocks.push(curUl); }
        curUl.items.push(text);
      } else {
        curUl = null;
        blocks.push({ type: 'p', text: text });
      }
    });
    return blocks;
  }
  function textOf(body) {
    var parts = [];
    (body || []).forEach(function (item) {
      var t = (item && item.x || '').trim();
      if (t) parts.push(t);
    });
    return parts.join(' ');
  }

  function parseHash(h) {
    h = (h || '').replace(/^#/, '').replace(/^\//, '');
    if (!h) return { cat: null, sec: null };
    var parts = h.split('/').filter(Boolean);
    return { cat: parts[0] || null, sec: parts[1] || null };
  }

  function renderBlocksInto(container, blocks) {
    blocks.forEach(function (b) {
      if (b.type === 'p') {
        container.appendChild(mk('p', null, b.text));
      } else {
        var ul = mk('ul', 'wiki-list');
        b.items.forEach(function (t) { ul.appendChild(mk('li', null, t)); });
        container.appendChild(ul);
      }
    });
  }

  function setContent(node) {
    content.innerHTML = '';
    content.appendChild(node);
  }

  /* ─── 1. SIDEBAR NAV ───────────────────────────────────────────*/
  function renderNav(activeSlug) {
    var ol = mk('ol', 'wiki-nav__list');
    categories.forEach(function (cat) {
      var active = cat.slug === activeSlug;
      var li = mk('li', 'wiki-nav__cat' + (active ? ' is-active' : ''));
      li.setAttribute('data-cat', cat.slug);

      var link = mk('a', 'wiki-nav__cat-link' + (active ? ' is-current' : ''));
      link.href = '#/' + cat.slug;
      link.appendChild(mk('span', 'wiki-nav__icon', cat.icon || ''));
      link.appendChild(mk('span', null, cat.title));
      link.appendChild(mk('span', 'wiki-nav__count', String(cat.sections.length)));
      li.appendChild(link);

      if (active) {
        var sub = mk('ol', 'wiki-nav__sub');
        cat.sections.forEach(function (sec) {
          var sli = mk('li');
          var sa = mk('a', 'wiki-nav__sub-link', sec.heading);
          sa.href = '#/' + cat.slug + '/' + sec.slug;
          sli.appendChild(sa);
          sub.appendChild(sli);
        });
        li.appendChild(sub);
      }
      ol.appendChild(li);
    });
    nav.innerHTML = '';
    nav.appendChild(ol);
  }

  /* ─── 2. HUB VIEW ──────────────────────────────────────────────*/
  function renderHubView() {
    renderNav(null);

    var hub = mk('div', 'wiki-hub');
    var cards = mk('ol', 'wiki-cards');
    categories.forEach(function (cat, i) {
      var li = mk('li', 'wiki-card');
      li.style.setProperty('--i', String(i));
      var a = mk('a', 'wiki-card__link');
      a.href = '#/' + cat.slug;
      var no = mk('span', 'wiki-card__no', pad(cat.n));
      no.setAttribute('aria-hidden', 'true'); // Wasserzeichen-Nummer, nur Schmuck
      a.appendChild(no);
      var ico = mk('span', 'wiki-card__icon', cat.icon || '');
      ico.setAttribute('aria-hidden', 'true');
      a.appendChild(ico);
      a.appendChild(mk('h2', 'wiki-card__title', cat.title));
      a.appendChild(mk('p', 'wiki-card__sub', cat.subtitle || ''));
      a.appendChild(mk('span', 'wiki-card__meta', cat.sections.length + ' Themen'));
      li.appendChild(a);
      cards.appendChild(li);
    });
    hub.appendChild(cards);
    setContent(hub);

    renderCrumbsHub();
    pager.innerHTML = '';
    document.title = (data && data.title) || 'Frugends Wiki';
    teardownSpy();
    removeSecNav();
  }

  /* ─── mobile section-nav: sticky "Auf dieser Seite" bar + bottom sheet ─
     Article-view only, mobile-only (CSS-gated ≤899px). The bar shows the
     live current section (fed by scrollspy setActive); tapping opens a
     sheet of all sections. Desktop keeps the sticky sidebar sub-nav. */
  function removeSecNav() {
    var bar = document.querySelector('.wiki-secbar');
    var sheet = document.querySelector('.wiki-secsheet');
    if (bar) bar.remove();
    if (sheet) sheet.remove();
    secbarCurrentEl = null; sheetLinks = [];
    document.documentElement.style.overflow = '';
  }

  function renderSecNav(cat) {
    removeSecNav();
    var mainEl = content.closest('.wiki-main');
    var root = document.querySelector('main.wiki') || document.body;
    if (!mainEl || !cat.sections.length) return;

    var bar = mk('button', 'wiki-secbar');
    bar.type = 'button';
    bar.setAttribute('data-wiki-secbar', '');
    bar.setAttribute('aria-expanded', 'false');
    bar.setAttribute('aria-controls', 'wiki-secsheet');
    bar.appendChild(mk('span', 'wiki-secbar__label', 'Auf dieser Seite'));
    secbarCurrentEl = mk('span', 'wiki-secbar__current', cat.sections[0].heading);
    bar.appendChild(secbarCurrentEl);
    bar.appendChild(mk('span', 'wiki-secbar__chev'));
    mainEl.insertBefore(bar, mainEl.firstChild);

    var sheet = mk('div', 'wiki-secsheet');
    sheet.id = 'wiki-secsheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Auf dieser Seite');
    sheet.hidden = true;
    var scrim = mk('div', 'wiki-secsheet__scrim');
    sheet.appendChild(scrim);
    var panel = mk('nav', 'wiki-secsheet__panel');
    var head = mk('header', 'wiki-secsheet__head', 'Auf dieser Seite');
    var closeBtn = mk('button', 'wiki-secsheet__close', '✕');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Schließen');
    head.appendChild(closeBtn);
    panel.appendChild(head);
    var list = mk('ol', 'wiki-secsheet__list');
    sheetLinks = [];
    cat.sections.forEach(function (sec) {
      var li = mk('li');
      var a = mk('a', 'wiki-secsheet__link', sec.heading);
      a.href = '#/' + cat.slug + '/' + sec.slug;
      li.appendChild(a);
      list.appendChild(li);
      sheetLinks.push(a);
    });
    panel.appendChild(list);
    sheet.appendChild(panel);
    root.appendChild(sheet);

    function onKey(e) { if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); closeSheet(); } }
    function openSheet() {
      sheet.hidden = false;
      window.requestAnimationFrame(function () { sheet.classList.add('is-open'); });
      bar.setAttribute('aria-expanded', 'true');
      document.documentElement.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey, true);
      var f = list.querySelector('a'); if (f) f.focus();
    }
    function closeSheet() {
      sheet.classList.remove('is-open');
      bar.setAttribute('aria-expanded', 'false');
      document.documentElement.style.overflow = '';
      document.removeEventListener('keydown', onKey, true);
      window.setTimeout(function () { if (!sheet.classList.contains('is-open')) sheet.hidden = true; }, 260);
    }
    bar.addEventListener('click', openSheet);
    scrim.addEventListener('click', closeSheet);
    closeBtn.addEventListener('click', closeSheet);
    sheetLinks.forEach(function (a) { a.addEventListener('click', closeSheet); });
  }

  /* ─── 3. ARTICLE VIEW ──────────────────────────────────────────*/
  function renderArticleView(cat) {
    renderNav(cat.slug);

    var frag = document.createDocumentFragment();

    var head = mk('header', 'wiki-article__head');
    head.appendChild(mk('span', 'wiki-article__no', pad(cat.n)));
    head.appendChild(mk('h1', 'wiki-article__title', cat.title));
    head.appendChild(mk('p', 'wiki-article__sub', cat.subtitle || ''));
    frag.appendChild(head);

    if (cat._introBlocks.length) {
      var intro = mk('div', 'wiki-article__intro');
      renderBlocksInto(intro, cat._introBlocks);
      frag.appendChild(intro);
    }

    cat.sections.forEach(function (sec) {
      var s = mk('section', 'wiki-section');
      s.id = 'sec-' + cat.slug + '-' + sec.slug;
      s.setAttribute('data-sec', sec.slug);

      var h2 = mk('h2', 'wiki-section__title', sec.heading);
      var anchor = mk('a', 'wiki-section__anchor', '#');
      anchor.href = '#/' + cat.slug + '/' + sec.slug;
      anchor.setAttribute('aria-label', 'Abschnitts-Link');
      h2.appendChild(anchor);
      s.appendChild(h2);

      var bodyEl = mk('div', 'wiki-section__body');
      renderBlocksInto(bodyEl, sec._blocks);
      s.appendChild(bodyEl);

      frag.appendChild(s);
    });
    setContent(frag);

    renderCrumbsArticle(cat);
    renderPager(cat);
    renderSecNav(cat);
    document.title = cat.title + ' — ' + ((data && data.title) || 'Frugends Wiki');
    setupScrollspy(cat);
  }

  /* ─── 4. BREADCRUMBS ───────────────────────────────────────────*/
  function renderCrumbsHub() {
    var ol = mk('ol', 'wiki-crumbs__list');
    var li = mk('li', null, 'Wiki');
    li.setAttribute('aria-current', 'page');
    ol.appendChild(li);
    crumbs.innerHTML = '';
    crumbs.appendChild(ol);
  }
  function renderCrumbsArticle(cat) {
    var ol = mk('ol', 'wiki-crumbs__list');
    var l1 = mk('li');
    var a = mk('a', null, 'Wiki');
    a.href = '#/';
    l1.appendChild(a);
    var l2 = mk('li', null, cat.title);
    l2.setAttribute('aria-current', 'page');
    ol.appendChild(l1);
    ol.appendChild(l2);
    crumbs.innerHTML = '';
    crumbs.appendChild(ol);
  }

  /* ─── 5. PAGER ─────────────────────────────────────────────────*/
  function pagerLink(dir, label, cat) {
    var a = mk('a', 'wiki-pager__link wiki-pager__' + dir);
    a.href = '#/' + cat.slug;
    a.appendChild(mk('span', null, label));
    a.appendChild(mk('strong', null, cat.title));
    return a;
  }
  function renderPager(cat) {
    var idx = categories.indexOf(cat);
    var prev = categories[idx - 1];
    var next = categories[idx + 1];
    pager.innerHTML = '';
    if (prev) pager.appendChild(pagerLink('prev', 'Zurück', prev));
    if (next) pager.appendChild(pagerLink('next', 'Weiter', next));
  }

  /* ─── 6. SCROLLSPY (mirrors legal-toc.js) ──────────────────────*/
  function teardownSpy() {
    if (spyHandler) { window.removeEventListener('scroll', spyHandler); spyHandler = null; }
    if (spyIO) { spyIO.disconnect(); spyIO = null; }
  }
  function setupScrollspy(cat) {
    teardownSpy();
    var sections = Array.prototype.slice.call(content.querySelectorAll('.wiki-section'));
    if (!sections.length) return;
    var subLinks = Array.prototype.slice.call(nav.querySelectorAll('.wiki-nav__sub-link'));
    var catSlug = cat.slug;

    function setActive(sec) {
      var href = sec ? '#/' + catSlug + '/' + sec.getAttribute('data-sec') : null;
      subLinks.forEach(function (a) {
        var on = a.getAttribute('href') === href;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
      // mobile section bar + sheet mirror the same active section
      sheetLinks.forEach(function (a) {
        var on = a.getAttribute('href') === href;
        a.classList.toggle('is-active', on);
        if (on && secbarCurrentEl) secbarCurrentEl.textContent = a.textContent;
      });
    }
    // the section whose top sits closest above the reading line wins
    function currentSec() {
      var line = window.innerHeight * 0.24;
      var cur = sections[0];
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= line) cur = sections[i];
        else break;
      }
      return cur;
    }

    var tick = false;
    function spy() {
      if (tick) return;
      tick = true;
      window.requestAnimationFrame(function () {
        tick = false;
        setActive(currentSec());
      });
    }
    spyHandler = spy;

    if ('IntersectionObserver' in window) {
      spyIO = new IntersectionObserver(spy, {
        rootMargin: '0px 0px -76% 0px',
        threshold: [0, 1]
      });
      sections.forEach(function (s) { spyIO.observe(s); });
    }
    // IO alone misses fast scrolls — cheap rAF-coalesced scroll listener too
    window.addEventListener('scroll', spy, { passive: true });
    spy(); // initial state
  }

  /* ─── 7. deep-link / anchor scroll ─────────────────────────────
     Explicit window.scrollTo with a MEASURED sticky offset (site-header
     + the mobile section-bar) instead of scrollIntoView + CSS
     scroll-margin. On mobile Safari/Chrome the latter lands the heading
     under the sticky chrome (looked like "nothing happens"). Double-rAF
     runs the scroll AFTER the click-tick DOM changes settle (sidebar
     collapse / sheet close / view render); deep links also re-assert
     once the async shell header + fonts have laid out. */
  function stickyOffset() {
    var o = 0;
    var header = document.querySelector('.site-header');
    if (header && getComputedStyle(header).position === 'sticky') o += header.offsetHeight;
    var bar = document.querySelector('.wiki-secbar');
    if (bar && getComputedStyle(bar).display !== 'none') o += bar.offsetHeight;
    return o + 14;
  }
  function scrollToY(y, instant) {
    y = Math.max(0, Math.round(y));
    try { window.scrollTo({ top: y, behavior: instant ? 'auto' : scrollBehavior() }); }
    catch (e) { window.scrollTo(0, y); }
  }
  function afterSettle(fn) {
    window.requestAnimationFrame(function () { window.requestAnimationFrame(fn); });
  }
  function scrollToSection(id, instant) {
    var el = document.getElementById(id);
    if (!el) return;
    var run = function () { scrollToY(el.getBoundingClientRect().top + window.pageYOffset - stickyOffset(), instant); };
    afterSettle(run);
    if (instant) { window.setTimeout(run, 260); window.setTimeout(run, 600); } // deep-link: shell/fonts settle
  }
  function scrollToContentTop() {
    var layout = document.querySelector('.wiki-layout');
    if (!layout) return;
    afterSettle(function () { scrollToY(layout.getBoundingClientRect().top + window.pageYOffset - stickyOffset(), false); });
  }

  /* ─── ROUTER ───────────────────────────────────────────────────*/
  function route() {
    var r = parseHash(location.hash);
    var cat = r.cat ? bySlug[r.cat] : null;
    if (r.cat && !cat) { cat = null; r = { cat: null, sec: null }; } // unknown → hub

    var catSlug = cat ? cat.slug : null;
    var changed = !state.rendered || catSlug !== state.catSlug;

    if (changed) {
      state.rendered = true;
      state.catSlug = catSlug;
      if (cat) renderArticleView(cat);
      else renderHubView();
    }

    if (cat && r.sec) {
      scrollToSection('sec-' + cat.slug + '-' + r.sec, firstRoute);
    } else if (changed && cat && !firstRoute) {
      scrollToContentTop();
    }
    firstRoute = false;
  }

  /* ─── 8. MOBILE SIDEBAR TOGGLE ─────────────────────────────────*/
  function closeSidebar() {
    if (sidebar && sidebar.classList.contains('is-open')) {
      sidebar.classList.remove('is-open');
      if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    }
  }
  function wireSidebar() {
    if (!navToggle || !sidebar) return;
    navToggle.addEventListener('click', function () {
      var open = sidebar.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  /* ─── 9. SEARCH ────────────────────────────────────────────────*/
  function buildIndex() {
    searchIndex = [];
    categories.forEach(function (cat) {
      // category-level entry (title + subtitle) so a category name matches
      searchIndex.push({
        catTitle: cat.title, catSlug: cat.slug, heading: cat.title,
        body: cat.subtitle || '', url: '#/' + cat.slug, isCat: true,
        nHeading: normalize(cat.title), nBody: normalize(cat.subtitle || '')
      });
      cat.sections.forEach(function (sec) {
        searchIndex.push({
          catTitle: cat.title, catSlug: cat.slug, heading: sec.heading,
          body: sec._bodyText, url: '#/' + cat.slug + '/' + sec.slug, isCat: false,
          nHeading: normalize(sec.heading), nBody: normalize(sec._bodyText)
        });
      });
    });
  }

  function searchMatches(nq) {
    var res = [];
    searchIndex.forEach(function (e, i) {
      var hIdx = e.nHeading.indexOf(nq);
      var bIdx = e.nBody.indexOf(nq);
      if (hIdx < 0 && bIdx < 0) return;
      // rank: category-title hit > section-heading hit > body hit
      var rank = hIdx >= 0 ? (e.isCat ? 0 : 1) : 2;
      res.push({ e: e, rank: rank, hIdx: hIdx, bIdx: bIdx, pos: hIdx >= 0 ? hIdx : bIdx, order: i });
    });
    res.sort(function (a, b) {
      return (a.rank - b.rank) || (a.pos - b.pos) || (a.order - b.order);
    });
    return res.slice(0, 8);
  }

  // append `text` to parent, wrapping [idx, idx+len) in <mark> (safe nodes)
  function fillHighlight(parent, text, idx, len) {
    if (idx < 0) { parent.appendChild(document.createTextNode(text)); return; }
    parent.appendChild(document.createTextNode(text.slice(0, idx)));
    var m = document.createElement('mark');
    m.textContent = text.slice(idx, idx + len);
    parent.appendChild(m);
    parent.appendChild(document.createTextNode(text.slice(idx + len)));
  }

  function buildSnippet(parent, body, bIdx, len) {
    var CTX = 140;
    var half = Math.max(0, Math.floor((CTX - len) / 2));
    var start = Math.max(0, bIdx - half);
    var end = Math.min(body.length, start + CTX);
    start = Math.max(0, Math.min(start, end - CTX)); // keep window size near the tail
    var pre = start > 0 ? '… ' : '';
    var suf = end < body.length ? ' …' : '';
    var slice = body.slice(start, end);
    if (pre) parent.appendChild(document.createTextNode(pre));
    fillHighlight(parent, slice, bIdx - start, len);
    if (suf) parent.appendChild(document.createTextNode(suf));
  }

  function closeSearch() {
    if (!results) return;
    results.hidden = true;
    results.innerHTML = '';
    activeIndex = -1;
    if (input) {
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
  }

  function renderSearch(raw) {
    if (!results || !input) return;
    var q = (raw || '').trim();
    var nq = normalize(q);
    if (nq.length < 2) { closeSearch(); return; }

    var matches = searchMatches(nq);
    results.innerHTML = '';
    activeIndex = -1;

    if (!matches.length) {
      var p = mk('p', 'wiki-search__empty');
      p.appendChild(document.createTextNode('Keine Treffer für „' + q + '".'));
      results.appendChild(p);
    } else {
      var ul = mk('ul', 'wiki-search__list');
      matches.forEach(function (m, idx) {
        var li = mk('li', 'wiki-search__result');
        li.setAttribute('role', 'option');
        li.id = 'wsr-' + idx;
        var a = mk('a');
        a.href = m.e.url;
        a.appendChild(mk('span', 'wiki-search__cat', m.e.catTitle));

        var title = mk('span', 'wiki-search__title');
        fillHighlight(title, m.e.heading, m.hIdx, nq.length);
        a.appendChild(title);

        if (m.bIdx >= 0) { // snippet only when the body actually matched
          var snip = mk('span', 'wiki-search__snip');
          buildSnippet(snip, m.e.body, m.bIdx, nq.length);
          a.appendChild(snip);
        }
        li.appendChild(a);
        ul.appendChild(li);
      });
      results.appendChild(ul);
    }

    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    input.removeAttribute('aria-activedescendant');
  }

  function setActiveItem(items) {
    Array.prototype.forEach.call(items, function (it, i) {
      it.classList.toggle('is-active', i === activeIndex);
    });
    if (activeIndex >= 0) {
      var el = items[activeIndex];
      input.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }
  function moveActive(dir, items) {
    var n = items.length;
    if (!n) return;
    if (activeIndex < 0) activeIndex = dir > 0 ? 0 : n - 1;
    else activeIndex = (activeIndex + dir + n) % n;
    setActiveItem(items);
  }

  function wireSearch() {
    if (!input || !results) return;

    input.addEventListener('input', function () { renderSearch(input.value); });

    input.addEventListener('keydown', function (e) {
      var items = results.querySelectorAll('.wiki-search__result');
      if (e.key === 'Escape' || e.key === 'Esc') {
        input.value = '';
        closeSearch();
        input.blur();
        return;
      }
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1, items); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1, items); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        var target = activeIndex >= 0 ? items[activeIndex] : items[0];
        var link = target && target.querySelector('a');
        if (link) {
          location.hash = link.getAttribute('href');
          closeSearch();
          input.blur();
        }
      }
    });

    // mouse hover mirrors keyboard selection
    results.addEventListener('mousemove', function (e) {
      var li = e.target.closest && e.target.closest('.wiki-search__result');
      if (!li) return;
      var items = results.querySelectorAll('.wiki-search__result');
      var i = Array.prototype.indexOf.call(items, li);
      if (i !== -1 && i !== activeIndex) { activeIndex = i; setActiveItem(items); }
    });

    // clicking a result: the href routes it — just close the dropdown
    results.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      closeSearch();
      input.blur();
    });

    if (searchForm) {
      searchForm.addEventListener('submit', function (e) { e.preventDefault(); });
    }

    // outside click closes the dropdown
    document.addEventListener('click', function (e) {
      if (searchWrap && !searchWrap.contains(e.target)) closeSearch();
    });

    // focus shortcuts: "/" (not while typing) and Cmd/Ctrl+K
    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented) return;
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault(); input.focus(); input.select(); return;
      }
      if (e.key === '/' && !isTypingTarget(e.target)) {
        e.preventDefault(); input.focus();
      }
    });
  }

  function isTypingTarget(el) {
    if (!el) return false;
    var t = (el.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select' || el.isContentEditable;
  }

  /* ─── global link handling: sidebar auto-close + force-scroll ──
     Clicking a "#/…" link that equals the current hash fires no
     hashchange — so we scroll to the section ourselves. And any nav
     link tap collapses the mobile sidebar. */
  function wireGlobalLinks() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href^="#/"]') : null;
      if (!a) return;
      if (nav && nav.contains(a)) closeSidebar();
      if (a.getAttribute('href') === location.hash) {
        var r = parseHash(location.hash);
        if (r.cat && r.sec) {
          e.preventDefault();
          scrollToSection('sec-' + r.cat + '-' + r.sec);
        }
      }
    });
  }

  /* ─── robustness: friendly failure ─────────────────────────────*/
  function showError() {
    teardownSpy();
    if (nav) nav.innerHTML = '';
    if (crumbs) crumbs.innerHTML = '';
    if (pager) pager.innerHTML = '';
    if (!content) return;
    content.innerHTML = '';
    var wrap = mk('div', 'wiki-error');
    wrap.appendChild(mk('p', null,
      'Das Wiki konnte gerade nicht geladen werden. Bitte lade die Seite neu oder versuche es später erneut.'));
    var a = mk('a', null, 'Zur Übersicht');
    a.href = '#/';
    wrap.appendChild(a);
    content.appendChild(wrap);
  }

  /* ─── boot ─────────────────────────────────────────────────────*/
  function boot() {
    var main = document.getElementById('main');
    if (!main || !/\bwiki\b/.test(main.className)) return;

    nav = main.querySelector('[data-wiki-nav]');
    content = main.querySelector('[data-wiki-content]');
    crumbs = main.querySelector('[data-wiki-crumbs]');
    pager = main.querySelector('[data-wiki-pager]');
    input = document.getElementById('wiki-search-input');
    results = document.getElementById('wiki-search-results');
    searchForm = main.querySelector('[data-wiki-search-form]');
    searchWrap = input ? input.closest('.wiki-search') : null;
    navToggle = main.querySelector('[data-wiki-nav-toggle]');
    sidebar = main.querySelector('.wiki-sidebar');
    var taglineEl = main.querySelector('[data-wiki-tagline]');

    if (!nav || !content) return;

    var src = main.getAttribute('data-wiki-src') || 'assets/data/wiki.json';

    fetch(src, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('wiki fetch → ' + res.status);
        return res.json();
      })
      .then(function (json) {
        data = json;
        categories = (json.categories || []).slice().sort(function (a, b) {
          return (a.n || 0) - (b.n || 0);
        });
        categories.forEach(function (cat) {
          bySlug[cat.slug] = cat;
          cat.sections = cat.sections || [];
          cat._introBlocks = buildBlocks(cat.intro || []);
          cat.sections.forEach(function (sec) {
            sec._blocks = buildBlocks(sec.body || []);
            sec._bodyText = textOf(sec.body || []);
          });
        });

        if (taglineEl && json.tagline) taglineEl.textContent = json.tagline;

        buildIndex();
        wireSearch();
        wireSidebar();
        wireGlobalLinks();

        route(); // handle the initial hash (incl. deep links)
        window.addEventListener('hashchange', route);
      })
      .catch(function (err) {
        if (window.console) console.error('[wiki]', err);
        showError();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
