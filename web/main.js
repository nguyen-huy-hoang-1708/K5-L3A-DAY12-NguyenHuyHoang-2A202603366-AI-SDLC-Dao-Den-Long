// 3D client — tiên hiệp / kiếm hiệp style presentation of the shared deterministic sim (src/sim.js).
// Everything here is presentation only — it never changes game rules, so headless output is unaffected.
import * as THREE from 'three';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';
import { createGame, step, TUNING, TICK_RATE, timeLeft } from '../src/sim.js';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const SPEED = Math.max(1, Math.min(8, Number(params.get('speed') || 1))); // debug/playtest only: sim steps per real tick
const R = TUNING.island_radius;
const TAU = Math.PI * 2;
// Visual-only RNG (fixed seed so the scenery is the same every load; never used by game rules).
let vs = 1234567;
const vrand = () => ((vs = (vs * 16807) % 2147483647) / 2147483647);

// ---------- renderer / post ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const FOG_NIGHT = new THREE.Color('#3a1c48');
const FOG_DAWN = new THREE.Color('#7a4a6a');
scene.fog = new THREE.FogExp2(FOG_NIGHT.clone(), 0.0065);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.55, 0.72);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- procedural textures ----------
function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glowTex = canvasTex(128, (x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,.65)');
  g.addColorStop(0.5, 'rgba(255,255,255,.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
});
// Magic circle (trận pháp): concentric rings, eight trigram-like bar groups, ticks, octagram.
const runeTex = canvasTex(512, (x, s) => {
  const c = s / 2;
  x.translate(c, c);
  x.strokeStyle = '#ffe3a0';
  x.fillStyle = '#ffe3a0';
  x.shadowColor = '#ffb347';
  x.shadowBlur = 10;
  const ring = (r, w) => { x.lineWidth = w; x.beginPath(); x.arc(0, 0, r * c, 0, TAU); x.stroke(); };
  ring(0.97, 5); ring(0.9, 2.5); ring(0.62, 3); ring(0.55, 1.5); ring(0.18, 3);
  for (let i = 0; i < 72; i++) {
    x.save(); x.rotate((i * TAU) / 72); x.lineWidth = i % 9 === 0 ? 4 : 1.5;
    x.beginPath(); x.moveTo(0.9 * c, 0); x.lineTo((i % 9 === 0 ? 0.8 : 0.86) * c, 0); x.stroke(); x.restore();
  }
  for (let i = 0; i < 8; i++) {
    x.save(); x.rotate((i * TAU) / 8);
    for (let b = 0; b < 3; b++) {
      const y = -(0.68 + b * 0.065) * c;
      const broken = (i >> b) & 1;
      if (broken) { x.fillRect(-0.11 * c, y, 0.085 * c, 0.035 * c); x.fillRect(0.025 * c, y, 0.085 * c, 0.035 * c); }
      else x.fillRect(-0.11 * c, y, 0.22 * c, 0.035 * c);
    }
    x.restore();
  }
  x.lineWidth = 2.5;
  for (const rot of [0, Math.PI / 4]) {
    x.save(); x.rotate(rot); x.strokeRect(-0.38 * c, -0.38 * c, 0.76 * c, 0.76 * c); x.restore();
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8 + TAU / 16;
    x.beginPath(); x.arc(Math.cos(a) * 0.45 * c, Math.sin(a) * 0.45 * c, 0.035 * c, 0, TAU); x.fill();
  }
});
const cloudTex = canvasTex(512, (x, s) => {
  for (let i = 0; i < 140; i++) {
    const px = vrand() * s, py = vrand() * s, r = 20 + vrand() * 70;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(255,255,255,${0.12 + vrand() * 0.18})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { x.save(); x.translate(ox, oy); x.fillRect(px - r, py - r, 2 * r, 2 * r); x.restore(); }
  }
});
const petalTex = canvasTex(64, (x, s) => {
  x.translate(s / 2, s / 2); x.rotate(0.6);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, s / 2);
  g.addColorStop(0, 'rgba(255,230,240,1)'); g.addColorStop(1, 'rgba(255,150,190,0.9)');
  x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, s * 0.42, s * 0.22, 0, 0, TAU); x.fill();
});

