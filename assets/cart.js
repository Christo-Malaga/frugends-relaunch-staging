/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — CART (Shopify AJAX Cart API port)
   ───────────────────────────────────────────────────────────────
   Same drawer DOM contract as the verified static build (open/close,
   focus-trap, badge, free-shipping progress, line steppers) — but the
   MODEL is Shopify's real cart:
     read       → GET  /cart.js
     add        → POST /cart/add.js     { id: <variantId>, quantity }
     changeQty  → POST /cart/change.js  { id: <line item key>, quantity }
     remove     → POST /cart/change.js  { id: <line item key>, quantity: 0 }
   First paint is server-rendered by snippets/fg-cart-drawer.liquid;
   this file re-renders the same markup after every mutation.

   Lines mit final_line_price == 0 (z. B. Zugaben aus automatischen
   Rabatten im Admin) werden als "Gratis" gerendert (cart-item--free).

   Geladen wird die Datei nur, wenn im Header-Section-Setting
   "show_cart" aktiv ist (Script-Tag in sections/fg-shell-header).

   FREE_DE muss mit `free_ship_threshold` im Snippet übereinstimmen.
   ═══════════════════════════════════════════════════════════════ */
/* SHOP DEAKTIVIERT 2026-09-24 — zum Reaktivieren Kommentar entfernen (siehe audit/DECISIONS.md E16)
   Wird nicht mehr geladen (Script-Tag in sections/fg-shell-header.liquid auskommentiert).
   Der gesamte Code unten ist zeilenweise mit "// " auskommentiert —
   zum Reaktivieren die Zeilen markieren und den Zeilenkommentar entfernen
   (VS Code: Strg+#), dann node --check cart.js. */
// (function () {
//   'use strict';

//   var FREE_DE = 3000; // minor units — free shipping DE threshold (= snippet)
//   var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
//   var euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

//   var drawer, scrim, lines, emptyEl, footEl, shipEl, shipFill, shipMsg, subtotalEl,
//       badgeEls = [], countEl, opener = null, mounted = false;
//   var state = null;        // last cart JSON from Shopify
//   var moneyFormat = null;  // shop.money_format via data attr on the drawer

//   /* ── money ──
//      Uses the shop's money format (data-money-format on #cart-drawer) so
//      client re-renders match the Liquid `| money` first paint; falls back
//      to Intl de-DE EUR. */
//   function formatMoney(cents) {
//     if (moneyFormat) {
//       var value = '';
//       var m = moneyFormat.match(/\{\{\s*(\w+)\s*\}\}/);
//       var amount = (cents / 100);
//       switch (m ? m[1] : 'amount') {
//         case 'amount_no_decimals':
//           value = String(Math.round(amount)); break;
//         case 'amount_with_comma_separator':
//           value = amount.toFixed(2).replace('.', ','); break;
//         case 'amount_no_decimals_with_comma_separator':
//           value = String(Math.round(amount)); break;
//         case 'amount_with_apostrophe_separator':
//           value = amount.toFixed(2); break;
//         default:
//           value = amount.toFixed(2);
//       }
//       return moneyFormat.replace(/\{\{\s*\w+\s*\}\}/, value).replace(/<[^>]*>/g, '').trim();
//     }
//     return euro.format(cents / 100);
//   }

//   /* ── model (Shopify AJAX Cart API) ── */
//   function api(url, payload) {
//     var opts = { credentials: 'same-origin', headers: { 'Accept': 'application/json' } };
//     if (payload) {
//       opts.method = 'POST';
//       opts.headers['Content-Type'] = 'application/json';
//       opts.body = JSON.stringify(payload);
//     }
//     return fetch(url, opts).then(function (res) {
//       return res.json().then(function (json) {
//         if (!res.ok) { var e = new Error('cart api ' + res.status); e.payload = json; throw e; }
//         return json;
//       });
//     });
//   }
//   function refresh() {
//     return api('/cart.js').then(function (cart) { state = cart; render(); return cart; });
//   }

//   /* add({ id: <variantId>, quantity: <n> }) → Promise<cart> */
//   function add(item) {
//     if (!item || !item.id) return Promise.reject(new Error('missing variant id'));
//     return api('/cart/add.js', { id: item.id, quantity: item.quantity || 1 })
//       .then(refresh)
//       .then(function (cart) { bumpBadge(); open(); return cart; })
//       .catch(function (err) {
//         var msg = (err.payload && (err.payload.description || err.payload.message)) ||
//                   'Konnte den Artikel nicht hinzufügen. Bitte versuch es erneut.';
//         window.alert(msg);
//         throw err;
//       });
//   }
//   function changeQty(key, qty) {
//     return api('/cart/change.js', { id: key, quantity: Math.max(0, Math.min(99, qty)) })
//       .then(function (cart) { state = cart; render(); return cart; })
//       .catch(function (err) {
//         if (window.console) console.error('[cart]', err);
//         return refresh();
//       });
//   }
//   function remove(key) { return changeQty(key, 0); }

