// Warpath 2026 — 3D weergave (three.js)
'use strict';
(function () {
const T = THREE;
const R = WP.GALAXY_R;
const AURA_COL = { white: 0xd8e4ff, yellow: 0xffd84a, green: 0x3dff7a, red: 0xff3b3b, unknown: 0x6a7388 };

// ---------- procedurele textures ----------
function glowTex(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)', size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, mid); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return new T.CanvasTexture(c);
}
function ringTex() {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, s * 0.36, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s); return new T.CanvasTexture(c);
}
function swirlTex() {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  g.translate(s / 2, s / 2);
  for (let arm = 0; arm < 4; arm++) for (let i = 0; i < 160; i++) {
    const t = i / 160, a = arm * Math.PI / 2 + t * 5, r = t * s * 0.48;
    g.fillStyle = `hsla(${230 + t * 60},90%,${70 - t * 30}%,${(1 - t) * 0.5})`;
    g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, 10 * (1 - t) + 2, 0, 7); g.fill();
  }
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.2); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(120,140,255,0)');
  g.fillStyle = gr; g.fillRect(-s / 2, -s / 2, s, s);
  return new T.CanvasTexture(c);
}
function galaxyTex() {
  const s = 2048, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
  g.translate(s / 2, s / 2); g.globalCompositeOperation = 'lighter';
  const rnd = WP.rng(1977);
  // armen
  for (let i = 0; i < 26000; i++) {
    const arm = i % 4, t = Math.pow(rnd(), 0.7), a = arm * Math.PI / 2 + t * 6.2 + (rnd() - 0.5) * 0.55 * (1.2 - t), r = t * s * 0.47 + (rnd() - 0.5) * 40;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    const hue = rnd() < 0.15 ? 330 + rnd() * 40 : 200 + rnd() * 50;
    const sz = rnd() * 9 + 1;
    g.fillStyle = `hsla(${hue},70%,${55 + rnd() * 30}%,${0.03 + rnd() * 0.06})`;
    g.beginPath(); g.arc(x, y, sz, 0, 7); g.fill();
  }
  for (let i = 0; i < 9000; i++) { const a = rnd() * 7, r = Math.pow(rnd(), 2) * s * 0.5; g.fillStyle = `rgba(255,255,255,${rnd() * 0.5})`; g.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1.5, 1.5); }
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.2);
  gr.addColorStop(0, 'rgba(255,240,210,0.9)'); gr.addColorStop(0.3, 'rgba(255,200,150,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(-s / 2, -s / 2, s, s);
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
}