// ---------- sky ----------
const skyUni = {
  top: { value: new THREE.Color('#05030f') },
  mid: { value: new THREE.Color('#1e0c3a') },
  hor: { value: new THREE.Color('#6a2a5c') },
  k: { value: 0 },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(600, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUni,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, hor; uniform float k; varying vec3 vP;
      void main(){ float h = vP.y;
        vec3 warm = vec3(0.95, 0.45, 0.25);
        vec3 hz = mix(hor, warm, k * 0.55);
        vec3 c = mix(hz, mid, smoothstep(-0.05, 0.22, h));
        c = mix(c, top, smoothstep(0.22, 0.8, h));
        gl_FragColor = vec4(c, 1.0); }`,
  }),
);
scene.add(sky);
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(1600 * 3);
for (let i = 0; i < 1600; i++) {
  const u = vrand() * TAU, cy = 0.08 + vrand() * 0.92;
  const r = 560, sy = Math.sqrt(1 - cy * cy);
  starPos.set([r * sy * Math.cos(u), r * cy, r * sy * Math.sin(u)], i * 3);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#fff4dd', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 }));
scene.add(stars);
const MOON_DIR = new THREE.Vector3(-0.45, 0.42, -0.79).normalize();
const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff6dc', fog: false, depthWrite: false }));
moon.scale.setScalar(70);
const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#b59cff', fog: false, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
moonHalo.scale.setScalar(260);
scene.add(moonHalo, moon);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#7a68c0', '#2a1430', 0.9);
scene.add(hemi);
const moonLight = new THREE.DirectionalLight('#b8c4ff', 1.1);
moonLight.position.copy(MOON_DIR).multiplyScalar(80);
scene.add(moonLight);

// ---------- distant peaks rising from the sea of clouds ----------
function jagged(geo, amt) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < geo.parameters.height / 2 - 0.01) {
      p.setX(i, p.getX(i) * (1 + (vrand() - 0.5) * amt));
      p.setZ(i, p.getZ(i) * (1 + (vrand() - 0.5) * amt));
      p.setY(i, y + (vrand() - 0.5) * amt * 6);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
const peaks = new THREE.Group();
for (let i = 0; i < 46; i++) {
  const a = (i / 46) * TAU + vrand() * 0.1;
  const dist = 120 + vrand() * 170;
  const h = 50 + vrand() * 120;
  const geo = jagged(new THREE.ConeGeometry(10 + vrand() * 16, h, 6, 4), 0.35);
  const shade = THREE.MathUtils.clamp((dist - 120) / 170, 0, 1);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#150a24').lerp(new THREE.Color('#3b2350'), shade) }));
  m.position.set(Math.cos(a) * dist, -30 + h / 2, Math.sin(a) * dist);
  m.rotation.y = vrand() * TAU;
  peaks.add(m);
}
scene.add(peaks);
// Floating islets with a pine on top.
const pineMat = new THREE.MeshStandardMaterial({ color: '#1d3a34', roughness: 0.9, flatShading: true });
const rockMat = new THREE.MeshStandardMaterial({ color: '#3a2c48', roughness: 1, flatShading: true });
const islets = [];
for (let i = 0; i < 7; i++) {
  const g = new THREE.Group();
  const s = 2 + vrand() * 4;
  const base = new THREE.Mesh(jagged(new THREE.ConeGeometry(s, s * 2.4, 7, 3), 0.25), rockMat);
  base.rotation.x = Math.PI;
  const top = new THREE.Mesh(new THREE.ConeGeometry(s * 0.35, s * 1.3, 6), pineMat);
  top.position.y = s * 1.85;
  base.position.y = s * 1.15;
  g.add(base, top);
  const a = vrand() * TAU, d = 60 + vrand() * 45;
  g.position.set(Math.cos(a) * d, 4 + vrand() * 22, Math.sin(a) * d);
  g.userData = { y0: g.position.y, ph: vrand() * TAU };
  islets.push(g);
  scene.add(g);
}

// ---------- sea of clouds ----------
const cloudLayers = [];
for (const [y, op, col, sc] of [[-9, 0.55, '#7a5aa0', 5], [-15, 0.6, '#4e2f6e', 3.5], [-24, 0.85, '#2c1745', 2.5]]) {
  const map = cloudTex.clone();
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(sc, sc);
  map.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map, color: col, transparent: true, opacity: op, depthWrite: false });
  const m = new THREE.Mesh(new THREE.CircleGeometry(520, 48), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  cloudLayers.push(m);
  scene.add(m);
}

// ---------- the floating island ----------
const island = new THREE.Group();
const groundGeo = new THREE.RingGeometry(0.01, R + 0.8, 128, 36);
{
  const p = groundGeo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const stone = new THREE.Color('#5a5470'), grass = new THREE.Color('#25463a'), grass2 = new THREE.Color('#33573f'), moss = new THREE.Color('#4a6a4a'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y);
    const n = Math.sin(x * 0.7) * Math.cos(y * 0.6) * 0.5 + Math.sin(x * 0.23 + y * 0.31) * 0.5;
    if (r < 4.6) c.copy(stone).offsetHSL(0, 0, (Math.abs(Math.floor(x * 1.2) + Math.floor(y * 1.2)) % 2) * 0.03);
    else if (r < 5.2) c.set('#8a7a5a');
    else c.copy(grass).lerp(grass2, 0.5 + n * 0.5).lerp(moss, THREE.MathUtils.smoothstep(r, R - 4, R));
    col.set([c.r, c.g, c.b], i * 3);
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2;
island.add(ground);
const rim = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.8, R + 0.2, 2, 96, 1, true), rockMat);
rim.position.y = -1;
island.add(rim);
const under = new THREE.Mesh(jagged(new THREE.ConeGeometry(R + 0.2, 38, 40, 8, true), 0.22), rockMat);
under.rotation.x = Math.PI;
under.position.y = -2 - 19;
island.add(under);
for (let i = 0; i < 9; i++) {
  const s = 2 + vrand() * 3.5;
  const m = new THREE.Mesh(jagged(new THREE.ConeGeometry(s, s * 4, 6, 3), 0.3), rockMat);
  m.rotation.x = Math.PI;
  const a = vrand() * TAU, d = R * (0.45 + vrand() * 0.45);
  m.position.set(Math.cos(a) * d, -6 - s * 2 - vrand() * 6, Math.sin(a) * d);
  island.add(m);
}
// Stone balustrade along the edge (shows the island boundary that the player cannot cross).
const stoneMat = new THREE.MeshStandardMaterial({ color: '#7c7490', roughness: 0.8 });
const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), stoneMat, 72);
const dummy = new THREE.Object3D();
for (let i = 0; i < 72; i++) {
  const a = (i / 72) * TAU;
  dummy.position.set(Math.cos(a) * (R + 0.4), 0.5, Math.sin(a) * (R + 0.4));
  dummy.rotation.y = -a;
  dummy.updateMatrix();
  posts.setMatrixAt(i, dummy.matrix);
}
island.add(posts);
const rail = new THREE.Mesh(new THREE.TorusGeometry(R + 0.4, 0.1, 6, 160), new THREE.MeshStandardMaterial({ color: '#b03a2e', roughness: 0.5 }));
rail.rotation.x = Math.PI / 2;
rail.position.y = 0.95;
island.add(rail);
scene.add(island);

// Central altar: rotating magic circle.
const altar = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffcf7a' }));
altar.rotation.x = -Math.PI / 2;
altar.position.y = 0.03;
scene.add(altar);

// ---------- scenery: pagodas, pines, cherry trees, rocks (outside the play ring) ----------
const lacquer = new THREE.MeshStandardMaterial({ color: '#9e2a22', roughness: 0.5 });
const roofMat = new THREE.MeshStandardMaterial({ color: '#2a3a4a', roughness: 0.6, flatShading: true });
const goldMat = new THREE.MeshStandardMaterial({ color: '#e8b04a', metalness: 0.8, roughness: 0.3, emissive: '#5a3500', emissiveIntensity: 0.4 });
function roof(w, h) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 4, 1), roofMat);
  m.rotation.y = Math.PI / 4;
  return m;
}
function makePagoda(levels = 4) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.6, 4.2), stoneMat);
  base.position.y = 0.3;
  g.add(base);
  let y = 0.6;
  for (let i = 0; i < levels; i++) {
    const w = 2.6 - i * 0.42;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 1.3, w), lacquer);
    body.position.y = y + 0.65;
    const r = roof(w * 1.05, 0.9);
    r.position.y = y + 1.75;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.4, 0.5), new THREE.MeshBasicMaterial({ color: '#ffc46b' }));
    win.position.set(0, y + 0.7, w / 2 + 0.01);
    g.add(body, r, win);
    y += 1.55;
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.6, 6), goldMat);
  spire.position.y = y + 0.9;
  g.add(spire);
  return g;
}
function makePine(s) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.25 * s, 1.6 * s, 6), new THREE.MeshStandardMaterial({ color: '#3a2618' }));
  trunk.position.y = 0.8 * s;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry((1.6 - i * 0.4) * s, 1.6 * s, 7), pineMat);
    c.position.y = (1.6 + i * 0.9) * s;
    g.add(c);
  }
  return g;
}
const blossomMat = new THREE.MeshStandardMaterial({ color: '#f29ac0', emissive: '#7a2a50', emissiveIntensity: 0.35, roughness: 0.8, flatShading: true });
function makeBlossom(s) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.28 * s, 2.4 * s, 6), new THREE.MeshStandardMaterial({ color: '#2e1a1a' }));
  trunk.position.y = 1.2 * s;
  trunk.rotation.z = 0.15;
  g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry((0.9 + vrand() * 0.5) * s, 0), blossomMat);
    b.position.set((vrand() - 0.5) * 2 * s, (2.5 + vrand() * 1.1) * s, (vrand() - 0.5) * 2 * s);
    g.add(b);
  }
  return g;
}
const lanternAngle = (i) => (i * TAU) / TUNING.lantern_count_night1;
for (let gap = 0; gap < 5; gap++) {
  const a = lanternAngle(gap) + TAU / 10; // between lantern spokes
  const place = (obj, r, da = 0) => { obj.position.set(Math.sin(a + da) * r, obj.position.y, Math.cos(a + da) * r); obj.rotation.y = a + da + Math.PI; scene.add(obj); };
  if (gap % 2 === 0) place(makePagoda(3 + (gap % 3)), 35);
  else place(makeBlossom(1.4), 34);
  place(makePine(1 + vrand() * 0.5), 31 + vrand() * 6, 0.28);
  place(makeBlossom(1 + vrand() * 0.4), 31 + vrand() * 6, -0.3);
  place(makePine(0.8 + vrand() * 0.5), 37, 0.5);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + vrand() * 0.8), rockMat);
  rock.position.y = 0.3;
  place(rock, 29 + vrand() * 3, -0.12);
}
// Stepping-stone paths from the altar to each lantern.
const steps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.65, 0.12, 8), stoneMat, 60);
let si = 0;
for (let i = 0; i < 5; i++) {
  for (let d = 6; d < 22.5 && si < 60; d += 1.5) {
    const a = lanternAngle(i);
    dummy.position.set(Math.sin(a) * d + Math.sin(d * 1.7) * 0.25, 0.04, Math.cos(a) * d);
    dummy.rotation.set(0, d, 0);
    dummy.updateMatrix();
    steps.setMatrixAt(si++, dummy.matrix);
  }
}
steps.count = si;
scene.add(steps);

// ---------- ambient particles: falling petals, spirit dust ----------
function pointsLayer(n, mat, init) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const data = [];
  for (let i = 0; i < n; i++) data.push(init(pos, i));
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return { pts, pos, data };
}
const petals = pointsLayer(260, new THREE.PointsMaterial({ map: petalTex, size: 0.35, transparent: true, depthWrite: false, color: '#ffd0e0' }), (pos, i) => {
  pos.set([(vrand() - 0.5) * 80, vrand() * 18, (vrand() - 0.5) * 80], i * 3);
  return { vx: 0.6 + vrand() * 0.6, vy: -(0.4 + vrand() * 0.5), ph: vrand() * TAU };
});
const dust = pointsLayer(320, new THREE.PointsMaterial({ map: glowTex, size: 0.45, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#9fd8ff', opacity: 0.55 }), (pos, i) => {
  const a = vrand() * TAU, r = 3 + vrand() * (R + 10), y = 0.3 + vrand() * 9;
  pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
  return { a, r, y, w: (0.02 + vrand() * 0.05) * (vrand() < 0.5 ? 1 : -1) };
});

// ---------- burst particles (sparks) ----------
const NP = 900;
const spGeo = new THREE.BufferGeometry();
const spPos = new Float32Array(NP * 3).fill(-999);
const spCol = new Float32Array(NP * 3);
spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.55, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
sparks.frustumCulled = false;
scene.add(sparks);
const sp = Array.from({ length: NP }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, c: new THREE.Color() }));
let spNext = 0;
function burst(x, y, z, n, { speed = 4, up = 2, color = '#ffd27a', life = 1, gravity = 3, ring = false } = {}) {
  const col = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    const idx = spNext;
    const p = sp[idx];
    spNext = (spNext + 1) % NP;
    const a = ring ? (i / n) * TAU : Math.random() * TAU;
    const s = speed * (ring ? 1 : 0.3 + Math.random() * 0.7);
    p.vx = Math.cos(a) * s;
    p.vz = Math.sin(a) * s;
    p.vy = up * (ring ? 0.2 : 0.4 + Math.random());
    p.g = gravity;
    p.life = p.max = life * (0.6 + Math.random() * 0.6);
    p.c.copy(col).offsetHSL((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.1);
    spPos.set([x, y, z], idx * 3);
  }
}
function updateSparks(dt) {
  for (let i = 0; i < NP; i++) {
    const p = sp[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { spPos[i * 3 + 1] = -999; continue; }
    p.vy -= p.g * dt;
    spPos[i * 3] += p.vx * dt;
    spPos[i * 3 + 1] += p.vy * dt;
    spPos[i * 3 + 2] += p.vz * dt;
    p.vx *= 0.98; p.vz *= 0.98;
    const f = p.life / p.max;
    spCol.set([p.c.r * f, p.c.g * f, p.c.b * f], i * 3);
  }
  spGeo.attributes.position.needsUpdate = true;
  spGeo.attributes.color.needsUpdate = true;
}

// ---------- player (Mây) ----------
function makeMay() {
  const g = new THREE.Group();
  const robeMat = new THREE.MeshStandardMaterial({ color: '#e9eef7', roughness: 0.6 });
  const robeTrim = new THREE.MeshStandardMaterial({ color: '#3d7fc4', roughness: 0.5 });
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.0, 16, 1, true), robeMat);
  skirt.position.y = 0.5;
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.04, 6, 24), robeTrim);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.04;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.55, 12), robeMat);
  torso.position.y = 1.1;
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.12, 12), new THREE.MeshStandardMaterial({ color: '#c0392b' }));
  sash.position.y = 0.93;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), new THREE.MeshStandardMaterial({ color: '#f5d3b0' }));
  head.position.y = 1.55;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.255, 16, 12, 0, TAU, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: '#1a1020' }));
  hair.position.y = 1.57;
  hair.rotation.x = -0.35;
  const hatMat = new THREE.MeshStandardMaterial({ color: '#e8cf8a', roughness: 0.7, emissive: '#3a2a08', emissiveIntensity: 0.4 });
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.45, 24), hatMat);
  hat.position.y = 1.92;
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.025, 6, 32), goldMat);
  brim.rotation.x = Math.PI / 2;
  brim.position.y = 1.7;
  // Small lantern hanging from the hat brim.
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3), new THREE.MeshBasicMaterial({ color: '#331' }));
  string.position.set(0, 1.55, 0.68);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#ff7a3a', emissive: '#ff8a2a', emissiveIntensity: 2.2 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), lampMat);
  lamp.scale.y = 1.25;
  lamp.position.set(0, 1.35, 0.68);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffae55', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  lampGlow.position.copy(lamp.position);
  lampGlow.scale.setScalar(1.2);
  const light = new THREE.PointLight('#ffae55', 8, 14, 1);
  light.position.copy(lamp.position);
  // Two silk ribbons streaming from the hat.
  const ribbons = [];
  for (const side of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(0.1, 1.3, 1, 10);
    geo.translate(0, -0.65, 0);
    const rb = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: side < 0 ? '#e74c3c' : '#f5c542', side: THREE.DoubleSide, emissive: side < 0 ? '#4a0a05' : '#4a3505' }));
    rb.position.set(side * 0.18, 1.72, -0.55);
    rb.userData.base = geo.attributes.position.array.slice();
    ribbons.push(rb);
    g.add(rb);
  }
  // Qi aura under the feet.
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: runeTex, color: '#ffcf7a', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.05;
  const body = new THREE.Group();
  body.add(skirt, hem, torso, sash, head, hair, hat, brim, string, lamp, lampGlow, light);
  g.add(body, aura);
  g.userData = { body, light, lampGlow, ribbons, aura };
  return g;
}
const may = makeMay();
scene.add(may);

// ---------- Big Lanterns (Đèn Lồng Lớn) ----------
const lanternViews = new Map();
const beamMat = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { o: { value: 0 }, t: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform float o, t; varying vec2 vUv;
    void main(){ float a = (1.0 - vUv.y) * (0.6 + 0.4 * sin(vUv.y * 30.0 - t * 4.0));
      gl_FragColor = vec4(1.0, 0.72, 0.35, a * o); }`,
});
function makeLantern(cost) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.5, 8), stoneMat);
  base.position.y = 0.25;
  g.add(base);
  // Gate frame: two red posts, a crossbeam and a curved roof.
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.6, 8), lacquer);
    post.position.set(s * 0.95, 2.55, 0);
    g.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 0.3), lacquer);
  beam.position.y = 4.7;
  const r = roof(1.9, 0.8);
  r.scale.z = 0.45;
  r.position.y = 5.2;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), goldMat);
  tip.position.y = 5.65;
  g.add(beam, r, tip);
  // Paper lantern.
  const paperMat = new THREE.MeshStandardMaterial({ color: '#4a1a24', emissive: '#000000', roughness: 0.7 });
  const paper = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), paperMat);
  paper.scale.y = 1.2;
  paper.position.y = 3.35;
  for (let i = -2; i <= 2; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.63 * Math.cos((i * Math.PI) / 7), 0.018, 4, 24), goldMat);
    rib.rotation.x = Math.PI / 2;
    rib.position.y = 3.35 + Math.sin((i * Math.PI) / 7) * 0.62 * 1.2;
    g.add(rib);
  }
  const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.14, 12), goldMat);
  capT.position.y = 4.1;
  const capB = capT.clone();
  capB.position.y = 2.6;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5), goldMat);
  cord.position.y = 4.4;
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 6), new THREE.MeshStandardMaterial({ color: '#c0392b' }));
  tassel.rotation.x = Math.PI;
  tassel.position.y = 2.2;
  g.add(paper, capT, capB, cord, tassel);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff9a3c', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 3.35;
  halo.scale.setScalar(5);
  const light = new THREE.PointLight('#ffa040', 0, 32, 1.1);
  light.position.y = 3.35;
  // Light pillar to the sky when lit.
  const bm = beamMat();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 60, 16, 1, true), bm);
  pillar.position.y = 34;
  // Safe zone: rotating magic circle with radius = safe_radius.
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(TUNING.safe_radius * 2, TUNING.safe_radius * 2), new THREE.MeshBasicMaterial({ map: runeTex, color: '#ffb35c', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  // Deposit progress: one orb per firefly needed.
  const orbs = [];
  for (let i = 0; i < cost; i++) {
    const a = (i / cost) * TAU;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: '#40304a', emissive: '#000000' }));
    orb.position.set(Math.cos(a) * 1.55, 0.6, Math.sin(a) * 1.55);
    orbs.push(orb);
    g.add(orb);
  }
  g.add(halo, light, pillar, ring);
  g.userData = { paperMat, halo, light, bm, ring, orbs, glow: 0, beamKick: 0 };
  return g;
}