//   /* ── DOM helpers ── */
//   function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

//   function lineNode(it) {
//     var isFree = it.final_line_price === 0;
//     var li = mk('li', 'cart-item'); li.setAttribute('data-line-key', it.key);
//     if (isFree) li.classList.add('cart-item--free');
//     var thumb = mk('div', 'cart-item__thumb');
//     if (it.image) {
//       var im = mk('img');
//       im.src = it.image; im.alt = ''; im.loading = 'lazy';
//       thumb.appendChild(im);
//     }
//     li.appendChild(thumb);

//     var body = mk('div', 'cart-item__body');
//     body.appendChild(mk('p', 'cart-item__name', it.product_title));
//     var variantTitle = it.variant_title || '';
//     var v = mk('p', 'cart-item__variant', variantTitle);
//     if (isFree) v.style.setProperty('--line-accent', 'var(--cyan)');
//     body.appendChild(v);

//     // compact stepper (real cart lines are always user-managed)
//     var q = mk('div', 'qty qty--sm'); q.setAttribute('role', 'group'); q.setAttribute('aria-label', 'Menge');
//     var d = mk('button', 'qty__btn', '−'); d.type = 'button'; d.setAttribute('aria-label', 'Menge verringern'); d.setAttribute('data-line-qty', 'dec');
//     var val = mk('span', 'qty__value', String(it.quantity)); val.setAttribute('aria-live', 'polite');
//     var u = mk('button', 'qty__btn', '+'); u.type = 'button'; u.setAttribute('aria-label', 'Menge erhöhen'); u.setAttribute('data-line-qty', 'inc');
//     if (it.quantity <= 1) d.disabled = true;
//     q.appendChild(d); q.appendChild(val); q.appendChild(u);
//     body.appendChild(q);
//     li.appendChild(body);

//     var end = mk('div', 'cart-item__end');
//     if (isFree) {
//       end.appendChild(mk('span', 'cart-item__price cart-item__price--free', 'Gratis'));
//     } else {
//       end.appendChild(mk('span', 'cart-item__price', formatMoney(it.final_line_price)));
//     }
//     var rm = mk('button', 'cart-item__remove', 'Entfernen'); rm.type = 'button'; rm.setAttribute('data-line-remove', ''); rm.setAttribute('aria-label', 'Artikel entfernen');
//     end.appendChild(rm);
//     li.appendChild(end);
//     return li;
//   }

//   function render() {
//     if (!state) return; // first paint is server-rendered
//     var items = state.items || [];
//     var n = state.item_count || 0;
//     var sub = state.total_price || 0;
//     // badge
//     badgeEls.forEach(function (b) {
//       b.textContent = String(n);
//       var link = b.closest('.cart-link') || b.parentElement;
//       if (link) link.setAttribute('data-count', String(n));
//       b.hidden = n === 0;
//     });
//     if (!drawer) return;
//     var empty = items.length === 0;
//     if (emptyEl) emptyEl.hidden = !empty;
//     if (footEl) footEl.hidden = empty;
//     if (shipEl) shipEl.hidden = empty;
//     if (lines) {
//       lines.hidden = empty;
//       lines.innerHTML = '';
//       items.forEach(function (it) { lines.appendChild(lineNode(it)); });
//     }
//     if (subtotalEl) subtotalEl.textContent = formatMoney(sub);
//     if (shipFill && shipMsg) {
//       var pct = Math.max(0, Math.min(1, sub / FREE_DE)) * 100;
//       shipFill.style.width = pct + '%';
//       if (sub >= FREE_DE) { shipEl.classList.add('is-unlocked'); shipMsg.textContent = 'Kostenloser Versand freigeschaltet 🎉'; }
//       else {
//         shipEl.classList.remove('is-unlocked');
//         shipMsg.innerHTML = '';
//         shipMsg.appendChild(document.createTextNode('Noch '));
//         var strong = mk('strong', null, formatMoney(FREE_DE - sub));
//         shipMsg.appendChild(strong);
//         shipMsg.appendChild(document.createTextNode(' bis zum kostenlosen Versand (DE).'));
//       }
//     }
//     if (countEl) countEl.textContent = n === 1 ? '1 Artikel' : n + ' Artikel';
//   }

//   /* ── badge bump ── */
//   function bumpBadge() {
//     if (reduceMQ.matches) return;
//     badgeEls.forEach(function (b) { b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump'); });
//   }