// 3D value noise voor naadloze planeten
function makeNoise(seed) {
  const perm = new Uint8Array(512), rnd = WP.rng(seed + 1);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const vals = new Float32Array(256); for (let i = 0; i < 256; i++) vals[i] = rnd();
  const h = (x, y, z) => vals[perm[(perm[(perm[x & 255] + y) & 255] + z) & 255]];
  const sm = t => t * t * (3 - 2 * t);
  const n = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), xf), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf),
             l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf), zf);
  };
  return (x, y, z, oct = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * n(x * f + 31, y * f + 17, z * f + 7); a *= 0.5; f *= 2.03; } return s / (1 - Math.pow(0.5, oct)); };
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function planetTexture(type, seed) {
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  const N = makeNoise(seed), rnd = WP.rng(seed + 9);
  const hueShift = rnd();
  for (let y = 0; y < H; y++) {
    const lat = (y / H - 0.5) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const lon = x / W * Math.PI * 2, px = Math.cos(lon) * cl, pz = Math.sin(lon) * cl, py = sl;
      let col, n = N(px * 2.2, py * 2.2, pz * 2.2), n2;
      switch (type) {
        case 'terran': case 'ocean': case 'jungle': {
          const sea = type === 'ocean' ? 0.6 : type === 'jungle' ? 0.38 : 0.5;
          if (n < sea) col = mix([8, 30, 90], [30, 90, 170], n / sea);
          else { const t = (n - sea) / (1 - sea); col = type === 'jungle' ? mix([20, 90, 30], [70, 120, 40], t) : mix([60, 120, 50], [150, 130, 90], t * 1.4); if (t > 0.7) col = mix(col, [200, 200, 200], (t - 0.7) * 2); }
          if (Math.abs(sl) > 0.82 - n * 0.15) col = mix(col, [240, 245, 255], 0.85);
          n2 = N(px * 5 + 9, py * 5, pz * 5, 3); if (n2 > 0.62) col = mix(col, [255, 255, 255], (n2 - 0.62) * 2.2);
          break;
        }
        case 'desert': col = mix([150, 90, 40], [235, 190, 120], n); n2 = N(px * 8, py * 8, pz * 8, 2); col = mix(col, [120, 70, 30], Math.max(0, n2 - 0.6)); break;
        case 'ice': col = mix([140, 180, 220], [245, 250, 255], n); n2 = N(px * 6, py * 6, pz * 6, 3); if (n2 > 0.58) col = mix(col, [90, 140, 200], (n2 - 0.58) * 2); break;
        case 'lava': { const r = 1 - Math.abs(N(px * 3, py * 3, pz * 3, 4) - 0.5) * 2; col = mix([25, 15, 15], [60, 40, 35], n); if (r > 0.86) col = mix(col, [255, 140, 30], (r - 0.86) * 7); break; }
        case 'gas': { const b = Math.sin(py * 14 + N(px * 2, py * 2, pz * 2, 4) * 6); const h1 = hueShift < 0.5 ? [[200, 150, 100], [240, 220, 180]] : [[110, 140, 200], [210, 220, 250]]; col = mix(h1[0], h1[1], b * 0.5 + 0.5); col = mix(col, [255, 255, 255], Math.max(0, n - 0.7)); break; }
        default: { col = mix([80, 78, 75], [170, 165, 160], n); n2 = N(px * 9, py * 9, pz * 9, 2); if (n2 > 0.7) col = mix(col, [50, 48, 45], 0.6); }
      }
      const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
}

// ---------- scheepsmodellen ----------
function buildShip(design, pathColor, scale = 1) {
  const g = new T.Group();
  const hull = new T.MeshStandardMaterial({ color: 0xb8c2d6, metalness: 0.75, roughness: 0.32 });
  const dark = new T.MeshStandardMaterial({ color: 0x3a4152, metalness: 0.6, roughness: 0.5 });
  const accent = new T.MeshStandardMaterial({ color: pathColor, emissive: pathColor, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.4 });
  const glass = new T.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x2288ff, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.1 });
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); g.add(m); return m; };
  switch (design) {
    case 0: // schotel
      add(new T.SphereGeometry(30, 32, 16), hull, 0, 0, 0, 0, 0, 0, 1, 0.22, 1);
      add(new T.SphereGeometry(12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 5, 0);
      add(new T.TorusGeometry(26, 2.2, 8, 40), accent, 0, 0, 0, Math.PI / 2);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new T.SphereGeometry(2.5, 8, 8), accent, Math.cos(a) * 20, -4, Math.sin(a) * 20); }
      break;
    case 1: // lander
      add(new T.BoxGeometry(30, 16, 24), hull, 0, 4);
      add(new T.CylinderGeometry(8, 10, 10, 16), dark, 0, 16);
      add(new T.SphereGeometry(6, 16, 8), glass, 12, 8, 0);
      for (const [x, z] of [[-14, -14], [-14, 14], [14, -14], [14, 14]]) { add(new T.CylinderGeometry(1.4, 1.4, 20, 6), dark, x, -6, z, x > 0 ? -0.3 : 0.3, 0, z > 0 ? 0.3 : -0.3); add(new T.CylinderGeometry(4, 4, 1.5, 12), accent, x * 1.25, -15, z * 1.25); }
      add(new T.ConeGeometry(9, 6, 16, 1, true), dark, -10, 18, 0, 0, 0, 0.5);
      break;
    case 2: // kruiser X
      add(new T.CylinderGeometry(7, 9, 46, 16), hull, 0, 0, 0, 0, 0, Math.PI / 2);
      add(new T.SphereGeometry(7, 16, 10), glass, 22, 2, 0);
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * Math.PI / 2;
        const arm = add(new T.BoxGeometry(6, 3, 40), hull, -6, Math.sin(a) * 10, Math.cos(a) * 10, a);
        add(new T.CylinderGeometry(3, 3, 22, 10), dark, -8, Math.sin(a) * 22, Math.cos(a) * 22, 0, 0, Math.PI / 2);
        add(new T.SphereGeometry(2.6, 8, 8), accent, -20, Math.sin(a) * 22, Math.cos(a) * 22);
      }
      break;
    case 3: // pijl
      add(new T.ConeGeometry(10, 52, 4), hull, 6, 0, 0, 0, Math.PI / 4, -Math.PI / 2, 1, 1, 0.55);
      add(new T.BoxGeometry(22, 2, 50), hull, -12, -1, 0);
      add(new T.BoxGeometry(14, 3, 3), accent, -12, 0, 25); add(new T.BoxGeometry(14, 3, 3), accent, -12, 0, -25);
      add(new T.SphereGeometry(5, 12, 8), glass, 8, 4, 0, 0, 0, 0, 1.8, 0.7, 1);
      add(new T.BoxGeometry(10, 12, 2), dark, -18, 7, 0);
      break;
    case 4: // ringschip
      add(new T.TorusGeometry(26, 5, 12, 36), hull, 0, 0, 0, Math.PI / 2);
      add(new T.SphereGeometry(11, 20, 14), dark);
      add(new T.SphereGeometry(6, 16, 10), glass, 0, 7, 0);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; add(new T.BoxGeometry(22, 2.5, 2.5), hull, Math.cos(a) * 14, 0, Math.sin(a) * 14, 0, -a); add(new T.SphereGeometry(3.5, 10, 8), accent, Math.cos(a) * 26, 0, Math.sin(a) * 26); }
      break;
    default: { // manta
      const s = new T.Shape(); s.moveTo(32, 0); s.quadraticCurveTo(0, 10, -24, 34); s.lineTo(-14, 6); s.lineTo(-30, 0); s.lineTo(-14, -6); s.lineTo(-24, -34); s.quadraticCurveTo(0, -10, 32, 0);
      const geo = new T.ExtrudeGeometry(s, { depth: 5, bevelEnabled: true, bevelSize: 2, bevelThickness: 2, bevelSegments: 2 });
      add(geo, hull, 0, 2, 0, Math.PI / 2);
      add(new T.SphereGeometry(6, 14, 8), glass, 10, 5, 0, 0, 0, 0, 1.6, 0.6, 1);
      add(new T.BoxGeometry(4, 2, 50), accent, -16, 3, 0);
    }
  }
  g.scale.setScalar(scale);
  return g;
}
WP.buildShip = buildShip;