// ---------- fireflies (đom đóm) ----------
const moteViews = new Map();
const moteCoreMat = new THREE.MeshBasicMaterial({ color: '#fff3b0' });
const moteGeo = new THREE.SphereGeometry(0.08, 8, 6);
function makeMote() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(moteGeo, moteCoreMat);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffd04a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(0.9);
  g.add(core, glow);
  g.userData = { glow };
  return g;
}

// ---------- ink shades (Bóng Mực) ----------
const shadeViews = new Map();
const inkGeo = new THREE.IcosahedronGeometry(0.75, 2);
function makeShade() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#10051c', emissive: '#3a0a66', emissiveIntensity: 0.55, roughness: 0.3, transparent: true, opacity: 0.95, flatShading: true });
  const body = new THREE.Mesh(inkGeo, mat);
  body.scale.set(1, 1.2, 1);
  const blobs = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.18 + vrand() * 0.12, 8, 6), mat);
    blobs.push(b);
    g.add(b);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff4df0' });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat);
  const e2 = e1.clone();
  e1.position.set(-0.24, 0.25, 0.66);
  e2.position.set(0.24, 0.25, 0.66);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#8a2be2', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  aura.scale.setScalar(4);
  const seal = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: runeTex, color: '#ffe08a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  seal.position.y = 1.5;
  seal.rotation.x = -Math.PI / 2;
  g.add(body, e1, e2, aura, seal);
  // Ink smoke trail (world space sprites).
  const trail = [];
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#1a0630', transparent: true, opacity: 0, depthWrite: false }));
    s.scale.setScalar(1.6 - i * 0.1);
    scene.add(s);
    trail.push(s);
  }
  g.userData = { mat, eyeMat, aura, seal, blobs, trail, hist: [], ph: vrand() * TAU };
  return g;
}
function removeShade(v) {
  for (const s of v.userData.trail) scene.remove(s);
  scene.remove(v);
}