//   /* ── drawer open/close (focus-trap like initAppModal) ── */
//   function focusable() {
//     if (!drawer) return [];
//     return Array.prototype.slice.call(drawer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])'))
//       .filter(function (el) { return el.offsetParent !== null; });
//   }
//   function onKeydown(e) {
//     if (e.key === 'Escape' || e.key === 'Esc') { close(); return; }
//     if (e.key !== 'Tab') return;
//     var f = focusable(); if (!f.length) return;
//     var first = f[0], last = f[f.length - 1];
//     if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
//     else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
//   }
//   function open(trigger) {
//     if (!drawer) return;
//     opener = trigger || document.activeElement;
//     drawer.hidden = false; if (scrim) scrim.hidden = false;
//     window.requestAnimationFrame(function () { drawer.classList.add('is-open'); if (scrim) scrim.classList.add('is-open'); });
//     document.body.style.overflow = 'hidden';
//     document.addEventListener('keydown', onKeydown, true);
//     var f = focusable(); if (f.length) f[0].focus();
//   }
//   function close() {
//     if (!drawer || drawer.hidden) return;
//     drawer.classList.remove('is-open'); if (scrim) scrim.classList.remove('is-open');
//     document.body.style.overflow = '';
//     document.removeEventListener('keydown', onKeydown, true);
//     var done = function () { drawer.hidden = true; if (scrim) scrim.hidden = true; };
//     if (reduceMQ.matches) done(); else window.setTimeout(function () { if (!drawer.classList.contains('is-open')) done(); }, 420);
//     if (opener && typeof opener.focus === 'function') opener.focus();
//     opener = null;
//   }

//   /* ── mount: bind to the server-rendered shell + drawer ── */
//   function mount() {
//     if (mounted) { render(); return; }
//     drawer = document.getElementById('cart-drawer');
//     scrim = document.querySelector('[data-cart-scrim]');
//     badgeEls = Array.prototype.slice.call(document.querySelectorAll('[data-cart-count]'));
//     if (drawer) {
//       moneyFormat = drawer.getAttribute('data-money-format') || null;
//       lines = drawer.querySelector('[data-cart-lines]');
//       emptyEl = drawer.querySelector('[data-cart-empty]');
//       footEl = drawer.querySelector('[data-cart-foot]');
//       shipEl = drawer.querySelector('[data-cart-ship]');
//       shipFill = drawer.querySelector('[data-ship-fill]');
//       shipMsg = drawer.querySelector('[data-ship-msg]');
//       subtotalEl = drawer.querySelector('[data-cart-subtotal]');
//       countEl = drawer.querySelector('[data-cart-drawer-count]');
//       // line-item delegation
//       drawer.addEventListener('click', function (e) {
//         var li = e.target.closest ? e.target.closest('[data-line-key]') : null;
//         if (!li) return;
//         var k = li.getAttribute('data-line-key');
//         if (e.target.closest('[data-line-remove]')) { remove(k); return; }
//         var qb = e.target.closest('[data-line-qty]');
//         if (qb) {
//           var cur = 1;
//           if (state && state.items) {
//             for (var i = 0; i < state.items.length; i++) if (state.items[i].key === k) cur = state.items[i].quantity;
//           } else {
//             var valEl = li.querySelector('.qty__value');
//             cur = valEl ? parseInt(valEl.textContent, 10) || 1 : 1;
//           }
//           changeQty(k, cur + (qb.getAttribute('data-line-qty') === 'inc' ? 1 : -1));
//         }
//       });
//       Array.prototype.forEach.call(drawer.querySelectorAll('[data-cart-close]'), function (el) {
//         el.addEventListener('click', function (e) { e.preventDefault(); close(); });
//       });
//     }
//     if (scrim) scrim.addEventListener('click', function (e) { e.preventDefault(); close(); });
//     // open triggers (header cart icon) — delegated so it also works for
//     // buttons rendered later (e.g. sections re-rendered in the editor)
//     document.addEventListener('click', function (e) {
//       var t = e.target.closest ? e.target.closest('[data-cart-open]') : null;
//       if (t) { e.preventDefault(); open(t); }
//     });
//     // bfcache back-navigation → resync
//     window.addEventListener('pageshow', function (e) { if (e.persisted) refresh(); });
//     mounted = true;
//     refresh(); // sync client state with the real cart
//   }

//   window.FrugendsCart = { mount: mount, add: add, open: open, close: close, changeQty: changeQty, remove: remove, render: render, refresh: refresh };

//   // self-mount fallback (main.js also calls mount(); mount is idempotent)
//   if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', mount);
//   } else {
//     mount();
//   }
// })();
