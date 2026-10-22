/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — PRODUCT PAGE (Shopify port)
   ───────────────────────────────────────────────────────────────
   Behaviour of the generic product page (sections/fg-product-main):
   product-media SLIDER (arrows / dots / swipe / keyboard), variant
   <select> that syncs price + sticky buy-bar, quantity stepper,
   add to cart, sticky mobile buy-bar (IntersectionObserver).

   Shopify specifics:
     • The variant picker is a REAL form field: <select name="id">
       with the Shopify variant id as value (+ data-variant-title with
       the human title, data-variant-price with the Liquid-formatted
       price). No-JS: the {% form 'product' %} submits natively.
     • With JS: the form submit is intercepted →
       window.FrugendsCart.add({ id, quantity }) (AJAX drawer).
     • Single-variant products carry a hidden
       <input name="id" data-variant-id> instead of the select.
   ═══════════════════════════════════════════════════════════════ */
/* SHOP DEAKTIVIERT 2026-09-24 — zum Reaktivieren Kommentar entfernen (siehe audit/DECISIONS.md E16)
   Wird nicht mehr geladen (einziger Aufrufer sections/fg-product-main.liquid ist auskommentiert).
   Der gesamte Code unten ist zeilenweise mit "// " auskommentiert —
   zum Reaktivieren die Zeilen markieren und den Zeilenkommentar entfernen
   (VS Code: Strg+#), dann node --check product.js. */
// (function () {
//   'use strict';

//   /* ── slider ── */
//   function initSlider(root) {
//     var track    = root.querySelector('[data-slider-track]');
//     var slides   = Array.prototype.slice.call(root.querySelectorAll('[data-slider-slide]'));
//     var dotsWrap = root.querySelector('[data-slider-dots]');
//     var prev     = root.querySelector('[data-slider-prev]');
//     var next     = root.querySelector('[data-slider-next]');
//     var vp       = root.querySelector('[data-slider-viewport]') || root;
//     var i = 0;

//     function renderDots() {
//       if (!dotsWrap) return;
//       dotsWrap.innerHTML = '';
//       slides.forEach(function (s, k) {
//         var d = document.createElement('button');
//         d.type = 'button'; d.className = 'pslider__dot'; d.setAttribute('data-slider-dot', '');
//         d.setAttribute('aria-label', 'Bild ' + (k + 1));
//         d.addEventListener('click', function () { go(k); });
//         dotsWrap.appendChild(d);
//       });
//     }
//     function render() {
//       track.style.transform = 'translateX(' + (-i * 100) + '%)';
//       if (dotsWrap) Array.prototype.forEach.call(dotsWrap.children, function (d, k) {
//         d.classList.toggle('is-active', k === i); d.setAttribute('aria-current', k === i ? 'true' : 'false');
//       });
//       slides.forEach(function (s, k) { s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
//     }
//     function go(k) { if (!slides.length) return; i = (k % slides.length + slides.length) % slides.length; render(); }

//     if (prev) prev.addEventListener('click', function () { go(i - 1); });
//     if (next) next.addEventListener('click', function () { go(i + 1); });
//     root.addEventListener('keydown', function (e) {
//       if (e.key === 'ArrowLeft')  { e.preventDefault(); go(i - 1); }
//       else if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
//     });
//     // swipe / drag
//     var x0 = null;
//     vp.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
//     vp.addEventListener('pointerup',   function (e) { if (x0 == null) return; var dx = e.clientX - x0; if (Math.abs(dx) > 40) go(dx < 0 ? i + 1 : i - 1); x0 = null; });
//     vp.addEventListener('pointercancel', function () { x0 = null; });

//     renderDots();
//     render();
//   }

//   function init() {
//     var grid = document.querySelector('.product-hero__grid');
//     var hero = document.querySelector('[data-product]');
//     if (!grid || !hero) return;

//     var sliderRoot = grid.querySelector('[data-slider]');
//     if (sliderRoot) initSlider(sliderRoot);