// ---------- pulse VFX (Quang Chưởng) ----------
const pulseCircle = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: runeTex, color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
pulseCircle.rotation.x = -Math.PI / 2;
pulseCircle.position.y = 0.12;
const shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: '#fff0c0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
shock.rotation.x = -Math.PI / 2;
shock.position.y = 0.4;
const palm = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffe2a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
scene.add(pulseCircle, shock, palm);
let pulseFx = 1;
let shake = 0;
let winFx = 0;

// ---------- audio (synthesized, no assets) ----------
let audio = null;
let muted = false;
function tone(freq, dur = 0.25, type = 'sine', vol = 0.12, delay = 0) {
  if (muted) return;
  try {
    audio = audio || new AudioContext();
    const t = audio.currentTime + delay;
    const o = audio.createOscillator();
    const v = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    v.gain.setValueAtTime(vol, t);
    v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(v).connect(audio.destination);
    o.start(t);
    o.stop(t + dur);
  } catch {}
}
// Pentatonic scale (ngũ cung) for an eastern feel.
const PENTA = [523, 587, 659, 784, 880, 1046, 1175, 1318];
const SFX = {
  mote_picked: () => tone(PENTA[Math.floor(Math.random() * 5) + 3], 0.18, 'triangle', 0.06),
  deposit: () => tone(587, 0.3, 'sine', 0.1),
  lantern_lit: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.8, 'triangle', 0.09, i * 0.08)),
  pulse: () => { tone(196, 0.6, 'sine', 0.16); tone(392, 0.5, 'triangle', 0.08, 0.03); },
  player_hit: () => tone(110, 0.45, 'sawtooth', 0.08),
  shade_spawned: () => tone(73, 0.9, 'square', 0.03),
  won: () => [523, 587, 659, 784, 880, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.9, 'triangle', 0.08, i * 0.11)),
  lost: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.8, 'sine', 0.1, i * 0.22)),
};

