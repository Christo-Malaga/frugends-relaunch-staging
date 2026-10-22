/* ═══════════════════════════════════════════════════════════════
   FRUGENDS — Big News · Teil (b) „Neues Game!" (sections/fg-bignews-game)

   1. Detonation (scroll-gebunden): Fullscreen-Shader auf einer Sticky-
      Bühne. p 0 → 1 über die Scrollstrecke:
        (p über Einfahrt + Pin; Pin beginnt bei p ≈ 0.54)
        0.20–0.50  Lichtkern sammelt sich (schon beim Hereinscrollen), Sog
        0.46–0.53  Kern kollabiert (Einatmen)
        0.53       Detonation: Blitz
        0.53–0.73  Druckring reißt das Weiß auf, dahinter Indigo + Glut
        0.64–0.80  Headline erscheint; die Szene steigt von unten nach
      Ohne WebGL übernimmt eine CSS-Variante (Kern/Scheibe/Ring).
   2. Szene: iPhone (ExtrudeGeometry mit Bevel, Kameramodul, Tasten,
      Shader-Display) unter einer Decke. Decke = Verlet-Stoff auf einem
      Grid (PBD-Distanzconstraints: Struktur/Scher/Biegung), Kollision
      gegen eine Rounded-Box-SDF des iPhones + Kameramodul + Boden.
      Choreografie als 8,4-s-Loop: Ruhe → Vibrieren → kleiner Hüpfer →
      großer Hüpfer (Saum hebt sich, Display blitzt cyan) → Nachschaukeln
      → Vorlehnen → Ruhe. Licht: Key (Gold-Weiß), Rim (Cyan), Fill
      (Violett), PMREM-Umgebung aus Emissionsflächen; Kontaktschatten,
      Lichtpool, Cyan-Spill, additive Glows, Staub im Licht, Funken.
   Performance: Render-Loops nur im Viewport (IntersectionObserver), Pause
   bei visibilitychange, DPR-Cap 1.75 / mobil 1.5, keine Allokationen im
   Frame-Loop (Typed Arrays, vorab angelegte Vektoren), Cleanup bei
   shopify:section:unload.
   THREE-Ladeschutz: siehe loadThree() und den Kommentar im Liquid.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
  function easeOut3(t) { return 1 - Math.pow(1 - t, 3); }
  function smooth(t) { return t * t * (3 - 2 * t); }

  function isMobile() {
    return window.innerWidth < 700 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  // ── WebGL-Test (einmal) ──────────────────────────────────────────
  var glOk = null;
  function hasWebGL() {
    if (glOk !== null) return glOk;
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl');
      glOk = !!gl;
      if (gl && gl.getExtension('WEBGL_lose_context')) gl.getExtension('WEBGL_lose_context').loseContext();
    } catch (e) { glOk = false; }
    return glOk;
  }

  // ── THREE-Ladeschutz (gemeinsamer Vertrag, siehe Liquid) ─────────
  function loadThree(src) {
    if (window.fgThreeReady) return window.fgThreeReady;
    window.fgThreeReady = new Promise(function (resolve, reject) {
      if (window.THREE) { resolve(window.THREE); return; }
      var s = document.querySelector('script[data-fg-three]') ||
              document.querySelector('script[src*="three.min.js"]');
      if (!s) {
        s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.setAttribute('data-fg-three', '');
        document.head.appendChild(s);
      }
      s.addEventListener('load', function () {
        if (window.THREE) resolve(window.THREE); else reject(new Error('THREE fehlt'));
      });
      s.addEventListener('error', function () { reject(new Error('three.min.js nicht geladen')); });
    });
    window.fgThreeReady.catch(function () { window.fgThreeReady = null; });
    return window.fgThreeReady;
  }

  /* ════════════════════════════════════════════════════════════════
     1 · DETONATION
     ════════════════════════════════════════════════════════════════ */
  // p läuft über Einfahrt (Bühne scrollt herein) + Pin-Strecke: Der Kern baut
  // sich schon beim Hereinscrollen auf, die Detonation fällt kurz vor den Pin.
  var T_G0 = 0.20, T_G1 = 0.50, T_S0 = 0.46, T_DET = 0.53, T_RING = 0.20;

  var DET_VS = [
    'varying vec2 vUv;',
    'void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }'
  ].join('\n');

  var DET_FS = [
    'precision highp float;',
    'uniform vec2 uRes; uniform float uP; uniform float uT; uniform float uTopFade;',
    'float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }',
    'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);',
    '  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x), u.y); }',
    'float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }',
    'const vec3 DEEP = vec3(20.,23.,41.)/255.;',
    'const vec3 PURPLE = vec3(124.,92.,191.)/255.;',
    'const vec3 LILAC = vec3(185.,163.,245.)/255.;',
    'const vec3 GOLD = vec3(1., 205./255., 40./255.);',
    'const vec3 EMBER = vec3(1., .45, .12);',
    'const vec3 HOT = vec3(1., .97, .86);',
    'const vec3 CYAN = vec3(68.,217.,255.)/255.;',
    'void main(){',
    '  vec2 uv = (gl_FragCoord.xy - .5*uRes) / uRes.y;',
    '  float d = length(uv);',
    '  float a = atan(uv.y, uv.x);',
    '  float maxR = .5*length(uRes)/uRes.y;',
    '  float gather = smoothstep(' + T_G0 + ', ' + T_G1 + ', uP);',
    '  float squeeze = smoothstep(' + T_S0 + ', ' + T_DET + ', uP);',
    '  float det = step(' + T_DET + ', uP);',
    '  float te = max(uP - ' + T_DET + ', 0.);',
    '  float ringT = clamp(te / ' + T_RING + ', 0., 1.);',
    '  vec3 col = vec3(1.);',
    '  float topMask = mix(1., smoothstep(0., .35, 1. - gl_FragCoord.y / uRes.y), uTopFade);',
    // Weißphase: Spannung, Sog, Kern
    '  float vig = smoothstep(.2, maxR, d);',
    '  col = mix(col, vec3(.925,.905,.975), vig * gather * .7 * (1.-det) * topMask);',
    '  float ang = a / 6.2831853 + .5;',
    '  float lane = floor(ang * 110.);',
    '  float lr = hash(vec2(lane, 3.1));',
    '  float laneMask = smoothstep(.62, 1., lr) * (1. - abs(fract(ang*110.)-.5)*2.);',
    '  float flow = fract(d * 1.8 + uT * (.5 + .9*lr) + lr*7.);',
    '  float streak = laneMask * smoothstep(0., .12, flow) * (1. - smoothstep(.12, .7, flow));',
    '  streak *= smoothstep(.07, .35, d) * gather * (1. - squeeze*.6) * (1.-det);',
    '  col = mix(col, mix(LILAC, PURPLE, .6), streak * .5 * topMask);',
    '  float coreR = mix(.012, .075, gather) * (1. - .8*squeeze);',
    '  float core = exp(-pow(d / max(coreR, .004), 2.));',
    '  float halo = exp(-d / (coreR*3. + .015));',
    '  col = mix(col, mix(LILAC, GOLD, .5), halo * .5 * gather * (1.-det));',
    '  col = mix(col, mix(GOLD, HOT, core), clamp(core*1.4,0.,1.) * gather * (1.-det));',
    '  col *= 1. - .07 * squeeze * (1.-det) * topMask;',
    // Nach der Detonation
    '  if (det > .5) {',
    '    float R = (1. - pow(1. - ringT, 3.)) * (maxR*1.28 + .12);',
    '    float wob = (fbm(vec2(a*1.9 + 1.7, te*5. + uT*.3)) - .5) * .2 * R;',
    '    float dd = d + wob;',
    '    float inside = 1. - smoothstep(R - .012 - .035*R, R, dd);',
    '    vec2 q = (uv - vec2(0., .08)) * vec2(.8, 1.25);',
    '    float cg = exp(-dot(q,q) * 6.);',
    '    vec3 dark = mix(DEEP, mix(DEEP, PURPLE, .42), cg);',
    '    float trail = exp(-max(R - dd, 0.) / (.03 + .12*R)) * inside * (1. - ringT*.7);',
    '    dark += EMBER * trail * .3 + GOLD * trail * trail * .3;',
    '    float sm = fbm(uv*3.2 + vec2(0., -uT*.04) + te*1.5);',
    '    dark += (sm - .5) * .07 * PURPLE * (1. - smoothstep(.55, .95, uP));',
    '    col = mix(col, dark, inside);',
    '    float fade = 1. - smoothstep(.7, 1., ringT);',
    '    float w = .01 + .045*R*(1. - ringT*.5);',
    '    float band = exp(-pow((dd - R)/w, 2.));',
    '    float fr = exp(-pow((dd - R - w*1.8)/(w*1.2 + .01), 2.));',
    '    col = mix(col, GOLD, band * .75 * fade);',
    '    col = mix(col, HOT, pow(band, 3.) * .9 * fade);',
    '    col = mix(col, CYAN, fr * .55 * fade * (1.-inside));',
    '    float flash = exp(-te * 85.);',
    '    col += (HOT * .9 + GOLD * .3) * flash * exp(-d * 3.2);',
    '    col = mix(col, HOT, clamp(flash * 1.6 - .6, 0., 1.) * exp(-d * 1.2));',
    '  }',
    '  gl_FragColor = vec4(col, 1.);',
    '}'
  ].join('\n');

  var EMB_VS = [
    'attribute vec4 aSeed;',
    'uniform float uP; uniform float uT; uniform float uAspect; uniform float uPx; uniform float uMaxR;',
    'varying float vA; varying vec3 vC;',
    'void main(){',
    '  float gather = smoothstep(' + T_G0 + ', ' + T_G1 + ', uP);',
    '  float squeeze = smoothstep(' + T_S0 + ', ' + T_DET + ', uP);',
    '  float te = max(uP - ' + T_DET + ', 0.);',
    '  float ang = aSeed.x * 6.2831853;',
    '  vec2 dir = vec2(cos(ang), sin(ang));',
    '  vec2 pos; float size;',
    '  if (uP < ' + T_DET + ') {',
    '    float k = fract(aSeed.w + uT * (.18 + .25*aSeed.z));',
    '    float r = (.12 + aSeed.y * uMaxR) * (1. - k) * (1. - .4*squeeze) + .01;',
    '    pos = dir * r;',
    '    vA = gather * (1. - squeeze*.8) * smoothstep(0., .15, k) * (1. - smoothstep(.8, 1., k)) * .55;',
    '    vC = vec3(.36, .26, .66);',
    '    size = 1.6 + aSeed.z * 2.2;',
    '  } else {',
    '    float ringT = clamp(te / ' + T_RING + ', 0., 1.);',
    '    float R = (1. - pow(1. - ringT, 3.)) * (uMaxR * 1.28 + .12);',
    '    float r = .01 + R * (.62 + .36 * pow(aSeed.y, .5)) + te * .12 * aSeed.z;',
    '    pos = dir * r;',
    '    pos.y -= te * te * .9 * aSeed.z;',
    '    pos += .012 * vec2(sin(uT*1.3 + aSeed.w*20.), cos(uT*1.1 + aSeed.y*17.));',
    '    float life = 1. - smoothstep(.06 + .22*aSeed.z, .42, te);',
    '    float keep = step(.78, aSeed.w) * (.35 + .25*sin(uT*3. + aSeed.x*40.));',
    '    vA = max(life, keep * smoothstep(.1, .3, te));',
    '    float heat = clamp(1. - te*3.5, 0., 1.);',
    '    vC = mix(vec3(1., .45, .12), vec3(1., .95, .75), heat);',
    '    size = (2. + aSeed.z * 4.) * (1. + heat);',
    '  }',
    '  gl_PointSize = size * uPx;',
    '  gl_Position = vec4(pos.x / (.5*uAspect), pos.y / .5, 0., 1.);',
    '}'
  ].join('\n');

  var EMB_FS = [
    'precision highp float;',
    'varying float vA; varying vec3 vC;',
    'void main(){',
    '  float r = length(gl_PointCoord - .5);',
    '  float a = smoothstep(.5, .0, r) * vA;',
    '  if (a < .003) discard;',
    '  gl_FragColor = vec4(vC, a);',
    '}'
  ].join('\n');

  function createDetonation(THREE, canvas, mobile) {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    var dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.25);
    renderer.setPixelRatio(dpr);
    var scene = new THREE.Scene();
    var cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    var uni = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uP: { value: 0 },
      uT: { value: 0 },
      uTopFade: { value: 0 }
    };
    var quadGeo = new THREE.PlaneGeometry(2, 2);
    var quadMat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: DET_VS, fragmentShader: DET_FS, depthTest: false, depthWrite: false });
    var quad = new THREE.Mesh(quadGeo, quadMat);
    quad.frustumCulled = false;
    scene.add(quad);

    var n = mobile ? 120 : 200;
    var seeds = new Float32Array(n * 4);
    var posA = new Float32Array(n * 3);
    for (var i = 0; i < n * 4; i++) seeds[i] = Math.random();
    var eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute('position', new THREE.BufferAttribute(posA, 3));
    eGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    var eUni = {
      uP: uni.uP, uT: uni.uT,
      uAspect: { value: 1 }, uPx: { value: dpr }, uMaxR: { value: 1 }
    };
    var eMat = new THREE.ShaderMaterial({
      uniforms: eUni, vertexShader: EMB_VS, fragmentShader: EMB_FS,
      transparent: true, depthTest: false, depthWrite: false
    });
    var pts = new THREE.Points(eGeo, eMat);
    pts.frustumCulled = false;
    pts.renderOrder = 2;
    scene.add(pts);

    function resize(w, h) {
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      uni.uRes.value.set(w * dpr, h * dpr);
      eUni.uAspect.value = w / h;
      eUni.uMaxR.value = 0.5 * Math.sqrt(w * w + h * h) / h;
    }
    function render(p, t, topFade) {
      uni.uTopFade.value = topFade || 0;
      uni.uP.value = p;
      uni.uT.value = t;
      renderer.render(scene, cam);
    }
    function dispose() {
      quadGeo.dispose(); quadMat.dispose(); eGeo.dispose(); eMat.dispose();
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    }
    return { resize: resize, render: render, dispose: dispose };
  }

  /* ════════════════════════════════════════════════════════════════
     2 · SZENE — iPhone unter der Decke
     ════════════════════════════════════════════════════════════════ */
  // iPhone-Maße (Welt-Einheiten; Ursprung = Unterkante Mitte)
  var PW = 0.76, PH = 1.56, PD = 0.085, PRC = 0.118, PRZ = 0.03;
  var HW = PW / 2, HH = PH / 2, HD = PD / 2;
  // Kameramodul (Rückseite, von vorn gesehen oben rechts)
  var BMX = HW - 0.03 - 0.17, BMY = PH - 0.03 - 0.17, BMZ = -HD - 0.011, BMH = 0.17, BMD = 0.012, BMR = 0.07;
  var BASE_YAW = -0.3, BASE_PITCH = -0.055;
  var LOOP = 8.4;

  function sdPhone(x, y, z) {
    var qx = Math.abs(x) - (HW - PRC), qy = Math.abs(y - HH) - (HH - PRC);
    var mx = qx > 0 ? qx : 0, my = qy > 0 ? qy : 0;
    var d2 = Math.sqrt(mx * mx + my * my) + Math.min(Math.max(qx, qy), 0) - PRC;
    var wx = d2 + PRZ, wz = Math.abs(z) - HD + PRZ;
    var ax = wx > 0 ? wx : 0, az = wz > 0 ? wz : 0;
    var d = Math.min(Math.max(wx, wz), 0) + Math.sqrt(ax * ax + az * az) - PRZ;
    var bx = Math.abs(x - BMX) - (BMH - BMR), by = Math.abs(y - BMY) - (BMH - BMR), bz = Math.abs(z - BMZ) - (BMD - 0.008);
    var cx = bx > 0 ? bx : 0, cy = by > 0 ? by : 0, cz = bz > 0 ? bz : 0;
    var db = Math.sqrt(cx * cx + cy * cy + cz * cz) + Math.min(Math.max(bx, Math.max(by, bz)), 0) - 0.008;
    return d < db ? d : db;
  }

  function rrShape(THREE, x, y, w, h, r) {
    var s = new THREE.Shape();
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  function glowTexture(THREE) {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.08)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function additive(THREE, mat) {
    mat.blending = THREE.CustomBlending;
    mat.blendEquation = THREE.AddEquation;
    mat.blendSrc = THREE.SrcAlphaFactor;
    mat.blendDst = THREE.OneFactor;
    mat.blendSrcAlpha = THREE.ZeroFactor;
    mat.blendDstAlpha = THREE.OneFactor;
    mat.transparent = true;
    mat.depthWrite = false;
    return mat;
  }

  // ── Stoff-Shader ────────────────────────────────────────────────
  var CLOTH_VS = [
    'uniform mat4 uPhoneInv;',
    'varying vec3 vN; varying vec3 vW; varying vec3 vL; varying vec2 vUv;',
    'void main(){',
    '  vec3 p = position + normal * .007;',
    '  vW = p; vN = normal; vUv = uv;',
    '  vL = (uPhoneInv * vec4(p, 1.)).xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);',
    '}'
  ].join('\n');

  var CLOTH_FS = [
    'precision highp float;',
    'uniform sampler2D uLogo; uniform float uLogoOn; uniform vec4 uLogoRect;',
    'uniform vec3 uCam; uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uFillDir; uniform vec3 uFillCol; uniform vec3 uRimDir; uniform vec3 uRimCol;',
    'uniform float uScreen; uniform vec2 uDispHalf; uniform float uDispY; uniform float uDispZ;',
    'varying vec3 vN; varying vec3 vW; varying vec3 vL; varying vec2 vUv;',
    'void main(){',
    '  vec3 N = normalize(vN);',
    '  bool outer = gl_FrontFacing;',
    '  if (!outer) N = -N;',
    '  vec3 V = normalize(uCam - vW);',
    '  vec3 base = outer ? vec3(.40, .30, .68) : vec3(.23, .16, .42);',
    '  float wx = vUv.x * 460., wy = vUv.y * 700.;',
    '  float fw = clamp(max(fwidth(wx), fwidth(wy)) * .6, 0., 1.);',
    '  float weave = mix(.5 + .25*sin(wx) + .25*sin(wy), .5, fw);',
    '  base *= .93 + .12 * weave;',
    '  if (outer && uLogoOn > .5) {',
    '    vec2 lu = (vUv - uLogoRect.xy) / (uLogoRect.zw - uLogoRect.xy);',
    '    if (lu.x > 0. && lu.x < 1. && lu.y > 0. && lu.y < 1.) {',
    '      vec4 lg = texture2D(uLogo, lu);',
    '      base = mix(base, lg.rgb * .96, lg.a * .97);',
    '    }',
    '  }',
    '  float k = max((dot(N, uKeyDir) + .15) / 1.15, 0.);',
    '  float f = max((dot(N, uFillDir) + .6) / 1.6, 0.);',
    '  float nv = clamp(dot(N, V), 0., 1.);',
    '  float sheen = pow(1. - nv, 2.4);',
    '  float rim = pow(1. - nv, 1.8) * smoothstep(-.3, .7, dot(N, uRimDir));',
    '  vec3 col = base * (uKeyCol * k * 1.2 + uFillCol * f * .42 + vec3(.06, .05, .11));',
    '  col += sheen * (.26 * uKeyCol * k + .06) * vec3(.92, .86, 1.);',
    '  col += rim * uRimCol * .6;',
    '  col *= mix(.34, 1., smoothstep(0., .2, vW.y));',
    '  vec3 l = vL - vec3(0., uDispY, uDispZ);',
    '  float inR = smoothstep(uDispHalf.x + .08, uDispHalf.x - .05, abs(l.x)) * smoothstep(uDispHalf.y + .08, uDispHalf.y - .05, abs(l.y));',
    '  float near = exp(-max(l.z, 0.) * 20.) * smoothstep(-.03, .0, l.z);',
    '  vec3 cy = vec3(.27, .85, 1.);',
    '  col += cy * inR * near * uScreen * (outer ? .36 : 1.1);',
    '  if (!outer) col += cy * uScreen * .55 * smoothstep(0., .2, l.z) * exp(-length(l.xy) * 1.1) * smoothstep(-.2, .2, dot(N, vec3(0.,-1.,0.)) + .4);',
    '  gl_FragColor = vec4(col, 1.);',
    '}'
  ].join('\n');

  var DISP_VS = [
    'varying vec2 vP;',
    'void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }'
  ].join('\n');

  var DISP_FS = [
    'precision highp float;',
    'uniform float uScreen; uniform float uT; uniform vec2 uSize; uniform vec2 uOrigin; uniform float uCamX;',
    'varying vec2 vP;',
    'float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }',
    'void main(){',
    '  vec2 q = (vP - uOrigin) / uSize;',
    '  vec3 col = mix(vec3(.04, .06, .18), vec3(.12, .10, .36), q.y);',
    '  col += vec3(.10, .40, .60) * exp(-pow((q.y - .78) * 4., 2.)) * .5;',
    '  vec2 g = (q - vec2(.09, .09)) / vec2(.82, .56) * vec2(5., 7.);',
    '  vec2 c = floor(g); vec2 f = fract(g) - .5;',
    '  float onBoard = step(0., g.x) * step(g.x, 5.) * step(0., g.y) * step(g.y, 7.);',
    '  float h = hash(c + 7.);',
    '  vec3 pc = h < .25 ? vec3(1., .80, .16) : h < .5 ? vec3(.27, .85, 1.) : h < .75 ? vec3(.72, .62, .96) : vec3(.29, .87, .50);',
    '  float box = length(max(abs(f) - .26, 0.)) - .12;',
    '  float tile = smoothstep(.03, -.03, box) * onBoard;',
    '  float pulse = .78 + .22 * sin(uT * 2.2 + h * 6.28);',
    '  col = mix(col, pc * pulse, tile);',
    '  col += pc * exp(-max(box, 0.) * 16.) * .22 * onBoard * (1. - tile);',
    '  col = mix(col, vec3(.9), smoothstep(.006, .0, abs(q.y - .03) - .006) * step(abs(q.x - .5), .17));',
    '  col += vec3(.20, .45, .60) * smoothstep(.012, 0., abs(q.y - .86) - .012) * step(abs(q.x - .5), .3) * .6;',
    '  float sheen = exp(-pow((q.x + q.y * .55 - .72 - uCamX * .25) * 7., 2.)) * .07;',
    '  col = col * (.5 + uScreen * .75) + sheen;',
    '  gl_FragColor = vec4(col, 1.);',
    '}'
  ].join('\n');

  var FLOOR_VS = [
    'varying vec3 vW;',
    'void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }'
  ].join('\n');

  var SHADOW_FS = [
    'precision highp float;',
    'uniform vec3 uPhone; uniform vec2 uFwd;',
    'varying vec3 vW;',
    'void main(){',
    '  vec2 q = vW.xz - uPhone.xz;',
    '  vec2 side = vec2(-uFwd.y, uFwd.x);',
    '  float a = dot(q, side), b = dot(q, uFwd);',
    '  float lift = uPhone.y;',
    '  float c = exp(-(a*a)/(.12 + lift*.5) - (b*b)/(.003 + lift*.06)) * (1. - clamp(lift*3., 0., .75));',
    '  float br = exp(-(a*a)/.7 - pow(b + .28, 2.)/.3);',
    '  float alpha = clamp(c*.8 + br*.5, 0., .88);',
    '  gl_FragColor = vec4(.015, .015, .04, alpha);',
    '}'
  ].join('\n');

  var LIGHT_FS = [
    'precision highp float;',
    'uniform vec3 uPhone; uniform vec2 uFwd; uniform float uScreen; uniform float uLift; uniform float uCanvasH;',
    'varying vec3 vW;',
    'void main(){',
    '  vec2 q = vW.xz - uPhone.xz;',
    '  vec2 side = vec2(-uFwd.y, uFwd.x);',
    '  float a = dot(q, side), b = dot(q, uFwd);',
    '  vec2 pq = (vW.xz - vec2(-.3, .5)) * vec2(.75, 1.05);',
    '  float pool = exp(-dot(pq, pq) * 1.2);',
    '  float spill = smoothstep(-.02, .1, b) * exp(-b * 1.4) * exp(-a*a*3.2) * uScreen * (.3 + uLift * 1.6);',
    '  float fade = (1. - smoothstep(1.2, 3.2, length(vW.xz))) * (1. - smoothstep(.5, 1.5, vW.z)) * smoothstep(0., .2 * uCanvasH, gl_FragCoord.y);',
    '  vec3 col = vec3(1., .78, .2) * pool * .16 + vec3(.27, .85, 1.) * spill * .55;',
    '  gl_FragColor = vec4(col * fade, 1.);',
    '}'
  ].join('\n');

  var DUST_VS = [
    'attribute vec4 aSeed;',
    'uniform float uT; uniform float uPx; uniform vec3 uKeyPos; uniform vec3 uKeyAxis;',
    'varying float vA;',
    'void main(){',
    '  vec3 p = position;',
    '  p.y = mod(p.y + uT * (.02 + .035*aSeed.x), 2.6);',
    '  p.x += sin(uT*.3 + aSeed.y*6.28) * .09;',
    '  p.z += cos(uT*.23 + aSeed.z*6.28) * .09;',
    '  vec3 d = p - uKeyPos; float along = dot(d, uKeyAxis); vec3 perp = d - along * uKeyAxis;',
    '  float rad = .1 + along * .3;',
    '  float inCone = smoothstep(rad, rad * .35, length(perp)) * step(0., along);',
    '  float tw = .5 + .5 * sin(uT * 1.7 + aSeed.w * 6.28);',
    '  vA = (.08 + inCone * .9) * (.35 + .65 * tw) * smoothstep(0., .3, p.y) * smoothstep(2.6, 2.1, p.y);',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.);',
    '  gl_PointSize = uPx * (1. + aSeed.x * 1.8) * (5. / -mv.z);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var DUST_FS = [
    'precision highp float;',
    'varying float vA;',
    'void main(){ float r = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., r) * vA; if (a < .004) discard; gl_FragColor = vec4(1., .9, .72, a * .8); }'
  ].join('\n');

  var SPARK_VS = [
    'attribute vec4 aSeed;',
    'uniform float uAge; uniform float uPow; uniform vec3 uOrigin; uniform vec2 uFwd; uniform float uPx;',
    'varying float vA; varying float vHot;',
    'void main(){',
    '  float t = uAge * (.75 + aSeed.w * .5);',
    '  float ang = aSeed.x * 6.2831853;',
    '  vec2 side = vec2(-uFwd.y, uFwd.x);',
    '  vec2 hz = side * cos(ang) * (.5 + aSeed.y) + uFwd * (abs(sin(ang)) * .7 + .25);',
    '  vec3 v = vec3(hz.x, 1.1 + aSeed.z * 1.7, hz.y) * uPow;',
    '  vec3 p = uOrigin + vec3(side.x, 0., side.y) * (aSeed.y - .5) * .6 + v * t + vec3(0., -5., 0.) * t * t;',
    '  p.y = max(p.y, .01);',
    '  vA = (1. - smoothstep(.2, .7, t)) * step(0., uAge) * step(uAge, 1.2);',
    '  vHot = clamp(1. - t * 1.6, 0., 1.);',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.);',
    '  gl_PointSize = uPx * (1.5 + aSeed.z * 2.) * (5. / -mv.z) * (.6 + vHot);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var SPARK_FS = [
    'precision highp float;',
    'varying float vA; varying float vHot;',
    'void main(){ float r = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., r) * vA; if (a < .004) discard;',
    '  gl_FragColor = vec4(mix(vec3(1., .5, .12), vec3(1., .95, .7), vHot), a); }'
  ].join('\n');

  var ENV_FS = [
    'varying vec3 vD;',
    'void main(){ float y = normalize(vD).y; vec3 c = mix(vec3(.015,.015,.04), vec3(.09,.07,.2), smoothstep(-.3, .9, y)); gl_FragColor = vec4(c, 1.); }'
  ].join('\n');
  var ENV_VS = 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';

  // ── Verlet-Stoff ────────────────────────────────────────────────
  function createCloth(cfg) {
    var sp = cfg.sp, CW = cfg.width, LF = cfg.front, LB = cfg.back;
    var nx = Math.round(CW / sp) + 1, ny = Math.round((LF + LB) / sp) + 1;
    var jr = Math.round(LF / sp);
    var N = nx * ny;
    var pos = new Float32Array(N * 3), prv = new Float32Array(N * 3), nrm = new Float32Array(N * 3);
    var uv = new Float32Array(N * 2);
    var pin = new Uint8Array(N);
    var lay = new Int8Array(N);   // +1 Vorderbahn, -1 Rückbahn, 0 Streifen über der Oberkante
    var anc = new Float32Array(N * 3);
    var local = new Float32Array(N * 3);
    var top = PH + 0.022, half = HD + 0.02, CAP = cfg.cap;
    var i, j, k;
    // Punkt local[o..o+2] auf die Handy-Oberfläche im Abstand gap projizieren (SDF-Gradient)
    function onSurface(o, gap) {
      var x = local[o], y = local[o + 1], z = local[o + 2], e = 0.003;
      for (var it = 0; it < 10; it++) {
        var d = sdPhone(x, y, z);
        if (Math.abs(d - gap) < 2e-4) break;
        var f1 = sdPhone(x + e, y - e, z - e), f2 = sdPhone(x - e, y - e, z + e);
        var f3 = sdPhone(x - e, y + e, z - e), f4 = sdPhone(x + e, y + e, z + e);
        var gx = f1 - f2 - f3 + f4, gy = -f1 - f2 + f3 + f4, gz = -f1 + f2 - f3 + f4;
        var gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
        var s = (d - gap) / gl;
        x -= gx * s; y -= gy * s; z -= gz * s;
      }
      local[o] = x; local[o + 1] = y; local[o + 2] = z;
    }
    for (j = 0; j < ny; j++) {
      var b = (j - jr) * sp;
      for (i = 0; i < nx; i++) {
        k = j * nx + i;
        var a = (i - (nx - 1) / 2) * sp;
        var x = a, y, z;
        if (Math.abs(b) <= half) { z = -b; y = top; }
        else if (b < 0) { z = half; y = top - (-b - half); }
        else { z = -half; y = top - (b - half); }
        if (y < 0.012) { var ex = 0.012 - y; y = 0.012; z += z > 0 ? ex : -ex; }
        local[k * 3] = x; local[k * 3 + 1] = y; local[k * 3 + 2] = z;
        lay[k] = b < -half - 1e-4 ? 1 : b > half + 1e-4 ? -1 : 0;
        uv[k * 2] = i / (nx - 1);
        uv[k * 2 + 1] = j / (ny - 1);
        // Haube (Chris 2026-10-22: keine Handy-Ecken): über die ganze Oberkante
        // inkl. runder Ecken und ein Band CAP vorn/hinten fest auf dem Handy;
        // eine Gitterspalte greift um die Seitenkante (Anker auf die Oberfläche projiziert).
        if (Math.abs(b) <= half + CAP && Math.abs(a) <= HW + sp * 0.999) {
          pin[k] = 1;
          onSurface(k * 3, 0.024);
          anc[k * 3] = local[k * 3]; anc[k * 3 + 1] = local[k * 3 + 1]; anc[k * 3 + 2] = local[k * 3 + 2];
        }
      }
    }
    // Constraints: Struktur (1.0), Scherung (0.7), Biegung (0.3 — weich, große Falten)
    var list = [];
    function add(a2, b2, rest, st) { list.push(a2, b2, rest, st); }
    var sq = sp * Math.SQRT2;
    for (j = 0; j < ny; j++) {
      for (i = 0; i < nx; i++) {
        k = j * nx + i;
        if (i < nx - 1) add(k, k + 1, sp, 1);
        if (j < ny - 1) add(k, k + nx, sp, 1);
        if (i < nx - 1 && j < ny - 1) { add(k, k + nx + 1, sq, 0.7); add(k + 1, k + nx, sq, 0.7); }
        if (i < nx - 2) add(k, k + 2, sp * 2, 0.55);
        if (j < ny - 2) add(k, k + 2 * nx, sp * 2, 0.55);
      }
    }
    var C = list.length / 4;
    var ca = new Uint32Array(C), cb = new Uint32Array(C), cr = new Float32Array(C), ck = new Float32Array(C);
    for (i = 0; i < C; i++) { ca[i] = list[i * 4]; cb[i] = list[i * 4 + 1]; cr[i] = list[i * 4 + 2]; ck[i] = list[i * 4 + 3]; }
    list = null;

    var idx = [];
    for (j = 0; j < ny - 1; j++) {
      for (i = 0; i < nx - 1; i++) {
        var q0 = j * nx + i, q1 = q0 + 1, q2 = q0 + nx, q3 = q2 + 1;
        idx.push(q0, q1, q2, q1, q3, q2);
      }
    }
    var index = N > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);

    var G = 24, DAMP = 0.982, ITER = cfg.iter, FLOOR = 0.012, MARGIN = 0.02;
    var LIFT = cfg.lift, PUSH = cfg.push, HX = cfg.hx;
    var M = null, Mi = null;   // Float32-Referenzen auf matrixWorld / Inverse (elements)
    var fwdX = 0, fwdZ = 1;
    var jHem = Math.min(10, jr);

    function place(me) {
      for (var n = 0; n < N; n++) {
        var o = n * 3, lx = local[o], ly = local[o + 1], lz = local[o + 2];
        var wx = me[0] * lx + me[4] * ly + me[8] * lz + me[12];
        var wy = me[1] * lx + me[5] * ly + me[9] * lz + me[13];
        var wz = me[2] * lx + me[6] * ly + me[10] * lz + me[14];
        pos[o] = prv[o] = wx; pos[o + 1] = prv[o + 1] = wy; pos[o + 2] = prv[o + 2] = wz;
      }
    }

    function setFrame(me, mi, fx, fz) { M = me; Mi = mi; fwdX = fx; fwdZ = fz; }

    function step(h, impulse) {
      var g = -G * h * h;
      var n, o;
      var imp = impulse * h * h;
      for (n = 0; n < N; n++) {
        o = n * 3;
        if (pin[n]) {
          var lx = anc[o], ly = anc[o + 1], lz = anc[o + 2];
          prv[o] = pos[o]; prv[o + 1] = pos[o + 1]; prv[o + 2] = pos[o + 2];
          pos[o] = M[0] * lx + M[4] * ly + M[8] * lz + M[12];
          pos[o + 1] = M[1] * lx + M[5] * ly + M[9] * lz + M[13];
          pos[o + 2] = M[2] * lx + M[6] * ly + M[10] * lz + M[14];
          continue;
        }
        var x = pos[o], y = pos[o + 1], z = pos[o + 2];
        var vx = (x - prv[o]) * DAMP, vy = (y - prv[o + 1]) * DAMP, vz = (z - prv[o + 2]) * DAMP;
        prv[o] = x; prv[o + 1] = y; prv[o + 2] = z;
        var ay = g, ax = 0, az = 0;
        if (imp > 0) {
          var row = (n / nx) | 0;
          if (row < jHem) {
            var col = n - row * nx;
            var wgt = 1 - row / jHem;
            wgt *= wgt;
            var cen = 1 - Math.abs(col / (nx - 1) - 0.52) * 1.3;
            if (cen < 0) cen = 0;
            ay += imp * 78 * LIFT * wgt * (0.35 + cen);
            ax += imp * 20 * PUSH * wgt * fwdX * cen;
            az += imp * 20 * PUSH * wgt * fwdZ * cen;
          }
        }
        pos[o] = x + vx + ax; pos[o + 1] = y + vy + ay; pos[o + 2] = z + vz + az;
      }
      for (var it = 0; it < ITER; it++) {
        for (var c = 0; c < C; c++) {
          var ia = ca[c], ib = cb[c];
          var wa = pin[ia] ? 0 : 1, wb = pin[ib] ? 0 : 1;
          var ws = wa + wb;
          if (ws === 0) continue;
          var oa = ia * 3, ob = ib * 3;
          var dx = pos[ob] - pos[oa], dy = pos[ob + 1] - pos[oa + 1], dz = pos[ob + 2] - pos[oa + 2];
          var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < 1e-7) continue;
          var corr = (d - cr[c]) / (d * ws) * ck[c];
          dx *= corr; dy *= corr; dz *= corr;
          if (wa) { pos[oa] += dx; pos[oa + 1] += dy; pos[oa + 2] += dz; }
          if (wb) { pos[ob] -= dx; pos[ob + 1] -= dy; pos[ob + 2] -= dz; }
        }
      }
      collide();
    }

    function collide() {
      var e = 0.003, lim = HD + MARGIN;
      for (var n = 0; n < N; n++) {
        if (pin[n]) continue;
        var o = n * 3;
        var x = pos[o], y = pos[o + 1], z = pos[o + 2];
        var lx = Mi[0] * x + Mi[4] * y + Mi[8] * z + Mi[12];
        var ly = Mi[1] * x + Mi[5] * y + Mi[9] * z + Mi[13];
        var lz = Mi[2] * x + Mi[6] * y + Mi[10] * z + Mi[14];
        var hit = false;
        if (lx > -HW - 0.06 && lx < HW + 0.06 && ly > -0.05 && ly < PH + 0.07 && lz > -HD - 0.09 && lz < HD + 0.07) {
          var d = sdPhone(lx, ly, lz);
          if (d < MARGIN) {
            var f1 = sdPhone(lx + e, ly - e, lz - e), f2 = sdPhone(lx - e, ly - e, lz + e);
            var f3 = sdPhone(lx - e, ly + e, lz - e), f4 = sdPhone(lx + e, ly + e, lz + e);
            var gx = f1 - f2 - f3 + f4, gy = -f1 - f2 + f3 + f4, gz = -f1 + f2 - f3 + f4;
            var gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
            var push = (MARGIN - d) / gl;
            lx += gx * push; ly += gy * push; lz += gz * push;
            hit = true;
          }
        }
        // Vorder-/Rückbahn bleiben vor bzw. hinter ihrer Handy-Ebene: die Bahn
        // faltet sich an der Seitenkante um, statt nach hinten wegzuklappen.
        var sd = lay[n];
        if (sd !== 0 && ly > -0.4 && ly < PH + 0.06 && lx > -HW - HX && lx < HW + HX && (sd > 0 ? lz < lim : lz > -lim)) { lz = sd * lim; hit = true; }
        if (hit) {
          x = M[0] * lx + M[4] * ly + M[8] * lz + M[12];
          y = M[1] * lx + M[5] * ly + M[9] * lz + M[13];
          z = M[2] * lx + M[6] * ly + M[10] * lz + M[14];
          pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
          prv[o] += (x - prv[o]) * 0.3; prv[o + 1] += (y - prv[o + 1]) * 0.3; prv[o + 2] += (z - prv[o + 2]) * 0.3;
        }
        if (pos[o + 1] < FLOOR) {
          pos[o + 1] = FLOOR;
          prv[o + 1] = FLOOR;
          prv[o] += (pos[o] - prv[o]) * 0.55;
          prv[o + 2] += (pos[o + 2] - prv[o + 2]) * 0.55;
        }
      }
    }

    function normals() {
      for (var j2 = 0; j2 < ny; j2++) {
        var jd = j2 > 0 ? j2 - 1 : j2, ju = j2 < ny - 1 ? j2 + 1 : j2;
        for (var i2 = 0; i2 < nx; i2++) {
          var il = i2 > 0 ? i2 - 1 : i2, ir = i2 < nx - 1 ? i2 + 1 : i2;
          var a1 = (j2 * nx + ir) * 3, a0 = (j2 * nx + il) * 3, b1 = (ju * nx + i2) * 3, b0 = (jd * nx + i2) * 3;
          var ux = pos[a1] - pos[a0], uy = pos[a1 + 1] - pos[a0 + 1], uz = pos[a1 + 2] - pos[a0 + 2];
          var vx = pos[b1] - pos[b0], vy = pos[b1 + 1] - pos[b0 + 1], vz = pos[b1 + 2] - pos[b0 + 2];
          var nxv = uy * vz - uz * vy, nyv = uz * vx - ux * vz, nzv = ux * vy - uy * vx;
          var l = Math.sqrt(nxv * nxv + nyv * nyv + nzv * nzv) || 1;
          var o = (j2 * nx + i2) * 3;
          nrm[o] = nxv / l; nrm[o + 1] = nyv / l; nrm[o + 2] = nzv / l;
        }
      }
    }

    // Saumhöhe vorn (Mittelwert einiger Partikel der ersten Reihe)
    function hemY() {
      var s = 0, c0 = ((nx - 1) / 2 | 0) - 3;
      for (var q = 0; q < 7; q++) s += pos[(c0 + q) * 3 + 1];
      return s / 7;
    }

    return {
      nx: nx, ny: ny, jr: jr, N: N, pos: pos, nrm: nrm, uv: uv, index: index,
      place: place, setFrame: setFrame, step: step, normals: normals, hemY: hemY,
      logoRect: function (w, h, gap) {
        var L = LF + LB;
        var u0 = 0.5 - (w / CW) / 2, u1 = 0.5 + (w / CW) / 2;
        var vTop = (LF - gap) / L, vBot = (LF - gap - h) / L;
        return [u0, vBot, u1, vTop];
      }
    };
  }

  // ── Choreografie ────────────────────────────────────────────────
  function hump(t, a, b) { if (t <= a || t >= b) return 0; return Math.sin(Math.PI * (t - a) / (b - a)); }
  function envl(t, a, b, ri, fo) {
    if (t <= a || t >= b) return 0;
    var e = Math.min(1, (t - a) / ri, (b - t) / fo);
    return e * e * (3 - 2 * e);
  }
  function parab(t, a, d, h) { if (t <= a || t >= a + d) return 0; var u = (t - a) / d; return h * 4 * u * (1 - u); }
  function pulse(t, a, att, dec) { if (t <= a) return 0; var u = t - a; return (1 - Math.exp(-u * att)) * Math.exp(-u * dec); }

  function choreo(t, P) {
    var tr = envl(t, 2.0, 3.0, 0.18, 0.3);
    P.x = tr * 0.007 * Math.sin(t * TAU * 21);
    var roll = tr * 0.014 * Math.sin(t * TAU * 17 + 1.3);
    P.y = parab(t, 3.2, 0.42, 0.075) + parab(t, 4.1, 0.64, 0.24);
    roll += 0.035 * hump(t, 3.2, 3.62) - 0.032 * hump(t, 4.1, 4.74);
    if (t > 3.62 && t < 4.1) roll += 0.03 * Math.exp(-(t - 3.62) * 5) * Math.sin((t - 3.62) * 14);
    if (t > 4.74) roll += 0.05 * Math.exp(-(t - 4.74) * 3.4) * Math.sin((t - 4.74) * 12.5);
    var push = hump(t, 6.1, 7.3);
    P.roll = roll;
    P.pitch = 0.085 * hump(t, 4.05, 4.9) + 0.07 * push * push;
    P.yaw = 0.12 * push;
    P.flash = Math.min(1, pulse(t, 4.18, 30, 1.5) * 1.1 + pulse(t, 3.25, 30, 3.2) * 0.4 + tr * 0.3 * (0.5 + 0.5 * Math.sin(t * TAU * 6)));
    P.screen = 0.55 + 0.06 * Math.sin(t * 1.6) + P.flash * 0.95;
    P.impulse = hump(t, 4.16, 4.52);
  }

  function createScene(THREE, canvas, opts) {
    var mobile = opts.mobile;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    var dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
    renderer.setPixelRatio(dpr);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(23, 2, 0.1, 40);
    var disposables = [];
    function keep(x) { disposables.push(x); return x; }

    // Umgebung (PMREM) aus Emissionsflächen — nur für Metall/Glas des iPhones
    var pmrem = new THREE.PMREMGenerator(renderer);
    var envScene = new THREE.Scene();
    var envGeo = new THREE.SphereGeometry(10, 32, 16);
    var envMat = new THREE.ShaderMaterial({ vertexShader: ENV_VS, fragmentShader: ENV_FS, side: THREE.BackSide });
    envScene.add(new THREE.Mesh(envGeo, envMat));
    var panelGeo = new THREE.PlaneGeometry(1, 1);
    var envMats = [envMat];
    function panel(w, h, r, g, b, x, y, z) {
      var m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      m.color.setRGB(r, g, b);
      envMats.push(m);
      var me = new THREE.Mesh(panelGeo, m);
      me.scale.set(w, h, 1);
      me.position.set(x, y, z);
      me.lookAt(0, 0, 0);
      envScene.add(me);
    }
    panel(4, 3, 7, 5.6, 4, -4, 5, 4);
    panel(1.1, 6, 0.6, 2.6, 3.4, 5, 2, -4);
    panel(4, 2, 1.3, 0.7, 2.6, -5, 0.6, -2);
    panel(3, 1, 1.4, 1.4, 1.6, 1.6, 2.2, 6);
    var envRT = pmrem.fromScene(envScene, 0.035);
    envGeo.dispose(); panelGeo.dispose();
    for (var em = 0; em < envMats.length; em++) envMats[em].dispose();
    pmrem.dispose();
    scene.environment = envRT.texture;

    // Licht (für die Standard-Materialien des iPhones)
    var keyPos = new THREE.Vector3(-2.6, 4.2, 3.2);
    var rimPos = new THREE.Vector3(2.8, 2.2, -3.2);
    var fillPos = new THREE.Vector3(-3.2, 0.9, -1.2);
    var key = new THREE.DirectionalLight(0xfff0d8, 2.6); key.position.copy(keyPos); scene.add(key);
    var rim = new THREE.DirectionalLight(0x6fe4ff, 3.2); rim.position.copy(rimPos); scene.add(rim);
    var fill = new THREE.DirectionalLight(0x9b7ce0, 1.0); fill.position.copy(fillPos); scene.add(fill);
    scene.add(new THREE.AmbientLight(0x2a2450, 0.6));
    var dispLight = new THREE.PointLight(0x44d9ff, 0, 2.2, 2);
    scene.add(dispLight);

    // ── iPhone ────────────────────────────────────────────────
    var root = new THREE.Group(), pivot = new THREE.Group(), body = new THREE.Group();
    root.add(pivot); pivot.add(body); scene.add(root);

    var bev = 0.02, bevT = 0.022;
    var bodyGeo = keep(new THREE.ExtrudeGeometry(rrShape(THREE, -HW + bev, bev, PW - 2 * bev, PH - 2 * bev, PRC - bev), {
      depth: PD - 2 * bevT, bevelEnabled: true, bevelThickness: bevT, bevelSize: bev, bevelSegments: 5, curveSegments: 14
    }));
    bodyGeo.translate(0, 0, -(PD - 2 * bevT) / 2);
    // Das Handy liegt unter der Decke: dort kommt kaum Licht an. Darum dunkel und
    // ohne Umgebungsglanz — ein Spalt im Stoff liest sich als Schatten, nicht als Gerät.
    var frameMat = keep(new THREE.MeshStandardMaterial({ color: 0x1c1830, metalness: 0.6, roughness: 0.55, envMapIntensity: 0.08 }));
    var glassMat = keep(new THREE.MeshPhysicalMaterial({ color: 0x050509, metalness: 0, roughness: 0.3, clearcoat: 0.2, clearcoatRoughness: 0.4, envMapIntensity: 0.08 }));
    body.add(new THREE.Mesh(bodyGeo, [glassMat, frameMat]));

    var backGeo = keep(new THREE.ShapeGeometry(rrShape(THREE, -HW + bev + 0.004, bev + 0.004, PW - 2 * bev - 0.008, PH - 2 * bev - 0.008, PRC - bev - 0.004), 12));
    var backMat = keep(new THREE.MeshPhysicalMaterial({ color: 0x14102a, roughness: 0.6, metalness: 0, envMapIntensity: 0.08 }));
    var back = new THREE.Mesh(backGeo, backMat);
    back.rotation.y = Math.PI;
    back.position.z = -HD - 0.0008;
    body.add(back);

    // Display
    var bz = 0.03;
    var dW = PW - 2 * bz, dH = PH - 2 * bz;
    var dispGeo = keep(new THREE.ShapeGeometry(rrShape(THREE, -dW / 2, bz, dW, dH, PRC - bz), 14));
    var dispUni = {
      uScreen: { value: 0.6 }, uT: { value: 0 }, uCamX: { value: 0 },
      uSize: { value: new THREE.Vector2(dW, dH) }, uOrigin: { value: new THREE.Vector2(-dW / 2, bz) }
    };
    var dispMat = keep(new THREE.ShaderMaterial({ uniforms: dispUni, vertexShader: DISP_VS, fragmentShader: DISP_FS }));
    var disp = new THREE.Mesh(dispGeo, dispMat);
    disp.position.z = HD + 0.0008;
    body.add(disp);
    var islGeo = keep(new THREE.ShapeGeometry(rrShape(THREE, -0.1, -0.027, 0.2, 0.054, 0.027), 8));
    var black = keep(new THREE.MeshBasicMaterial({ color: 0x000000 }));
    var isl = new THREE.Mesh(islGeo, black);
    isl.position.set(0, PH - bz - 0.06, HD + 0.0012);
    body.add(isl);

    // Kameramodul
    var plateGeo = keep(new THREE.ExtrudeGeometry(rrShape(THREE, -BMH + 0.006, -BMH + 0.006, 2 * BMH - 0.012, 2 * BMH - 0.012, BMR), {
      depth: 0.008, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 10
    }));
    var plateMat = keep(new THREE.MeshPhysicalMaterial({ color: 0x14102a, roughness: 0.6, metalness: 0.1, envMapIntensity: 0.08 }));
    var plate = new THREE.Mesh(plateGeo, plateMat);
    plate.rotation.y = Math.PI;
    plate.position.set(BMX, BMY, -HD - 0.006);
    body.add(plate);
    var ringGeo = keep(new THREE.CylinderGeometry(0.066, 0.066, 0.018, 28));
    var lensGeo = keep(new THREE.CylinderGeometry(0.048, 0.048, 0.022, 28));
    var lensMat = keep(new THREE.MeshPhysicalMaterial({ color: 0x07060e, roughness: 0.4, metalness: 0.2, envMapIntensity: 0.08 }));
    var lensPos = [[0.07, 0.07], [0.07, -0.07], [-0.07, 0]];
    for (var lp = 0; lp < 3; lp++) {
      var rg = new THREE.Mesh(ringGeo, frameMat);
      rg.rotation.x = Math.PI / 2;
      rg.position.set(BMX + lensPos[lp][0], BMY + lensPos[lp][1], -HD - 0.028);
      body.add(rg);
      var ln = new THREE.Mesh(lensGeo, lensMat);
      ln.rotation.x = Math.PI / 2;
      ln.position.set(BMX + lensPos[lp][0], BMY + lensPos[lp][1], -HD - 0.034);
      body.add(ln);
    }
    // Seitentasten
    var btnGeo = keep(new THREE.BoxGeometry(0.014, 1, 0.03));
    function btn(x, y, len) { var m = new THREE.Mesh(btnGeo, frameMat); m.scale.y = len; m.position.set(x, y, 0); body.add(m); }
    btn(HW + 0.004, PH * 0.66, 0.2);
    btn(-HW - 0.004, PH * 0.8, 0.07);
    btn(-HW - 0.004, PH * 0.7, 0.13);
    btn(-HW - 0.004, PH * 0.6, 0.13);

    // ── Decke ─────────────────────────────────────────────────
    // Front reicht bis zum Boden (+ Überlänge), damit beim Hüpfer nie die Unterkante frei wird
    var cloth = createCloth({ sp: mobile ? 0.066 : 0.054, width: 1.5, front: 1.84, back: 1.86, iter: 3, cap: 0.45, lift: 0.2, push: 0.8, hx: 0 });
    var cGeo = keep(new THREE.BufferGeometry());
    var cPos = new THREE.BufferAttribute(cloth.pos, 3); cPos.setUsage(THREE.DynamicDrawUsage);
    var cNrm = new THREE.BufferAttribute(cloth.nrm, 3); cNrm.setUsage(THREE.DynamicDrawUsage);
    cGeo.setAttribute('position', cPos);
    cGeo.setAttribute('normal', cNrm);
    cGeo.setAttribute('uv', new THREE.BufferAttribute(cloth.uv, 2));
    cGeo.setIndex(new THREE.BufferAttribute(cloth.index, 1));
    var lr = cloth.logoRect(0.62, 0.62 * 1007 / 1920, 0.07);
    function nrmDir(v) { return v.clone().normalize(); }
    var clothUni = {
      uLogo: { value: null }, uLogoOn: { value: 0 },
      uLogoRect: { value: new THREE.Vector4(lr[0], lr[1], lr[2], lr[3]) },
      uCam: { value: new THREE.Vector3() },
      uKeyDir: { value: nrmDir(keyPos) }, uKeyCol: { value: new THREE.Vector3(1.0, 0.93, 0.82) },
      uFillDir: { value: nrmDir(fillPos) }, uFillCol: { value: new THREE.Vector3(0.55, 0.42, 0.95) },
      uRimDir: { value: nrmDir(rimPos) }, uRimCol: { value: new THREE.Vector3(0.35, 0.85, 1.0) },
      uScreen: { value: 0.6 }, uDispHalf: { value: new THREE.Vector2(dW / 2, dH / 2) },
      uDispY: { value: PH / 2 }, uDispZ: { value: HD },
      uPhoneInv: { value: new THREE.Matrix4() }
    };
    var clothMat = keep(new THREE.ShaderMaterial({
      uniforms: clothUni, vertexShader: CLOTH_VS, fragmentShader: CLOTH_FS,
      side: THREE.DoubleSide, extensions: { derivatives: true }
    }));
    var clothMesh = new THREE.Mesh(cGeo, clothMat);
    clothMesh.frustumCulled = false;
    scene.add(clothMesh);

    var logoTex = null;
    if (opts.logo) {
      new THREE.TextureLoader().load(opts.logo, function (t) {
        t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        logoTex = t;
        clothUni.uLogo.value = t;
        clothUni.uLogoOn.value = 1;
        if (api.onReady) api.onReady('logo');
      });
    }

    // ── Boden: Kontaktschatten + Licht ─────────────────────────
    var floorGeo = keep(new THREE.PlaneGeometry(7, 7));
    floorGeo.rotateX(-Math.PI / 2);
    var floorUni = {
      uPhone: { value: new THREE.Vector3() }, uFwd: { value: new THREE.Vector2(0, 1) },
      uScreen: { value: 0.6 }, uLift: { value: 0 }, uCanvasH: { value: 600 }
    };
    var shadowMat = keep(new THREE.ShaderMaterial({ uniforms: floorUni, vertexShader: FLOOR_VS, fragmentShader: SHADOW_FS, transparent: true, depthWrite: false }));
    var shadow = new THREE.Mesh(floorGeo, shadowMat);
    shadow.position.y = 0.001; shadow.renderOrder = -2;
    scene.add(shadow);
    var lightMat = keep(additive(THREE, new THREE.ShaderMaterial({ uniforms: floorUni, vertexShader: FLOOR_VS, fragmentShader: LIGHT_FS })));
    var floorLight = new THREE.Mesh(floorGeo, lightMat);
    floorLight.position.y = 0.002; floorLight.renderOrder = -1;
    scene.add(floorLight);

    // ── Glows ──────────────────────────────────────────────────
    var gTex = keep(glowTexture(THREE));
    function sprite(color, opacity) {
      var m = keep(additive(THREE, new THREE.SpriteMaterial({ map: gTex, color: color, opacity: opacity, toneMapped: false })));
      var s = new THREE.Sprite(m);
      scene.add(s);
      return s;
    }
    var halo = sprite(0x7c5cbf, 0.5);
    halo.position.set(0, 0.95, -0.6); halo.scale.set(2.3, 2.0, 1); halo.renderOrder = -3;
    var flashS = sprite(0x44d9ff, 0);
    flashS.scale.set(1.8, 1.1, 1); flashS.renderOrder = 5;

    // ── Staub im Key-Licht ─────────────────────────────────────
    var nd = mobile ? 90 : 170;
    var dPos = new Float32Array(nd * 3), dSeed = new Float32Array(nd * 4);
    for (var di = 0; di < nd; di++) {
      dPos[di * 3] = (Math.random() - 0.5) * 3.2;
      dPos[di * 3 + 1] = Math.random() * 2.6;
      dPos[di * 3 + 2] = (Math.random() - 0.4) * 2.2;
      for (var dk = 0; dk < 4; dk++) dSeed[di * 4 + dk] = Math.random();
    }
    var dustGeo = keep(new THREE.BufferGeometry());
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dSeed, 4));
    var keyAxis = new THREE.Vector3(0, 0.9, 0).sub(keyPos).normalize();
    var dustUni = { uT: { value: 0 }, uPx: { value: dpr }, uKeyPos: { value: keyPos.clone() }, uKeyAxis: { value: keyAxis } };
    var dustMat = keep(additive(THREE, new THREE.ShaderMaterial({ uniforms: dustUni, vertexShader: DUST_VS, fragmentShader: DUST_FS })));
    var dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false; dust.renderOrder = 6;
    scene.add(dust);

    // ── Funken beim Aufsetzen ──────────────────────────────────
    var ns = mobile ? 22 : 38;
    var sSeed = new Float32Array(ns * 4);
    for (var si = 0; si < ns * 4; si++) sSeed[si] = Math.random();
    var sparkGeo = keep(new THREE.BufferGeometry());
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ns * 3), 3));
    sparkGeo.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 4));
    var sparkUni = { uAge: { value: 9 }, uPow: { value: 1 }, uOrigin: { value: new THREE.Vector3() }, uFwd: floorUni.uFwd, uPx: { value: dpr } };
    var sparkMat = keep(additive(THREE, new THREE.ShaderMaterial({ uniforms: sparkUni, vertexShader: SPARK_VS, fragmentShader: SPARK_FS })));
    var sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.frustumCulled = false; sparks.renderOrder = 7;
    scene.add(sparks);

    // ── Zustand (vorab angelegt, keine Allokation im Loop) ─────
    var P = { x: 0, y: 0, roll: 0, pitch: 0, yaw: 0, flash: 0, screen: 0.6, impulse: 0 };
    var inv = new THREE.Matrix4();
    var tmpV = new THREE.Vector3();
    var camBase = new THREE.Vector3(1.3, 1.22, 5.6);
    var camTarget = new THREE.Vector3(0.02, 0.86, 0);
    var par = { tx: 0, ty: 0, x: 0, y: 0, scroll: 0 };
    var time = 0, lastLoopT = 0, acc = 0, sparkT = -9;
    var H_STEP = 1 / 120;
    var hemRest = 0.35;

    function applyPose() {
      var pitch = BASE_PITCH + P.pitch;
      var cx = (P.roll >= 0 ? -1 : 1) * (HW - 0.03);
      var cz = (pitch >= 0 ? 1 : -1) * HD;
      pivot.position.set(cx, 0, cz);
      pivot.rotation.set(pitch, 0, P.roll);
      body.position.set(-cx, 0, -cz);
      root.position.set(P.x, P.y, 0);
      root.rotation.y = BASE_YAW + P.yaw;
      root.updateMatrixWorld(true);
      inv.copy(body.matrixWorld).invert();
      var me = body.matrixWorld.elements;
      var fx = me[8], fz = me[10];
      var fl = Math.sqrt(fx * fx + fz * fz) || 1;
      cloth.setFrame(me, inv.elements, fx / fl, fz / fl);
      floorUni.uFwd.value.set(fx / fl, fz / fl);
    }

    function warmup(done) {
      P.x = P.y = P.roll = P.pitch = P.yaw = P.flash = P.impulse = 0;
      applyPose();
      cloth.place(body.matrixWorld.elements);
      var total = mobile ? 300 : 380, n = 0;
      (function chunk() {
        if (disposed) return;
        var end = Math.min(total, n + (mobile ? 24 : 30));
        for (; n < end; n++) cloth.step(H_STEP, 0);
        if (n < total) { setTimeout(chunk, 0); return; }
        hemRest = cloth.hemY();
        cloth.normals();
        cPos.needsUpdate = true; cNrm.needsUpdate = true;
        done();
      })();
    }

    function resize(w, h) {
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      floorUni.uCanvasH.value = h * dpr;
      camera.aspect = w / h;
      var fit = camera.aspect < 1 ? 1 / camera.aspect : 1;
      camBase.set(1.3, 1.22, 5.6).multiplyScalar(camera.aspect < 1 ? 0.92 + 0.36 * (fit - 1) : 1);
      camTarget.y = camera.aspect < 1 ? 0.9 : 0.86;
      camera.updateProjectionMatrix();
    }

    function setPointer(nx, ny) { par.tx = nx; par.ty = ny; }
    function setScroll(s) { par.scroll = s; }

    function updateScene(dt, animate) {
      if (animate) {
        time += dt;
        var t = time % LOOP;
        choreo(t, P);
        if ((lastLoopT < 3.62 && t >= 3.62)) { sparkT = time; sparkUni.uPow.value = 0.45; }
        if ((lastLoopT < 4.74 && t >= 4.74)) { sparkT = time; sparkUni.uPow.value = 1; }
        lastLoopT = t;
        applyPose();
        acc += dt;
        var steps = 0;
        while (acc >= H_STEP && steps < 3) { cloth.step(H_STEP, P.impulse); acc -= H_STEP; steps++; }
        if (steps === 3) acc = 0;
        cloth.normals();
        cPos.needsUpdate = true; cNrm.needsUpdate = true;
      }
      var lift = clamp01((cloth.hemY() - hemRest) / 0.45);
      var me = body.matrixWorld.elements;
      clothUni.uPhoneInv.value.copy(inv);
      clothUni.uScreen.value = P.screen;
      dispUni.uScreen.value = P.screen;
      dispUni.uT.value = time;
      floorUni.uScreen.value = P.screen;
      floorUni.uLift.value = lift;
      floorUni.uPhone.value.set(me[12], P.y, me[14]);
      // Display-Licht + Cyan-Blitz am Saum
      tmpV.set(0, 0.45, HD + 0.2).applyMatrix4(body.matrixWorld);
      dispLight.position.copy(tmpV);
      dispLight.intensity = 0.6 * P.screen + 2.2 * P.flash;
      tmpV.set(0, Math.max(0.2, cloth.hemY() - P.y) * 0.7, HD + 0.22).applyMatrix4(body.matrixWorld);
      flashS.position.copy(tmpV);
      flashS.material.opacity = 0.06 + P.flash * (0.25 + lift * 0.5);
      halo.material.opacity = 0.42 + P.flash * 0.25;
      dustUni.uT.value = time;
      var age = time - sparkT;
      sparkUni.uAge.value = age;
      if (age < 0.05) sparkUni.uOrigin.value.set(me[12] + me[8] * 0.12, 0.02, me[14] + me[10] * 0.12);
      // Kamera: Maus-/Scroll-Parallaxe
      var k = animate ? 1 - Math.exp(-dt * 3) : 1;
      par.x += (par.tx - par.x) * k;
      par.y += (par.ty - par.y) * k;
      camera.position.set(camBase.x + par.x * 0.35, camBase.y - par.y * 0.14 + par.scroll * 0.18, camBase.z);
      camera.lookAt(camTarget);
      clothUni.uCam.value.copy(camera.position);
      dispUni.uCamX.value = par.x;
    }

    function render(dt, animate) {
      updateScene(dt, animate);
      renderer.render(scene, camera);
    }

    var disposed = false;
    function dispose() {
      disposed = true;
      for (var i = 0; i < disposables.length; i++) if (disposables[i] && disposables[i].dispose) disposables[i].dispose();
      if (logoTex) logoTex.dispose();
      envRT.dispose();
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    }

    var api = {
      warmup: warmup, resize: resize, render: render, dispose: dispose,
      setPointer: setPointer, setScroll: setScroll,
      flash: function () { return P.flash; },
      setStill: function () { P.screen = 0.95; P.flash = 0.35; },
      onReady: null
    };
    return api;
  }

  /* ════════════════════════════════════════════════════════════════
     3 · SECTION-CONTROLLER
     ════════════════════════════════════════════════════════════════ */
  function init(root) {
    if (!root || root.__bnb) return;
    var ctl = { destroy: null };
    root.__bnb = ctl;

    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var det = root.querySelector('[data-bnb-det]');
    var sticky = det && det.querySelector('.bnb-det__sticky');
    var detCanvas = root.querySelector('[data-bnb-det-gl]');
    var head = root.querySelector('[data-bnb-head]');
    var title = head && head.querySelector('.bnb-title');
    var core = root.querySelector('.bnb-det__core');
    var disc = root.querySelector('.bnb-det__disc');
    var ring = root.querySelector('.bnb-det__ring');
    var sceneEl = root.querySelector('[data-bnb-scene]');
    var frameEl = sceneEl && sceneEl.querySelector('.bnb-scene__frame');
    var sceneCanvas = root.querySelector('[data-bnb-scene-gl]');
    var threeSrc = root.getAttribute('data-three-src');
    var logoSrc = root.getAttribute('data-logo-src');
    if (!det || !sticky || !sceneEl || !frameEl) return;

    var mobile = isMobile();
    var S = {
      enhanced: false, near: false, detView: false, sceneNear: false, sceneView: false,
      hidden: document.hidden, raf: 0, loop: 0, last: 0, p: -1, pDrawn: -1, t: 0, flash: -1,
      dist: 1, total: 1, lead: 1, chrome: 0, detGL: null, sceneGL: null, sceneReady: false, threeFailed: false,
      loadingDet: false, loadingScene: false
    };

    // ── Messen ─────────────────────────────────────────────
    function measure() {
      S.chrome = parseFloat(getComputedStyle(sticky).top) || 0;
      S.dist = Math.max(1, det.offsetHeight - sticky.offsetHeight);
      S.total = Math.max(1, det.offsetHeight);
      S.lead = sticky.offsetHeight;
      if (S.enhanced && head) {
        var over = sticky.offsetHeight - (head.offsetTop + head.offsetHeight) - 4;
        root.style.setProperty('--bnb-overlap', Math.max(0, Math.round(over)) + 'px');
      }
      if (S.detGL) S.detGL.resize(sticky.clientWidth, sticky.clientHeight);
      if (S.sceneGL) S.sceneGL.resize(frameEl.clientWidth, frameEl.clientHeight);
    }

    function progress() {
      var r = det.getBoundingClientRect();
      // Einfahrt + Pin: 0 = Bühne tritt unten ein, 1 = Ende der Pin-Strecke
      return clamp01((S.chrome + S.lead - r.top) / S.total);
    }

    // Solange die Bühne noch hereinscrollt, blendet der Shader Tönung und
    // Sog-Streifen zur Oberkante aus (kein Saum gegen das Weiß darüber).
    function topFade() {
      var off = sticky.getBoundingClientRect().top - S.chrome;
      return clamp01(off / (0.06 * (S.lead || 1)));
    }

    // ── Detonation zeichnen (CSS-Variante + Headline) ────────────
    function drawDetCss(p) {
      var hv = easeOut3(seg(p, 0.64, 0.8));
      head.style.opacity = hv.toFixed(3);
      head.style.transform = 'translate3d(0,' + ((1 - hv) * 26).toFixed(2) + 'px,0) scale(' + (1.04 - 0.04 * hv).toFixed(4) + ')';
      if (S.detGL) return;
      var gather = smooth(seg(p, T_G0, T_G1)), squeeze = smooth(seg(p, T_S0, T_DET));
      var te = p - T_DET;
      var cs, co;
      if (te < 0) { cs = (0.12 + 0.88 * gather) * (1 - 0.75 * squeeze); co = gather; }
      else { cs = 0.25 + 2.2 * (1 - Math.exp(-te * 12)); co = Math.exp(-te * 14); }
      core.style.transform = 'translate(-50%,-50%) scale(' + cs.toFixed(4) + ')';
      core.style.opacity = co.toFixed(3);
      var rt = easeOut3(seg(p, T_DET, T_DET + T_RING));
      var ds = te < 0 ? 0 : rt;
      disc.style.transform = 'translate(-50%,-50%) scale(' + ds.toFixed(4) + ')';
      ring.style.transform = 'translate(-50%,-50%) scale(' + ds.toFixed(4) + ')';
      ring.style.opacity = (te < 0 ? 0 : 1 - smooth(seg(rt, 0.7, 1))).toFixed(3);
    }

    function clearInline() {
      [head, core, disc, ring].forEach(function (el) { if (el) { el.style.transform = ''; el.style.opacity = ''; } });
      root.style.removeProperty('--bnb-overlap');
    }

    // ── Haupt-Loop (ein rAF für beide Canvas) ────────────────────
    function wantLoop() {
      if (S.hidden) return false;
      var detOn = S.enhanced && S.detView;
      var sceneOn = S.sceneReady && S.sceneView && !mq.matches;
      return detOn || sceneOn;
    }
    function kick() {
      if (!S.loop && wantLoop()) { S.last = performance.now(); S.loop = requestAnimationFrame(frame); }
    }
    var perfBuf = window.__bnbPerf ? (window.__bnbPerfData = { js: new Float32Array(2000), n: 0 }) : null;

    function frame(now) {
      S.loop = 0;
      if (!wantLoop()) return;
      S.loop = requestAnimationFrame(frame);
      var t0 = perfBuf ? performance.now() : 0;
      var dt = Math.min((now - S.last) / 1000, 0.05);
      S.last = now;
      S.t += dt;

      if (S.enhanced && S.detView) {
        var p = progress();
        if (Math.abs(p - S.p) > 0.0003) { S.p = p; drawDetCss(p); }
        if (S.detGL && (p !== S.pDrawn || (p > 0.005 && p < 0.99))) { S.detGL.render(p, S.t, topFade()); S.pDrawn = p; }
      }
      if (S.sceneReady && S.sceneView && !mq.matches) {
        var r = frameEl.getBoundingClientRect();
        var vh = window.innerHeight || 1;
        S.sceneGL.setScroll(Math.max(-1, Math.min(1, ((r.top + r.height / 2) - vh / 2) / vh)));
        S.sceneGL.render(dt, true);
        var f = S.sceneGL.flash();
        if (Math.abs(f - S.flash) > 0.02 && title) { S.flash = f; title.style.setProperty('--bnb-flash', f.toFixed(2)); }
      }
      if (perfBuf) { perfBuf.js[perfBuf.n % 2000] = performance.now() - t0; perfBuf.n++; }
    }

    function onScroll() {
      // Ohne laufenden Loop (z. B. Headline bei reduced motion nicht betroffen) nichts zu tun
      kick();
    }
    function onResize() {
      mobile = isMobile();
      measure();
      S.p = -1; S.pDrawn = -1;
      if (S.enhanced) drawDetCss(progress());
      if (S.detGL && !S.detView) { /* wird beim nächsten Sichtkontakt gezeichnet */ }
      if (S.sceneReady && mq.matches) S.sceneGL.render(0, false);
      kick();
    }
    function onPointer(e) {
      if (!S.sceneGL || mq.matches) return;
      var w = window.innerWidth || 1, h = window.innerHeight || 1;
      S.sceneGL.setPointer((e.clientX / w) * 2 - 1, (e.clientY / h) * 2 - 1);
    }
    function onVis() { S.hidden = document.hidden; if (!S.hidden) kick(); }

    // ── GL-Aufbau (lazy, sobald in der Nähe) ────────────────────
    function ensureDetGL() {
      if (S.detGL || S.loadingDet || S.threeFailed || !S.enhanced || !detCanvas || !hasWebGL()) return;
      S.loadingDet = true;
      loadThree(threeSrc).then(function (THREE) {
        S.loadingDet = false;
        if (!S.enhanced || S.detGL || root.__bnb !== ctl) return;
        try { S.detGL = createDetonation(THREE, detCanvas, mobile); }
        catch (e) { S.detGL = null; return; }
        root.classList.add('is-det-gl');
        S.detGL.resize(sticky.clientWidth, sticky.clientHeight);
        S.p = -1; S.pDrawn = -1;
        var p = progress();
        S.detGL.render(p, S.t, topFade()); S.pDrawn = p;
        drawDetCss(p);
        kick();
      }, function () { S.loadingDet = false; S.threeFailed = true; });
    }

    function ensureSceneGL() {
      if (S.sceneGL || S.loadingScene || S.threeFailed || !sceneCanvas) return;
      if (!hasWebGL()) { sceneEl.classList.add('is-nogl'); return; }
      S.loadingScene = true;
      loadThree(threeSrc).then(function (THREE) {
        S.loadingScene = false;
        if (S.sceneGL || root.__bnb !== ctl) return;
        try { S.sceneGL = createScene(THREE, sceneCanvas, { mobile: mobile, logo: logoSrc }); }
        catch (e) { S.sceneGL = null; sceneEl.classList.add('is-nogl'); return; }
        S.sceneGL.resize(frameEl.clientWidth, frameEl.clientHeight);
        S.sceneGL.onReady = function () { if (S.sceneReady && mq.matches) S.sceneGL.render(0, false); };
        S.sceneGL.warmup(function () {
          if (root.__bnb !== ctl) return;
          S.sceneReady = true;
          if (mq.matches) S.sceneGL.setStill();
          S.sceneGL.render(0, false);
          sceneEl.classList.add('is-gl');
          kick();
        });
      }, function () { S.loadingScene = false; S.threeFailed = true; sceneEl.classList.add('is-nogl'); });
    }

    // ── Beobachter ──────────────────────────────────────────────
    var ioDetNear = new IntersectionObserver(function (en) {
      S.near = en[en.length - 1].isIntersecting;
      if (S.near) { measure(); ensureDetGL(); }
    }, { rootMargin: '150% 0px 150% 0px' });
    var ioDet = new IntersectionObserver(function (en) {
      S.detView = en[en.length - 1].isIntersecting;
      if (S.detView) { S.p = -1; S.pDrawn = -1; }
      kick();
    });
    var ioSceneNear = new IntersectionObserver(function (en) {
      S.sceneNear = en[en.length - 1].isIntersecting;
      if (S.sceneNear) ensureSceneGL();
    }, { rootMargin: '150% 0px 150% 0px' });
    var ioScene = new IntersectionObserver(function (en) {
      S.sceneView = en[en.length - 1].isIntersecting;
      sceneEl.classList.toggle('is-off', !S.sceneView);
      kick();
    });
    var ro = window.ResizeObserver ? new ResizeObserver(function () { onResize(); }) : null;

    function enable() {
      S.enhanced = true;
      root.classList.add('is-enhanced');
      measure();
      S.p = -1;
      drawDetCss(progress());
      ensureDetGL();
      kick();
    }
    function disable() {
      S.enhanced = false;
      root.classList.remove('is-enhanced', 'is-det-gl');
      clearInline();
      if (S.detGL) { S.detGL.dispose(); S.detGL = null; }
      if (S.sceneReady) { S.sceneGL.setStill(); S.sceneGL.render(0, false); }
      measure();
    }
    function applyPref() { if (mq.matches) disable(); else enable(); }

    applyPref();
    ioDetNear.observe(det);
    ioDet.observe(sticky);
    ioSceneNear.observe(sceneEl);
    ioScene.observe(frameEl);
    if (ro) { ro.observe(frameEl); ro.observe(sticky); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    root.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    if (mq.addEventListener) mq.addEventListener('change', applyPref);

    // Anker #neues-game: nicht auf dem weißen Anfang landen, sondern dort,
    // wo Headline und Szene stehen (Ende der Detonation).
    function jumpToStage() {
      if (location.hash !== '#neues-game' || !S.enhanced) return;
      measure();
      var y = det.getBoundingClientRect().top + window.pageYOffset - S.chrome + S.dist;
      window.scrollTo(0, Math.max(0, Math.round(y)));
    }
    if (location.hash === '#neues-game') {
      requestAnimationFrame(jumpToStage);
      window.addEventListener('load', jumpToStage, { once: true });
    }
    window.addEventListener('hashchange', jumpToStage);

    ctl.destroy = function () {
      ioDetNear.disconnect(); ioDet.disconnect(); ioSceneNear.disconnect(); ioScene.disconnect();
      if (ro) ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('hashchange', jumpToStage);
      root.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVis);
      if (mq.removeEventListener) mq.removeEventListener('change', applyPref);
      if (S.loop) cancelAnimationFrame(S.loop);
      if (S.detGL) S.detGL.dispose();
      if (S.sceneGL) S.sceneGL.dispose();
      S.detGL = S.sceneGL = null; S.sceneReady = false;
      root.__bnb = null;
    };
  }

  function boot() {
    var all = document.querySelectorAll('[data-bnb]');
    for (var i = 0; i < all.length; i++) init(all[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Shopify-Theme-Editor
  document.addEventListener('shopify:section:load', function (e) {
    var el = e.target && e.target.querySelector && e.target.querySelector('[data-bnb]');
    if (el) init(el);
  });
  document.addEventListener('shopify:section:unload', function (e) {
    var el = e.target && e.target.querySelector && e.target.querySelector('[data-bnb]');
    if (el && el.__bnb && el.__bnb.destroy) el.__bnb.destroy();
  });
})();
