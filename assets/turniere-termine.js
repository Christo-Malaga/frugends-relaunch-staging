/* FRUGENDS — TURNIERE · Nächste Turniere (#announcements)
   Kanal-Hub (Port von KanalHub.jsx der Surprise-Box-LP, Vanilla).
   Knoten = Tabs (roving tabindex): Klick, Enter/Leertaste oder Pfeiltasten
   wählen einen Kanal, Pos1/Ende springen an den Anfang/das Ende. Der
   gewählte Knoten rastet ein, die übrigen dimmen, die Speiche leuchtet,
   die Detailkarte dockt an, dahinter blendet das Kanal-Wallpaper ein.
   Ein einziger Bewegungsmoment: Beim ersten Sichtkontakt wählt die
   Eingangs-Vorführung drei Kanäle nacheinander (data-demo), einmal. Bei
   reduzierter Bewegung oder ohne IntersectionObserver bleibt der vom
   Server gerenderte Endzustand stehen. Eine echte Eingabe beendet die
   Vorführung sofort. */
(function () {
  'use strict';
  var DEMO_AT = [700, 2000, 3300];
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function init(hub) {
    var tabs = Array.prototype.slice.call(hub.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;
    var wraps = tabs.map(function (t) { return t.parentNode; });
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    var walls = {};
    Array.prototype.forEach.call(hub.querySelectorAll('[data-tt-wall]'), function (img) {
      walls[img.getAttribute('data-tt-wall')] = img;
    });
    var hint = hub.querySelector('[data-tt-hint]');
    var touched = false;
    var current = -1;
    tabs.forEach(function (t, i) { if (t.getAttribute('aria-selected') === 'true') current = i; });

    function render(focusIdx) {
      tabs.forEach(function (t, i) {
        var on = i === current;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = (current === -1 ? i === (focusIdx || 0) : on) ? 0 : -1;
        wraps[i].classList.toggle('is-selected', on);
        if (panels[i]) panels[i].hidden = !on;
        var w = walls[String(i)];
        if (w) w.classList.toggle('is-on', on);
      });
      hub.classList.toggle('has-sel', current !== -1);
    }

    function burst(i) {
      if (reduced) return;
      var t = tabs[i];
      t.classList.remove('is-burst');
      void t.offsetWidth; /* Ring neu starten */
      t.classList.add('is-burst');
    }

    function select(i) {
      if (i === current) return;
      current = i;
      render();
      burst(i);
    }

    function touch() {
      if (touched) return;
      touched = true;
      if (hint) hint.classList.add('is-hidden');
    }

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { touch(); select(i); });
      t.addEventListener('keydown', function (e) {
        var n = tabs.length;
        var to = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (i + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (i - 1 + n) % n;
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = n - 1;
        if (to === null) return;
        e.preventDefault();
        touch();
        select(to);
        tabs[to].focus();
      });
      /* Tastatur-Nutzer im Hub: Vorführung nicht mehr dazwischenfunken lassen */
      t.addEventListener('focus', touch);
      t.addEventListener('animationend', function () { t.classList.remove('is-burst'); });
    });

    if (reduced) return;
    hub.classList.add('tt-hub--motion');

    var ids = (hub.getAttribute('data-demo') || '').split(',');
    var order = [];
    ids.forEach(function (id) {
      id = id.trim();
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].getAttribute('data-k') === id) { order.push(i); break; }
      }
    });
    if (!order.length || !('IntersectionObserver' in window)) return;

    /* Startlage der Vorführung: nichts gewählt */
    current = -1;
    render();

    var stage = hub.querySelector('.tt-hub__stage') || hub;
    var io = new IntersectionObserver(function (entries) {
      if (!entries.some(function (en) { return en.isIntersecting; })) return;
      io.disconnect();
      order.forEach(function (idx, k) {
        var at = DEMO_AT[k] != null ? DEMO_AT[k] : DEMO_AT[DEMO_AT.length - 1] + (k - DEMO_AT.length + 1) * 1300;
        setTimeout(function () { if (!touched) select(idx); }, at);
      });
    }, { threshold: 0.45 });
    io.observe(stage);
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-tt-hub]'), init);
})();