// ---------- input ----------
const keys = new Set();
let camYaw = 0; // degrees, contract cam_yaw_deg
let dragging = false;
let lastX = 0;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR' && game.state !== 'playing') newGame();
  if ((e.code === 'Enter' || e.code === 'Space') && !started) begin();
  if (e.code === 'KeyM') muted = !muted;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; if (!started) begin(); });
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * 0.3;
  lastX = e.clientX;
});
$('overlay').addEventListener('click', () => { if (!started) begin(); else if (game.state !== 'playing') newGame(); });

function readInput() {
  // Camera looks along forward = (sin θ, cos θ). Screen-right is world move x = -1 in the contract frame.
  let x = 0, z = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x += 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x -= 1;
  return {
    move: [x, z],
    cam_yaw_deg: camYaw,
    jump: keys.has('Space'),
    interact: keys.has('KeyE'),
    pulse: keys.has('KeyF') || keys.has('ShiftLeft'),
    dash: false,
  };
}

// ---------- game lifecycle ----------
let game;
let started = false;
let paused = true;
const camPos = new THREE.Vector3(0, 6, -10);
function newGame() {
  const seed = params.has('seed') ? Number(params.get('seed')) : (Date.now() >>> 0) % 100000;
  const lit = Number(params.get('lit') || 0); // debug/screenshot only: pre-light first K lanterns
  const scenario = lit ? { lanterns: Array.from({ length: lit }, (_, i) => ({ id: `L${i + 1}`, lit: true })) } : null;
  game = createGame({ seed, night: 1, scenario });
  window.__game = game;
  for (const v of lanternViews.values()) scene.remove(v);
  for (const v of moteViews.values()) scene.remove(v);
  for (const v of shadeViews.values()) removeShade(v);
  lanternViews.clear(); moteViews.clear(); shadeViews.clear();
  for (const l of game.lanterns) {
    const v = makeLantern(TUNING.lantern_cost);
    v.position.set(l.pos[0], l.pos[1], l.pos[2]);
    v.rotation.y = Math.atan2(l.pos[0], l.pos[2]);
    if (l.lit) v.userData.glow = 1;
    scene.add(v);
    lanternViews.set(l.id, v);
  }
  camYaw = 0;
  winFx = 0;
  paused = !started;
  if (started) hideOverlay();
  camPos.set(0, 6, -10);
  sync(0, 0);
}

function begin() {
  started = true;
  paused = false;
  hideOverlay();
  tone(659, 0.3, 'triangle', 0.05);
}
function hideOverlay() { $('overlay').classList.add('hidden'); }
function showCard(html) {
  $('card').innerHTML = html;
  $('overlay').classList.remove('hidden');
}