// shield shader
const shieldMat = (col) => new T.ShaderMaterial({
  uniforms: { c: { value: new T.Color(col) }, a: { value: 0.5 }, t: { value: 0 } },
  vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
  fragmentShader: 'uniform vec3 c; uniform float a; uniform float t; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0-abs(dot(vN,vV)),2.5); float s = 0.6+0.4*sin(t*4.0+vN.y*12.0); gl_FragColor = vec4(c, f*a*s); }',
  transparent: true, blending: T.AdditiveBlending, depthWrite: false,
});
const barrierMat = (col) => new T.ShaderMaterial({
  uniforms: { c: { value: new T.Color(col) }, t: { value: 0 }, a: { value: 0.55 } },
  vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 c; uniform float t; uniform float a; varying vec2 vU; void main(){ float y = 1.0-abs(vU.y-0.5)*2.0; float w = 0.5+0.5*sin(vU.x*240.0 - t*3.0 + sin(vU.y*20.0+t)*2.0); float w2 = 0.5+0.5*sin(vU.x*37.0 + t*1.7); float e = smoothstep(0.0,0.08,vU.x)*smoothstep(1.0,0.92,vU.x); gl_FragColor = vec4(c, a*e*pow(y,1.6)*(0.35+0.65*w*w2)); }',
  transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide,
});