//     var buybar = document.querySelector('[data-buybar]');
//     var buybarVariant = buybar ? buybar.querySelector('.buybar__variant') : null;
//     var buybarPrice = buybar ? buybar.querySelector('.buybar__price') : null;
//     var priceEl = grid.querySelector('.buybox__price');
//     var qtyInput = grid.querySelector('[data-qty-input]');
//     var dec = grid.querySelector('[data-qty-dec]');
//     var inc = grid.querySelector('[data-qty-inc]');
//     // variant picker is a real form field: name="id", value = variant id
//     // (<select> for multi-variant products, hidden input otherwise)
//     var selectId = grid.querySelector('select[name="id"]');
//     var hiddenId = grid.querySelector('input[name="id"][data-variant-id]');
//     var form = grid.querySelector('form[data-product-form]') || grid.querySelector('form[action*="/cart/add"]');

//     function activeOption() {
//       if (!selectId) return null;
//       return selectId.options[selectId.selectedIndex] || null;
//     }
//     function activeVariantVal() {
//       var o = activeOption();
//       if (o) return o.getAttribute('data-variant-title') || o.textContent;
//       if (hiddenId) return hiddenId.getAttribute('data-variant-title') || 'Standard';
//       return 'Standard';
//     }
//     function activeVariantId() {
//       if (selectId) return selectId.value;
//       if (hiddenId) return hiddenId.value;
//       return null;
//     }
//     function activeVariantPrice() {
//       var o = activeOption();
//       if (o) return o.getAttribute('data-variant-price') || null;
//       return hiddenId ? hiddenId.getAttribute('data-variant-price') : null;
//     }
//     function updateBuybar() {
//       if (buybarVariant) buybarVariant.textContent = activeVariantVal();
//       var p = activeVariantPrice();
//       if (p) {
//         if (buybarPrice) buybarPrice.textContent = p;
//         if (priceEl) priceEl.textContent = p;
//       }
//     }
//     if (selectId) selectId.addEventListener('change', updateBuybar);

//     /* ── quantity stepper ── */
//     function getQty() { var v = parseInt(qtyInput && qtyInput.value, 10); return (isNaN(v) || v < 1) ? 1 : Math.min(v, 99); }
//     function setQty(v) { v = Math.max(1, Math.min(99, v)); if (qtyInput) qtyInput.value = v; if (dec) dec.disabled = v <= 1; }
//     if (dec) dec.addEventListener('click', function () { setQty(getQty() - 1); });
//     if (inc) inc.addEventListener('click', function () { setQty(getQty() + 1); });
//     if (qtyInput) qtyInput.addEventListener('change', function () { setQty(getQty()); });
//     setQty(getQty());

//     /* ── add to cart (AJAX via FrugendsCart; native form submit as no-JS path) ── */
//     function addToCart() {
//       var id = activeVariantId();
//       if (!id) return;
//       if (!window.FrugendsCart) { if (form) form.submit(); return; }
//       window.FrugendsCart.add({ id: id, quantity: getQty() });
//     }
//     if (form) {
//       form.addEventListener('submit', function (e) {
//         if (!window.FrugendsCart) return; // no cart JS → native submit
//         e.preventDefault();
//         addToCart();
//       });
//     }
//     // buttons outside the form (sticky buy-bar)
//     Array.prototype.forEach.call(document.querySelectorAll('[data-add-to-cart]'), function (btn) {
//       if (form && form.contains(btn)) return; // form submit handles it
//       btn.addEventListener('click', function (e) { e.preventDefault(); addToCart(); });
//     });

//     /* ── sticky mobile buy-bar ── */
//     var mainCta = grid.querySelector('.buybox__add');
//     if (buybar && mainCta && 'IntersectionObserver' in window) {
//       var io = new IntersectionObserver(function (entries) {
//         entries.forEach(function (en) { buybar.classList.toggle('is-visible', !en.isIntersecting); });
//       }, { rootMargin: '0px 0px -35% 0px' });
//       io.observe(mainCta);
//     }

//     updateBuybar(); // initial sync
//   }

//   if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
//   else init();
// })();