const fmtTime = (s) => {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

let bannerT = 0;
function banner(text, danger = false) {
  const b = $('banner');
  b.textContent = text;
  b.className = danger ? 'show danger' : 'show';
  clearTimeout(bannerT);
  bannerT = setTimeout(() => (b.className = ''), 2200);
}

function handleEvents(evs) {
  const P = game.player;
  for (const e of evs) {
    SFX[e.name] && SFX[e.name]();
    if (e.name === 'pulse') {
      pulseFx = 0;
      shake = 0.35;
      burst(P.pos[0], 1.2, P.pos[2], 90, { speed: 9, up: 1.5, color: '#ffd27a', life: 0.8, gravity: 0.5, ring: true });
      burst(P.pos[0], 1.2, P.pos[2], 50, { speed: 3, up: 7, color: '#fff2c4', life: 1.1, gravity: 4 });
    }
    if (e.name === 'player_hit') {
      shake = 0.5;
      burst(P.pos[0], 1.1, P.pos[2], 40, { speed: 4, up: 3, color: '#a040ff', life: 0.8 });
      const v = $('vignette');
      v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit');
      $('h-flames').classList.remove('flash'); void $('h-flames').offsetWidth; $('h-flames').classList.add('flash');
    }
    if (e.name === 'deposit') {
      const l = lanternViews.get(e.data.lantern_id);
      if (l) burst(l.position.x, 2, l.position.z, 25, { speed: 2, up: 4, color: '#ffcf6a', life: 0.9 });
    }
    if (e.name === 'lantern_lit') {
      const l = lanternViews.get(e.data.lantern_id);
      if (l) {
        l.userData.beamKick = 1;
        burst(l.position.x, 3.4, l.position.z, 160, { speed: 6, up: 9, color: '#ffb347', life: 1.6, gravity: 5 });
      }
      banner(`${e.data.lantern_id} — Đèn đã sáng!`);
    }
    if (e.name === 'shade_spawned') banner('Bóng Mực trỗi dậy từ sương đen…', true);
    if (e.name === 'game_over') {
      const won = e.data.result === 'won';
      SFX[won ? 'won' : 'lost']();
      if (won) winFx = 6;
      const why = { all_lit: 'Năm Đèn Lồng Lớn bừng sáng — sương đen tan biến khỏi Đảo Bến.', dawn: 'Bình minh đã tới mà đảo vẫn chưa đủ ánh đèn…', no_flames: 'Ngọn lửa của Mây đã tắt trong sương mực…' }[e.data.reason];
      showCard(`<div class="seal">${won ? '勝' : '夜'}</div><h1>${won ? 'Đèn Sáng Muôn Phương' : 'Đêm Đen Bao Phủ'}</h1><div class="divider"></div>
        <p>${why}</p><p class="big">Điểm: <b>${game.score}</b></p><p class="sub">Lửa còn ${P.flames} · Đèn ${game.lanterns.filter((l) => l.lit).length}/${TUNING.lantern_count_night1}</p>
        <button class="btn">Chơi lại (R)</button>`);
    }
  }
}

// ---------- sync visuals with sim state ----------
const tmp = new THREE.Vector3();
const shakeV = new THREE.Vector3();
const DUST_COOL = new THREE.Color('#9fd8ff');
const DUST_WARM = new THREE.Color('#ffd27a');
let lastMayPos = [0, 0, 0];
let stride = 0;
function sync(t, dt) {
  const P = game.player;
  const ud = may.userData;
  may.position.set(P.pos[0], P.pos[1], P.pos[2]);
  const moved = Math.hypot(P.pos[0] - lastMayPos[0], P.pos[2] - lastMayPos[2]);
  lastMayPos = [...P.pos];
  const inp = readInput();
  if (inp.move[0] || inp.move[1]) {
    const th = (camYaw * Math.PI) / 180;
    const wx = inp.move[0] * Math.cos(th) + inp.move[1] * Math.sin(th);
    const wz = -inp.move[0] * Math.sin(th) + inp.move[1] * Math.cos(th);
    let d = Math.atan2(wx, wz) - may.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    may.rotation.y += d * 0.25;
  }
  stride += moved * 2.2;
  ud.body.position.y = moved > 0.001 && P.pos[1] === 0 ? Math.abs(Math.sin(stride)) * 0.08 : 0;
  ud.body.rotation.x = moved > 0.001 ? 0.12 : 0;
  if (moved > 0.02 && P.pos[1] === 0 && Math.random() < 0.35) burst(P.pos[0], 0.1, P.pos[2], 1, { speed: 0.6, up: 1, color: '#ffd98a', life: 0.6, gravity: 0 });
  may.visible = !(P.invulnT > 0 && Math.floor(t * 12) % 2 === 0);
  ud.light.intensity = 6 + P.carried * 1.2;
  ud.lampGlow.scale.setScalar(1 + P.carried * 0.12 + Math.sin(t * 5) * 0.08);
  ud.aura.rotation.z = t * 0.8;
  ud.aura.material.opacity = 0.25 + (P.carried / TUNING.carry_capacity) * 0.5;
  for (const rb of ud.ribbons) {
    const pa = rb.geometry.attributes.position;
    const base = rb.userData.base;
    for (let i = 0; i < pa.count; i++) {
      const y = base[i * 3 + 1];
      const f = -y;
      pa.setZ(i, base[i * 3 + 2] - f * (0.35 + Math.min(moved * 6, 0.8)) + Math.sin(t * 7 + y * 4) * 0.08 * f);
      pa.setX(i, base[i * 3] + Math.sin(t * 5 + y * 3) * 0.05 * f);
    }
    pa.needsUpdate = true;
  }

  // Lanterns + island brightening.
  let litCount = 0;
  for (const l of game.lanterns) {
    const v = lanternViews.get(l.id);
    const u = v.userData;
    if (l.lit) litCount++;
    u.glow += ((l.lit ? 1 : 0) - u.glow) * 0.04;
    u.light.intensity = u.glow * 45;
    u.paperMat.color.set(l.lit ? '#ff5a2a' : '#4a1a24');
    u.paperMat.emissive.setRGB(2.2 * u.glow, 0.7 * u.glow, 0.15 * u.glow);
    u.halo.material.opacity = 0.9 * u.glow;
    u.halo.scale.setScalar(5 + Math.sin(t * 2 + v.position.x) * 0.4);
    u.ring.material.opacity = 0.55 * u.glow;
    u.ring.rotation.z = t * 0.25;
    u.beamKick = Math.max(0, u.beamKick - dt * 0.4);
    u.bm.uniforms.o.value = u.glow * 0.28 + u.beamKick * 0.9;
    u.bm.uniforms.t.value = t;
    u.orbs.forEach((orb, i) => {
      const on = i < l.deposited || l.lit;
      orb.material.color.set(on ? '#ffd27a' : '#40304a');
      orb.material.emissive.set(on ? '#ff9a2a' : '#000000');
      orb.material.emissiveIntensity = on ? 2 : 0;
      orb.position.y = 0.6 + (on ? Math.sin(t * 3 + i) * 0.08 : 0);
    });
  }
  const k = litCount / TUNING.lantern_count_night1;
  skyUni.k.value += (k - skyUni.k.value) * (dt > 0 ? 0.02 : 1);
  const kk = skyUni.k.value;
  hemi.intensity = 0.9 + kk * 1.3;
  scene.fog.color.copy(FOG_NIGHT).lerp(FOG_DAWN, kk);
  scene.fog.density = 0.0065 - kk * 0.002;
  altar.material.opacity = 0.25 + kk * 0.5 + Math.sin(t * 1.5) * 0.05;
  altar.rotation.z = -t * 0.12;

  // Fireflies.
  const seen = new Set();
  for (const m of game.motes) {
    seen.add(m.id);
    let v = moteViews.get(m.id);
    if (!v) {
      v = makeMote();
      scene.add(v);
      moteViews.set(m.id, v);
    }
    const ph = m.pos[0] * 1.7 + m.pos[2];
    v.position.set(m.pos[0] + Math.sin(t * 1.3 + ph) * 0.2, 0.8 + Math.sin(t * 2.1 + ph) * 0.3, m.pos[2] + Math.cos(t * 1.1 + ph) * 0.2);
    v.userData.glow.scale.setScalar((0.75 + 0.35 * Math.sin(t * 7 + ph)) * 1.1);
  }
  for (const [id, v] of moteViews) {
    if (!seen.has(id)) {
      if (dt > 0) burst(v.position.x, v.position.y, v.position.z, 18, { speed: 2.5, up: 2, color: '#ffe066', life: 0.7, gravity: 1 });
      scene.remove(v);
      moteViews.delete(id);
    }
  }

  // Ink shades.
  const seenS = new Set();
  for (const s of game.shades) {
    seenS.add(s.id);
    let v = shadeViews.get(s.id);
    if (!v) {
      v = makeShade();
      scene.add(v);
      shadeViews.set(s.id, v);
      if (dt > 0) burst(s.pos[0], s.pos[1], s.pos[2], 40, { speed: 3, up: 2, color: '#7a1fd0', life: 1.2 });
    }
    const u = v.userData;
    v.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + u.ph) * 0.15, s.pos[2]);
    tmp.set(P.pos[0], v.position.y, P.pos[2]);
    v.lookAt(tmp);
    const st = s.state === 'stunned';
    u.mat.color.set(st ? '#8e7bb0' : '#10051c');
    u.mat.emissive.set(st ? '#40305a' : '#3a0a66');
    u.mat.opacity = st ? 0.6 : 0.95;
    u.eyeMat.color.set(st ? '#ffffff' : '#ff4df0');
    u.aura.material.color.set(st ? '#ffd27a' : '#8a2be2');
    u.aura.material.opacity = st ? 0.25 : 0.5 + Math.sin(t * 4 + u.ph) * 0.1;
    u.seal.visible = st;
    u.seal.rotation.z = t * 2;
    u.blobs.forEach((b, i) => {
      const a = t * (1.5 + i * 0.3) + i * 1.3 + u.ph;
      b.position.set(Math.cos(a) * 0.9, Math.sin(a * 1.3) * 0.5 - 0.2, Math.sin(a) * 0.9);
    });
    u.hist.unshift([v.position.x, v.position.y, v.position.z]);
    if (u.hist.length > 30) u.hist.length = 30;
    u.trail.forEach((sprite, i) => {
      const h = u.hist[Math.min(u.hist.length - 1, i * 3)];
      sprite.position.set(h[0], h[1] - 0.1, h[2]);
      sprite.material.opacity = st ? 0 : 0.5 * (1 - i / u.trail.length);
    });
  }
  for (const [id, v] of shadeViews) if (!seenS.has(id)) { removeShade(v); shadeViews.delete(id); }

  // Pulse "chưởng" VFX.
  if (pulseFx < 1) {
    pulseFx = Math.min(1, pulseFx + dt * 1.8);
    const e = 1 - Math.pow(1 - pulseFx, 3);
    pulseCircle.position.set(P.pos[0], 0.12, P.pos[2]);
    pulseCircle.scale.setScalar(0.5 + e * TUNING.pulse_radius);
    pulseCircle.rotation.z = pulseFx * 3;
    pulseCircle.material.opacity = 1.2 * (1 - pulseFx);
    shock.position.set(P.pos[0], 0.4 + e * 0.6, P.pos[2]);
    shock.scale.setScalar(0.5 + Math.min(1, pulseFx * 1.6) * TUNING.pulse_radius);
    shock.material.opacity = Math.max(0, 1 - pulseFx * 1.6);
    palm.position.set(P.pos[0], P.pos[1] + 1.3, P.pos[2]);
    palm.scale.setScalar(2 + e * 6);
    palm.material.opacity = Math.max(0, 1 - pulseFx * 2.5);
    bloom.strength = 0.85 + (1 - pulseFx) * 0.9;
  } else {
    pulseCircle.material.opacity = 0;
    shock.material.opacity = 0;
    palm.material.opacity = 0;
    bloom.strength = 0.85;
  }

  // Victory fireworks.
  if (winFx > 0 && dt > 0) {
    winFx -= dt;
    if (Math.random() < dt * 3) {
      const a = Math.random() * TAU, d = 10 + Math.random() * 20;
      const cols = ['#ffb347', '#ffd27a', '#ff6a3a', '#fff2c4', '#ff9ad0'];
      burst(Math.sin(a) * d, 18 + Math.random() * 10, Math.cos(a) * d, 120, { speed: 8, up: 3, color: cols[Math.floor(Math.random() * cols.length)], life: 1.8, gravity: 2 });
    }
  }

  // Ambient layers.
  const pp = petals.pos;
  for (let i = 0; i < petals.data.length; i++) {
    const d = petals.data[i];
    pp[i * 3] += (d.vx + Math.sin(t + d.ph) * 0.4) * dt;
    pp[i * 3 + 1] += d.vy * dt;
    pp[i * 3 + 2] += Math.cos(t * 0.7 + d.ph) * 0.5 * dt;
    if (pp[i * 3 + 1] < 0) {
      pp[i * 3] = P.pos[0] + (Math.random() - 0.7) * 70;
      pp[i * 3 + 1] = 14 + Math.random() * 6;
      pp[i * 3 + 2] = P.pos[2] + (Math.random() - 0.5) * 70;
    }
  }
  petals.pts.geometry.attributes.position.needsUpdate = true;
  const dp = dust.pos;
  for (let i = 0; i < dust.data.length; i++) {
    const d = dust.data[i];
    d.a += d.w * dt;
    dp.set([Math.cos(d.a) * d.r, d.y + Math.sin(t * 0.8 + d.a * 3) * 0.6, Math.sin(d.a) * d.r], i * 3);
  }
  dust.pts.geometry.attributes.position.needsUpdate = true;
  dust.pts.material.color.copy(DUST_COOL).lerp(DUST_WARM, kk);
  cloudLayers.forEach((c, i) => {
    c.material.map.offset.x = t * (0.004 + i * 0.002);
    c.material.map.offset.y = t * 0.002 * (i % 2 ? -1 : 1);
  });
  islets.forEach((g) => {
    g.position.y = g.userData.y0 + Math.sin(t * 0.5 + g.userData.ph) * 1.2;
    g.rotation.y = t * 0.03 + g.userData.ph;
  });
  updateSparks(dt);

  // Camera: third person, behind Mây along forward (sin θ, cos θ), smoothed, with shake.
  const th = (camYaw * Math.PI) / 180;
  tmp.set(P.pos[0] - Math.sin(th) * 9.5, P.pos[1] + 5.2, P.pos[2] - Math.cos(th) * 9.5);
  camPos.lerp(tmp, dt > 0 ? Math.min(1, dt * 8) : 1);
  shake = Math.max(0, shake - dt);
  camera.position.copy(camPos);
  if (shake > 0) camera.position.add(shakeV.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
  camera.lookAt(P.pos[0], P.pos[1] + 1.4, P.pos[2]);
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  moon.position.copy(camera.position).addScaledVector(MOON_DIR, 520);
  moonHalo.position.copy(moon.position);

  // HUD.
  const maxF = Math.max(TUNING.flames, P.flames);
  $('h-flames').innerHTML = `<span class="lbl">Hồn Hỏa</span>${Array.from({ length: Math.min(maxF, 10) }, (_, i) => `<i class="orb ${i < P.flames ? 'on' : ''}"></i>`).join('')}<span class="num">${P.flames}</span>`;
  $('h-carried').innerHTML = `<span class="lbl">Đom đóm</span><span class="bar"><span style="width:${(100 * P.carried) / TUNING.carry_capacity}%"></span></span><span class="num">${P.carried}/${TUNING.carry_capacity}</span>`;
  $('h-lanterns').innerHTML = `<span class="lbl">Đèn Lồng</span>${game.lanterns.map((l) => `<i class="lan ${l.lit ? 'on' : ''}" title="${l.id}"></i>`).join('')}<span class="num">${litCount}/${TUNING.lantern_count_night1}</span>`;
  $('h-time').innerHTML = `<span class="lbl">Canh Giờ</span><span class="num big">${fmtTime(timeLeft(game))}</span>`;
  $('h-score').innerHTML = `<span class="lbl">Điểm</span><span class="num big">${game.score}</span>`;
  const ready = P.pulseCdT <= 0 && P.carried >= TUNING.pulse_cost;
  $('h-pulse').className = `pill skill ${ready ? 'ready' : ''}`;
  $('h-pulse').innerHTML = `<span class="key">F</span><span class="lbl">Quang Chưởng</span><span class="num">${P.pulseCdT > 0 ? 'hồi…' : ready ? 'sẵn sàng' : `cần ${TUNING.pulse_cost} đom đóm`}</span>`;
  const near = game.lanterns.find((l) => !l.lit && Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]) <= TUNING.interact_radius);
  $('prompt').textContent = game.state !== 'playing' ? '' : near ? (P.carried > 0 ? `Nhấn E để truyền linh quang vào ${near.id} (${near.deposited}/${TUNING.lantern_cost})` : `${near.id} cần ${TUNING.lantern_cost - near.deposited} đom đóm`) : '';
}