// ---------- renderer ----------
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.r = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.r.outputEncoding = T.sRGBEncoding; this.r.toneMapping = T.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.15;
    this.scene = new T.Scene();
    this.cam = new T.PerspectiveCamera(50, 1, 10, 200000);
    this.tex = { glow: glowTex(), soft: glowTex('rgba(255,255,255,0.8)', 'rgba(255,255,255,0.15)'), ring: ringTex(), swirl: swirlTex() };
    this.planetObjs = new Map(); this.shipObjs = new Map(); this.projObjs = new Map(); this.droneObjs = new Map(); this.gateObjs = new Map();
    this.fx = []; this.texQueue = [];
    this.view = { mode: 'tactical', zoom: 2300, yaw: 0, pitch: 0.95, mapYaw: 0.3, mapPitch: 0.85, mapZoom: 27000, blend: 0, cx: 0, cz: 0, shake: 0 };
    this.time = 0;
    this.buildStatic();
    this.resize(); window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.w = w; this.h = h;
  }

  buildStatic() {
    const s = this.scene;
    s.add(new T.HemisphereLight(0x8899ff, 0x221122, 0.55));
    const sun = new T.DirectionalLight(0xfff2dd, 1.6); sun.position.set(-0.4, 1, 0.3); s.add(sun); this.sun = sun;
    s.add(new T.AmbientLight(0x303848, 0.6));
    // sterren
    const mkStars = (n, rad, size, col) => {
      const g = new T.BufferGeometry(), p = new Float32Array(n * 3), c = new Float32Array(n * 3);
      const rnd = WP.rng(n + rad);
      for (let i = 0; i < n; i++) {
        const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, rr = rad * (0.7 + rnd() * 0.3);
        p[i * 3] = Math.sqrt(1 - u * u) * Math.cos(a) * rr; p[i * 3 + 1] = u * rr; p[i * 3 + 2] = Math.sqrt(1 - u * u) * Math.sin(a) * rr;
        const t = rnd(); c[i * 3] = 0.7 + t * 0.3; c[i * 3 + 1] = 0.75 + rnd() * 0.25; c[i * 3 + 2] = 1;
      }
      g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('color', new T.BufferAttribute(c, 3));
      return new T.Points(g, new T.PointsMaterial({ size, map: this.tex.soft, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true }));
    };
    this.stars = new T.Group(); this.stars.add(mkStars(5000, 90000, 260, 0)); this.stars.add(mkStars(1500, 70000, 520, 0)); s.add(this.stars);
    // lokaal stof in het speelvlak (parallax)
    const dust = new T.BufferGeometry(), dp = new Float32Array(6000 * 3), rnd = WP.rng(5);
    for (let i = 0; i < 6000; i++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R * 1.3; dp[i * 3] = Math.cos(a) * r; dp[i * 3 + 1] = -200 - rnd() * 1800; dp[i * 3 + 2] = Math.sin(a) * r; }
    dust.setAttribute('position', new T.BufferAttribute(dp, 3));
    s.add(new T.Points(dust, new T.PointsMaterial({ size: 28, map: this.tex.soft, color: 0x8aa0ff, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending })));
    // melkwegschijf onder het speelvlak
    // Achtergrond: de aangeleverde spiraalmelkweg (M101), draait langzaam rond. Fallback: procedurele textuur.
    let gtex;
    if (window.WP_GALAXY) { const img = new Image(); gtex = new T.Texture(img); gtex.encoding = T.sRGBEncoding; img.onload = () => { gtex.needsUpdate = true; }; img.src = window.WP_GALAXY; }
    else gtex = galaxyTex();
    const disc = new T.Mesh(new T.PlaneGeometry(R * (window.WP_GALAXY ? 2.75 : 3.1), R * (window.WP_GALAXY ? 2.75 : 3.1)), new T.MeshBasicMaterial({ map: gtex, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = -2600; s.add(disc); this.disc = disc;
    const core = new T.Sprite(new T.SpriteMaterial({ map: this.tex.glow, color: 0xffe2b0, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false }));
    core.scale.set(5200, 5200, 1); core.position.y = -800; s.add(core);
    // nevels
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, r = 2000 + rnd() * R * 1.1;
      const sp = new T.Sprite(new T.SpriteMaterial({ map: this.tex.soft, color: new T.Color().setHSL(rnd() < 0.5 ? 0.62 + rnd() * 0.1 : 0.85 + rnd() * 0.1, 0.8, 0.5), transparent: true, opacity: 0.08 + rnd() * 0.08, blending: T.AdditiveBlending, depthWrite: false }));
      const sz = 3000 + rnd() * 6000; sp.scale.set(sz, sz, 1); sp.position.set(Math.cos(a) * r, -1200 - rnd() * 1500, Math.sin(a) * r); s.add(sp);
    }
    // grid ringen
    const gridMat = new T.LineBasicMaterial({ color: 0x2a3c6a, transparent: true, opacity: 0.35 });
    for (const rr of [WP.CORE_R, R * 0.33, R * 0.66, R]) {
      const pts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; pts.push(new T.Vector3(Math.cos(a) * rr, -2, Math.sin(a) * rr)); }
      s.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), gridMat));
    }
    this.octRim = new T.Group(); s.add(this.octRim);
    this.barriers = new T.Group(); s.add(this.barriers);
    this.world = new T.Group(); s.add(this.world);
    // doelmarker
    this.marker = new T.Mesh(new T.RingGeometry(26, 34, 32), new T.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.visible = false; s.add(this.marker);
    this.courseLine = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineDashedMaterial({ color: 0x7fd8ff, dashSize: 40, gapSize: 30, transparent: true, opacity: 0.5 }));
    this.courseLine.visible = false; s.add(this.courseLine);
    this.hoverRing = new T.Mesh(new T.RingGeometry(1, 1.06, 64), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: T.DoubleSide, depthWrite: false }));
    this.hoverRing.rotation.x = -Math.PI / 2; this.hoverRing.visible = false; s.add(this.hoverRing);
    // laser-bereik cirkel
    this.rangeRing = new T.Mesh(new T.RingGeometry(1, 1.004, 96), new T.MeshBasicMaterial({ color: 0xff7777, transparent: true, opacity: 0.25, side: T.DoubleSide, depthWrite: false }));
    this.rangeRing.rotation.x = -Math.PI / 2; this.rangeRing.visible = false; s.add(this.rangeRing);
  }

  setupGalaxy(state, settings) {
    // barrières
    this.barriers.clear(); this.octRim.clear();
    const col = settings.barrierDamage ? 0xff4040 : 0xffd84a;
    this.barrierMats = [];
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const m = barrierMat(col); this.barrierMats.push(m);
      const pl = new T.Mesh(new T.PlaneGeometry(R * 1.02, 420, 1, 1), m);
      pl.position.set(Math.cos(a) * R * 0.51, 0, Math.sin(a) * R * 0.51); pl.rotation.y = -a;
      this.barriers.add(pl);
      const ln = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(Math.cos(a) * R * 1.02, 0, Math.sin(a) * R * 1.02)]), new T.LineBasicMaterial({ color: col, transparent: true, opacity: 0.6 }));
      this.barriers.add(ln);
    }
    // octant-randen in de kleur van de eigenaar
    for (let o = 0; o < 8; o++) {
      const owner = state.players.find(p => p.octant === o);
      const c = owner ? WP.PATHS[owner.path].color : 0x445066;
      const geo = new T.RingGeometry(R * 1.02, R * 1.05, 24, 1, o * Math.PI / 4 + 0.01, Math.PI / 4 - 0.02);
      const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: c, transparent: true, opacity: owner ? 0.55 : 0.2, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
      m.rotation.x = Math.PI / 2; this.octRim.add(m);
    }
  }

  // ---------- objecten ----------
  planetObj(pl) {
    let o = this.planetObjs.get(pl.id);
    if (o) return o;
    o = { g: new T.Group() };
    const PH = { terran: 0x2a5aa0, ocean: 0x1f4f9a, jungle: 0x2f7a35, desert: 0xc08a50, ice: 0xc8dcf0, lava: 0x5a2a1a, gas: 0xd0b080, barren: 0x77736e };
    const mat = new T.MeshStandardMaterial({ color: PH[pl.type] || 0x777777, roughness: 0.85, metalness: 0.05 });
    o.mesh = new T.Mesh(new T.SphereGeometry(1, 48, 32), mat); o.mesh.scale.setScalar(pl.r); o.mesh.rotation.z = 0.3;
    o.g.add(o.mesh);
    o.atmo = new T.Sprite(new T.SpriteMaterial({ map: this.tex.glow, color: 0xffffff, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
    o.atmo.scale.setScalar(pl.r * 3.2); o.g.add(o.atmo);
    o.ring = new T.Mesh(new T.RingGeometry(pl.r * 1.32, pl.r * 1.42, 64), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
    o.ring.rotation.x = -Math.PI / 2; o.ring.position.y = -2; o.g.add(o.ring);
    if (pl.type === 'gas') {
      const rg = new T.Mesh(new T.RingGeometry(pl.r * 1.5, pl.r * 2.3, 64), new T.MeshBasicMaterial({ color: 0xd9c7a5, transparent: true, opacity: 0.35, side: T.DoubleSide, depthWrite: false }));
      rg.rotation.x = -Math.PI / 2 + 0.45; rg.rotation.y = 0.2; o.g.add(rg);
    }
    o.shield = new T.Mesh(new T.SphereGeometry(pl.r * 1.18, 32, 16), shieldMat(0x88ccff)); o.shield.material.uniforms.a.value = 0; o.g.add(o.shield);
    o.distress = new T.Mesh(new T.RingGeometry(pl.r * 1.6, pl.r * 1.75, 48), new T.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
    o.distress.rotation.x = -Math.PI / 2; o.g.add(o.distress);
    // plaag-deeltjes
    const pg = new T.BufferGeometry(), pp = new Float32Array(90 * 3); const rnd = WP.rng(pl.id);
    for (let i = 0; i < 90; i++) { const u = rnd() * 2 - 1, a = rnd() * 7, rr = pl.r * (1.05 + rnd() * 0.25); pp[i * 3] = Math.sqrt(1 - u * u) * Math.cos(a) * rr; pp[i * 3 + 1] = u * rr; pp[i * 3 + 2] = Math.sqrt(1 - u * u) * Math.sin(a) * rr; }
    pg.setAttribute('position', new T.BufferAttribute(pp, 3));
    o.plague = new T.Points(pg, new T.PointsMaterial({ size: 16, map: this.tex.glow, color: 0x9dff3d, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    o.g.add(o.plague);
    o.g.position.set(pl.x, 0, pl.z);
    this.world.add(o.g);
    this.planetObjs.set(pl.id, o);
    this.texQueue.push({ o, pl });
    return o;
  }

  shipObj(p) {
    let o = this.shipObjs.get(p.id);
    if (o && o.design === p.design && o.path === p.path) return o;
    if (o) { this.world.remove(o.g); }
    o = { g: new T.Group(), design: p.design, path: p.path, rx: p.x, rz: p.z, ry: 0 };
    o.model = buildShip(p.design, WP.PATHS[p.path].color, 1.7); o.g.add(o.model);
    o.engine = new T.Sprite(new T.SpriteMaterial({ map: this.tex.glow, color: 0x66bbff, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false }));
    o.engine.scale.setScalar(40); o.g.add(o.engine);
    o.halo = new T.Sprite(new T.SpriteMaterial({ map: this.tex.glow, color: WP.PATHS[p.path].color, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false }));
    o.halo.scale.setScalar(150); o.g.add(o.halo);
    o.shield = new T.Mesh(new T.SphereGeometry(72, 32, 16), shieldMat(0x66ddff)); o.g.add(o.shield);
    o.beam = new T.Mesh(new T.CylinderGeometry(6, 14, 1, 12, 1, true), new T.MeshBasicMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    o.beam.visible = false; this.world.add(o.beam);
    this.world.add(o.g); this.shipObjs.set(p.id, o);
    return o;
  }

  addFx(f) { this.fx.push(f); this.scene.add(f.obj); }
  boom(x, z, blast, dmg, type) {
    const big = Math.min(1, Math.log10(dmg + 10) / 5.5);
    const col = type === 'plague' ? 0x9dff3d : type === 'spy' ? 0x66aaff : type === 'raiders' ? 0xffaa33 : type === 'neutron' ? 0xb0c8ff : type === 'buster' ? 0xffffff : type === 'laser' ? 0xff8866 : 0xffaa55;
    const sz = Math.max(80, blast * 2.6) * (0.7 + big);
    const fl = new T.Sprite(new T.SpriteMaterial({ map: this.tex.glow, color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    fl.position.set(x, 20, z); fl.scale.setScalar(sz * 0.3);
    this.addFx({ obj: fl, t: 0, life: 0.6 + big * 0.6, up: (f, k) => { fl.scale.setScalar(sz * (0.3 + k * 1.1)); fl.material.opacity = 1 - k; } });
    const ring = new T.Mesh(new T.RingGeometry(0.8, 1, 48), new T.MeshBasicMaterial({ map: null, color: col, transparent: true, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 5, z);
    this.addFx({ obj: ring, t: 0, life: 0.7 + big, up: (f, k) => { ring.scale.setScalar(sz * 0.2 + k * sz * 1.4); ring.material.opacity = (1 - k) * 0.8; } });
    // deeltjes
    const n = 20 + Math.floor(big * 60), g = new T.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) { const a = Math.random() * 7, u = Math.random() * 2 - 1, s = (0.4 + Math.random()) * sz * 1.2; vel.push([Math.sqrt(1 - u * u) * Math.cos(a) * s, u * s * 0.5, Math.sqrt(1 - u * u) * Math.sin(a) * s]); pos[i * 3] = x; pos[i * 3 + 1] = 20; pos[i * 3 + 2] = z; }
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pts = new T.Points(g, new T.PointsMaterial({ size: 18 + big * 30, map: this.tex.glow, color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    this.addFx({ obj: pts, t: 0, life: 1.1, up: (f, k, dt) => { const a = g.attributes.position.array; for (let i = 0; i < n; i++) { a[i * 3] += vel[i][0] * dt; a[i * 3 + 1] += vel[i][1] * dt; a[i * 3 + 2] += vel[i][2] * dt; vel[i][0] *= 0.96; vel[i][2] *= 0.96; } g.attributes.position.needsUpdate = true; pts.material.opacity = 1 - k; } });
  }
  beam(x1, z1, x2, z2, path, thin) {
    const col = path === 'red' ? 0xff5050 : path === 'green' ? 0x50ff90 : 0xffcc66;
    const g = new T.BufferGeometry().setFromPoints([new T.Vector3(x1, 12, z1), new T.Vector3(x2, 12, z2)]);
    const l = new T.Line(g, new T.LineBasicMaterial({ color: col, transparent: true, blending: T.AdditiveBlending, linewidth: 2 }));
    this.addFx({ obj: l, t: 0, life: thin ? 0.12 : 0.25, up: (f, k) => { l.material.opacity = 1 - k; } });
    // brede gloed rond de straal
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new T.Mesh(new T.PlaneGeometry(len, thin ? 8 : 20), new T.MeshBasicMaterial({ map: this.tex.soft, color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(z2 - z1, x2 - x1); m.position.set((x1 + x2) / 2, 12, (z1 + z2) / 2);
    this.addFx({ obj: m, t: 0, life: thin ? 0.12 : 0.25, up: (f, k) => { m.material.opacity = 1 - k; } });
  }
  warpFx(x, z, small) {
    const c = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 32, 1, true), new T.MeshBasicMaterial({ color: 0x99bbff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    c.position.set(x, 0, z); const s = small ? 40 : 120;
    this.addFx({ obj: c, t: 0, life: 0.6, up: (f, k) => { c.scale.set(s * (1 - k * 0.8), 800 * (1 - k), s * (1 - k * 0.8)); c.material.opacity = 1 - k; } });
  }
  pulse(x, z, r, col) {
    const ring = new T.Mesh(new T.RingGeometry(0.97, 1, 96), new T.MeshBasicMaterial({ color: col, transparent: true, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 5, z);
    this.addFx({ obj: ring, t: 0, life: 1.2, up: (f, k) => { ring.scale.setScalar(20 + k * r); ring.material.opacity = 1 - k; } });
  }
  shake(a) { this.view.shake = Math.max(this.view.shake, a); }

  // ---------- frame ----------
  frame(state, me, dt, opt) {
    this.time += dt;
    const V = this.view;
    const t = this.time;
    // textures geleidelijk genereren
    for (let i = 0; i < 3 && this.texQueue.length; i++) {
      // dichtstbijzijnde eerst
      let bi = 0, bd = 1e18;
      for (let j = 0; j < this.texQueue.length; j++) { const q = this.texQueue[j].pl; const d = (q.x - V.cx) ** 2 + (q.z - V.cz) ** 2; if (d < bd) { bd = d; bi = j; } }
      const { o, pl } = this.texQueue.splice(bi, 1)[0];
      o.mesh.material.map = planetTexture(pl.type, pl.tex); o.mesh.material.color.set(0xffffff); o.mesh.material.needsUpdate = true;
    }
    // melkweg draait (tegen de klok in, zoals het voorbeeld); in het menu sneller
    this.disc.rotation.z += dt * (opt.menu ? 0.035 : 0.004);
    this.disc.material.opacity = window.WP_GALAXY ? 0.2 + V.blend * 0.75 : 0.85;
    if (this.barrierMats) for (const m of this.barrierMats) { m.uniforms.t.value = t; m.uniforms.a.value = 0.55 * (1 - V.blend * 0.5); }
    const myPath = me ? me.path : null;
    const mapScale = 1 + V.blend * 1.8;
    // planeten
    for (const pl of state.planets) {
      const o = this.planetObj(pl);
      const known = !me || opt.known(pl.id);
      const aura = known ? WP.calc.aura(pl) : 'unknown';
      const c = AURA_COL[aura];
      o.atmo.material.color.setHex(c); o.ring.material.color.setHex(c);
      o.atmo.material.opacity = aura === 'white' ? 0.25 : aura === 'unknown' ? 0.18 : 0.5 + V.blend * 0.4;
      o.ring.material.opacity = (aura === 'unknown' ? 0.25 : 0.7) * (1 - V.blend * 0.3);
      o.mesh.rotation.y += dt * 0.05;
      o.g.scale.setScalar(mapScale);
      const dim = pl.pop <= 0 ? 0.55 : 1;
      if (o.mesh.material.map) o.mesh.material.color.setScalar(dim);
      o.plague.material.opacity = known ? Math.min(1, pl.plague * 1.5) : 0; o.plague.rotation.y += dt * 0.3;
      if (pl.distress && known) { const k = (t * 1.5) % 1; o.distress.material.opacity = (1 - k) * 0.9; o.distress.scale.setScalar(1 + k * 0.6); } else o.distress.material.opacity = 0;
      const su = o.shield.material.uniforms; su.t.value = t; su.a.value = Math.max(0, su.a.value - dt * 1.2);
    }
    // schepen
    const seen = new Set();
    for (const p of state.players) {
      const vis = p.alive && !(p.respawn > 0) && opt.shipVisible(p);
      let o = this.shipObjs.get(p.id);
      if (!vis) { if (o) { o.g.visible = false; o.beam.visible = false; } continue; }
      o = this.shipObj(p); o.g.visible = true; seen.add(p.id);
      // vloeiende positie
      const k = Math.min(1, dt * (opt.client ? 10 : 30));
      if (Math.abs(o.rx - p.x) > 1500 || Math.abs(o.rz - p.z) > 1500) { o.rx = p.x; o.rz = p.z; }
      o.rx += (p.ex - o.rx) * k; o.rz += (p.ez - o.rz) * k;
      o.g.position.set(o.rx, 0, o.rz);
      const yaw = -Math.atan2(p.hz, p.hx);
      let dy = yaw - o.ry; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      o.ry += dy * Math.min(1, dt * 8); o.model.rotation.y = o.ry;
      o.model.rotation.x = Math.sin(t * 1.3 + p.octant) * 0.06; o.model.position.y = Math.sin(t * 2 + p.octant) * 4;
      const sp = p.orbit ? 2 : p.speed;
      o.engine.position.set(-Math.cos(-o.ry) * 46, 2, -Math.sin(-o.ry) * 46);
      o.engine.scale.setScalar(20 + sp * 9); o.engine.material.opacity = sp > 0 ? 0.9 : 0.25;
      o.engine.material.color.setHex(p.speed > WP.calc.freeSpeed(p) ? 0xffaa55 : 0x66bbff);
      o.g.scale.setScalar(1 + V.blend * 4);
      o.halo.material.opacity = 0.25 + V.blend * 0.6;
      const stealthy = p.stealth || p.stealthT > 0;
      o.model.traverse(m => { if (m.material) { m.material.transparent = stealthy; m.material.opacity = stealthy ? 0.25 + Math.sin(t * 10) * 0.1 : 1; } });
      const shOn = p.shieldsOn && (p.items.shield || 0) > 0 && !p.stealth && !p.mining && !(p.stealthT > 0);
      const su = o.shield.material.uniforms; su.t.value = t;
      su.a.value = Math.max(shOn ? 0.18 + Math.min(5, p.items.shield) * 0.05 : 0, su.a.value - dt * 1.5);
      if (p.scream) { su.c.value.setHex(0xff66ff); } else su.c.value.setHex(0x66ddff);
      // mijnstraal
      if (p.mining && p.orbit) {
        const pl = state.planets.find(q => q.id === p.orbit);
        if (pl) {
          const dx = pl.x - o.rx, dz = pl.z - o.rz, d = Math.hypot(dx, dz) - pl.r * 0.9;
          o.beam.visible = true; o.beam.scale.set(1, d, 1); o.beam.position.set(o.rx + dx / Math.hypot(dx, dz) * d / 2, 0, o.rz + dz / Math.hypot(dx, dz) * d / 2);
          o.beam.rotation.set(0, 0, 0); o.beam.rotation.z = Math.PI / 2; o.beam.rotation.y = -Math.atan2(dz, dx);
          o.beam.material.opacity = 0.35 + Math.sin(t * 20) * 0.15;
        }
      } else o.beam.visible = false;
    }
    for (const [id, o] of this.shipObjs) if (!seen.has(id)) { o.g.visible = false; o.beam.visible = false; }
    // projectielen
    const projCol = { torpedo: 0xffb050, mine: 0xff4040, plasma: 0xff60ff, neutron: 0xa0c0ff, seeker: 0xffff60, plague: 0x9dff3d, spy: 0x66aaff, raiders: 0xffaa33, buster: 0xffffff };
    const pseen = new Set();
    for (const m of state.projs) {
      pseen.add(m.id);
      let o = this.projObjs.get(m.id);
      if (!o) {
        const col = projCol[m.type] || 0xffffff;
        const s = new T.Sprite(new T.SpriteMaterial({ map: this.tex.glow, color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
        s.scale.setScalar(m.type === 'buster' || m.type === 'neutron' ? 90 : 55);
        const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(new Float32Array(12 * 3), 3));
        const tr = new T.Line(tg, new T.LineBasicMaterial({ color: col, transparent: true, opacity: 0.6, blending: T.AdditiveBlending }));
        o = { s, tr, hist: [], rx: m.x, rz: m.z }; this.world.add(s); this.world.add(tr); this.projObjs.set(m.id, o);
        if (m.type === 'mine') { o.ring = new T.Mesh(new T.RingGeometry(70, 75, 32), new T.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.0, side: T.DoubleSide, depthWrite: false })); o.ring.rotation.x = -Math.PI / 2; this.world.add(o.ring); }
      }
      o.rx += (m.ex - o.rx) * Math.min(1, dt * 20); o.rz += (m.ez - o.rz) * Math.min(1, dt * 20);
      o.s.position.set(o.rx, 14, o.rz);
      if (m.armed) { o.s.material.opacity = 0.5 + 0.5 * Math.sin(t * 8 + m.id); if (o.ring) { o.ring.position.set(o.rx, 2, o.rz); o.ring.material.opacity = 0.25 + 0.15 * Math.sin(t * 8); } }
      o.hist.push(o.rx, 14, o.rz); if (o.hist.length > 36) o.hist.splice(0, 3);
      const a = o.tr.geometry.attributes.position.array; for (let i = 0; i < 36; i++) a[i] = o.hist[Math.min(i, o.hist.length - 1)] ?? 0;
      if (o.hist.length < 36) for (let i = o.hist.length; i < 36; i += 3) { a[i] = o.rx; a[i + 1] = 14; a[i + 2] = o.rz; }
      o.tr.geometry.attributes.position.needsUpdate = true; o.tr.visible = !m.armed;
    }
    for (const [id, o] of this.projObjs) if (!pseen.has(id)) { this.world.remove(o.s); this.world.remove(o.tr); if (o.ring) this.world.remove(o.ring); this.projObjs.delete(id); }
    // drones
    const dseen = new Set();
    for (const d of state.drones) {
      dseen.add(d.id);
      let o = this.droneObjs.get(d.id);
      if (!o) {
        const col = WP.PATHS[d.path].color;
        const g = new T.Group();
        const mesh = new T.Mesh(d.kind === 'slave' ? new T.TetrahedronGeometry(16) : new T.OctahedronGeometry(14), new T.MeshStandardMaterial({ color: d.kind === 'slave' ? 0xc0c8d8 : 0x333844, emissive: col, emissiveIntensity: d.kind === 'slave' ? 0.3 : 0.8, metalness: 0.7, roughness: 0.3 }));
        g.add(mesh);
        const gl = new T.Sprite(new T.SpriteMaterial({ map: this.tex.glow, color: col, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false })); gl.scale.setScalar(70); g.add(gl);
        o = { g, mesh, rx: d.x, rz: d.z }; this.world.add(g); this.droneObjs.set(d.id, o);
      }
      o.rx += (d.ex - o.rx) * Math.min(1, dt * 15); o.rz += (d.ez - o.rz) * Math.min(1, dt * 15);
      o.g.position.set(o.rx, 10, o.rz); o.mesh.rotation.y += dt * 3; o.mesh.rotation.x += dt * 2;
      o.g.scale.setScalar(1 + V.blend * 4);
    }
    for (const [id, o] of this.droneObjs) if (!dseen.has(id)) { this.world.remove(o.g); this.droneObjs.delete(id); }
    // wormgates
    for (const gt of state.gates) {
      let o = this.gateObjs.get(gt.id);
      if (!o) {
        o = { ends: [] };
        for (const [x, z] of [[gt.ax, gt.az], [gt.bx, gt.bz]]) {
          const g = new T.Group();
          const sw = new T.Mesh(new T.CircleGeometry(70, 48), new T.MeshBasicMaterial({ map: this.tex.swirl, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
          sw.rotation.x = -Math.PI / 2; g.add(sw);
          const tor = new T.Mesh(new T.TorusGeometry(72, 4, 8, 48), new T.MeshStandardMaterial({ color: 0x8866ff, emissive: 0x5533ff, emissiveIntensity: 1 }));
          tor.rotation.x = Math.PI / 2; g.add(tor);
          g.position.set(x, 4, z); this.world.add(g); o.ends.push({ g, sw });
        }
        this.gateObjs.set(gt.id, o);
      }
      for (const e of o.ends) { e.sw.rotation.z -= dt * 2; e.g.scale.setScalar(1 + V.blend * 3); }
    }
    // effecten
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.t += dt; const k = Math.min(1, f.t / f.life);
      f.up(f, k, dt);
      if (k >= 1) { this.scene.remove(f.obj); f.obj.geometry?.dispose(); f.obj.material?.dispose(); this.fx.splice(i, 1); }
    }
    // doel & hover
    if (me && me.tx != null && !me.orbit && me.alive) {
      this.marker.visible = true; this.marker.position.set(me.tx, 3, me.tz); this.marker.rotation.z = t; this.marker.scale.setScalar(1 + V.blend * 5);
      this.courseLine.visible = true;
      const so = this.shipObjs.get(me.id);
      const a = this.courseLine.geometry.attributes.position.array; a[0] = so ? so.rx : me.x; a[1] = 3; a[2] = so ? so.rz : me.z; a[3] = me.tx; a[4] = 3; a[5] = me.tz;
      this.courseLine.geometry.attributes.position.needsUpdate = true; this.courseLine.computeLineDistances();
    } else { this.marker.visible = false; this.courseLine.visible = false; }
    if (opt.hover) {
      this.hoverRing.visible = true; this.hoverRing.position.set(opt.hover.x, 4, opt.hover.z); this.hoverRing.scale.setScalar(opt.hover.r * mapScale);
      this.hoverRing.material.color.setHex(opt.hover.col || 0xffffff);
    } else this.hoverRing.visible = false;
    if (opt.range && me) { const so = this.shipObjs.get(me.id); this.rangeRing.visible = !!so && V.blend < 0.3; if (so) { this.rangeRing.position.set(so.rx, 3, so.rz); this.rangeRing.scale.setScalar(opt.range); } } else this.rangeRing.visible = false;

    // camera
    const target = V.mode === 'map' ? 1 : 0;
    V.blend += (target - V.blend) * Math.min(1, dt * 4);
    const so = opt.camId != null ? this.shipObjs.get(opt.camId) : null;
    if (so && so.g.visible) { V.cx += (so.rx - V.cx) * Math.min(1, dt * 6); V.cz += (so.rz - V.cz) * Math.min(1, dt * 6); }
    else if (opt.follow) { V.cx += (opt.follow.x - V.cx) * Math.min(1, dt * 3); V.cz += (opt.follow.z - V.cz) * Math.min(1, dt * 3); }
    if (opt.menu) { V.mapYaw += dt * 0.03; }
    const b = V.blend;
    const tx = V.cx * (1 - b), tz = V.cz * (1 - b);
    const dist = V.zoom * (1 - b) + V.mapZoom * b;
    const pitch = V.pitch * (1 - b) + V.mapPitch * b;
    const yaw = V.yaw * (1 - b) + V.mapYaw * b;
    let sx = 0, sz = 0;
    if (V.shake > 0) { sx = (Math.random() - 0.5) * V.shake * 120; sz = (Math.random() - 0.5) * V.shake * 120; V.shake = Math.max(0, V.shake - dt * 1.5); }
    this.cam.position.set(tx + Math.sin(yaw) * Math.cos(pitch) * dist + sx, Math.sin(pitch) * dist, tz + Math.cos(yaw) * Math.cos(pitch) * dist + sz);
    this.cam.lookAt(tx, 0, tz);
    this.cam.far = Math.max(200000, dist * 8); this.cam.updateProjectionMatrix();
    this.stars.position.copy(this.cam.position);
    if (!WP.NORENDER) this.r.render(this.scene, this.cam);
  }

  // scherm → speelvlak (y=0)
  ground(sx, sy) {
    const v = new T.Vector3((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1, 0.5).unproject(this.cam);
    const dir = v.sub(this.cam.position).normalize();
    if (Math.abs(dir.y) < 1e-4) return null;
    const k = -this.cam.position.y / dir.y; if (k < 0) return null;
    return { x: this.cam.position.x + dir.x * k, z: this.cam.position.z + dir.z * k };
  }
  project(x, y, z) {
    const v = new T.Vector3(x, y, z).project(this.cam);
    return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h, vis: v.z < 1 && v.z > -1 };
  }
  flashShield(id) { const o = this.shipObjs.get(id); if (o) o.shield.material.uniforms.a.value = 0.9; }
  flashPlanetShield(pl) { const o = this.planetObjs.get(pl.id); if (o) o.shield.material.uniforms.a.value = 0.8; }
  clearWorld() {
    for (const m of [this.planetObjs, this.shipObjs, this.projObjs, this.droneObjs, this.gateObjs]) m.clear();
    this.world.clear(); this.texQueue = [];
    for (const f of this.fx) this.scene.remove(f.obj); this.fx = [];
  }
}
WP.Renderer = Renderer;
WP.planetTexture = planetTexture;
})();