// ---------- fixed-step loop (60 Hz, same as headless) ----------
let acc = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused && game.state === 'playing') {
    acc += dt * SPEED;
    const input = readInput();
    while (acc >= 1 / TICK_RATE && game.state === 'playing') {
      handleEvents(step(game, input));
      acc -= 1 / TICK_RATE;
    }
  } else acc = 0;
  if (keys.has('KeyQ')) camYaw += 120 * dt;
  if (keys.has('KeyZ')) camYaw -= 120 * dt;
  sync(now / 1000, dt);
  composer.render();
  requestAnimationFrame(frame);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

newGame();
showCard(`<div class="seal">燈</div><h1>Đảo Đèn Lồng</h1><div class="subtitle">Đêm Thứ Nhất · Đảo Bến</div><div class="divider"></div>
<p>Sương mực đã nuốt trọn ánh sáng của hòn đảo giữa biển mây. Hãy giúp tiểu đăng nhân <b>Mây</b> thu thập linh quang đom đóm, thắp lại <b>năm Đèn Lồng Lớn</b> trước khi trời sáng. Bóng Mực sợ ánh đèn — hãy dùng <b>Quang Chưởng</b> để xua chúng.</p>
<div class="keys"><span><kbd>W A S D</kbd> di chuyển</span><span><kbd>Space</kbd> khinh công</span><span><kbd>E</kbd> thắp đèn</span><span><kbd>F</kbd> Quang Chưởng</span><span><kbd>Q</kbd><kbd>Z</kbd> / kéo chuột: xoay góc nhìn</span><span><kbd>M</kbd> âm thanh</span></div>
<button class="btn">Nhập Cuộc (Enter)</button>`);
if (params.has('autostart')) begin();
requestAnimationFrame(frame);
