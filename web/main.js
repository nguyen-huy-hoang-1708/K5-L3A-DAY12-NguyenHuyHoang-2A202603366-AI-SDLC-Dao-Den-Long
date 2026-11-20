// 3D client — presents the shared deterministic sim (src/sim.js) for the 3-night campaign.
// Presentation only: it never changes game rules, so headless output is unaffected.
import * as THREE from 'three';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';
import { createGame, step, TUNING, TICK_RATE, timeLeft, MAPS, capacity } from '../src/sim.js';
import { benchScenario, benchCamera, benchStats, BENCH } from '../src/bench.js';
import { PALETTE, PALETTE_CB, ambientIntensity } from './palette.js';
import { TAU, glowTex, runeTex, petalTex, leafTex, talismanTex, MAT, buildSky, buildNight } from './world.js';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const SPEED = Math.max(1, Math.min(8, Number(params.get('speed') || 1))); // debug/playtest only
const IS_BENCH = params.has('bench'); // Ticket-04 benchmark scene (tools/bench.js)
const NIGHT_LINES = {
  1: 'Mây à, sương mực đã phủ kín Đảo Bến. Đèn giờ cạn dầu dần — thắp đèn rồi nhớ quay lại châm dầu, giữ đủ đèn sáng tới bình minh. Đừng bước ra mép đảo — dưới kia chỉ có biển mây.',
  2: 'Đảo Cau có hai hòn nối nhau bằng cầu tre không lan can. Bục gió sẽ đưa con bay sang hòn bên kia. Coi chừng Gió Lạc — chúng chỉ chực cướp đom đóm khi con mang nhiều.',
  3: 'Đảo Chuông có ba tầng. Theo dốc lên tầng giữa, dùng bục gió để lên chân tháp chuông. Khi lá bay rối là gió lớn sắp về — giữ chặt nón nhé!',
};

// ---------- settings (persisted) ----------
const settings = { volume: 0.7, sens: 1, colorblind: false };
const cb = () => (settings.colorblind ? PALETTE_CB : PALETTE); // colour-blind aware colours for shade rim + UI danger
const applyCB = () => document.body.classList.toggle('cb', !!settings.colorblind);
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}')); } catch {}
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch {} };

// ---------- renderer / post ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(IS_BENCH ? 1 : Math.min(devicePixelRatio, 1.5)); // bench renders exactly 1280×720
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(new THREE.Color(PALETTE.fog), 0.008);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.8, 0.5, 0.75);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const hemi = new THREE.HemisphereLight('#a8b8ff', '#2a2440', ambientIntensity(0, 5));
const moonLight = new THREE.DirectionalLight('#c8d0ff', 0.45);
moonLight.position.set(-36, 34, -63);
scene.add(hemi, moonLight);
const sky = buildSky(scene, { bench: IS_BENCH });

// ---------- particles ----------
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
function burst(x, y, z, n, { speed = 4, up = 2, color = PALETTE.moteHalo, life = 1, gravity = 3, ring = false, dir = null } = {}) {
  const col = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    const idx = spNext, p = sp[idx];
    spNext = (spNext + 1) % NP;
    const a = ring ? (i / n) * TAU : Math.random() * TAU;
    const s = speed * (ring ? 1 : 0.3 + Math.random() * 0.7);
    p.vx = dir ? dir[0] * s : Math.cos(a) * s;
    p.vz = dir ? dir[1] * s : Math.sin(a) * s;
    p.vy = up * (ring ? 0.2 : 0.4 + Math.random());
    p.g = gravity;
    p.life = p.max = life * (0.6 + Math.random() * 0.6);
    p.c.copy(col);
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
    spPos[i * 3] += p.vx * dt; spPos[i * 3 + 1] += p.vy * dt; spPos[i * 3 + 2] += p.vz * dt;
    const f = p.life / p.max;
    spCol.set([p.c.r * f, p.c.g * f, p.c.b * f], i * 3);
  }
  spGeo.attributes.position.needsUpdate = true;
  spGeo.attributes.color.needsUpdate = true;
}
// Ambient layers: petals and wind leaves.
function layer(n, mat) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 80, Math.random() * 16, (Math.random() - 0.5) * 80], i * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return { pts, pos, n };
}
const petals = layer(200, new THREE.PointsMaterial({ map: petalTex, size: 0.35, transparent: true, depthWrite: false }));
const leaves = layer(260, new THREE.PointsMaterial({ map: leafTex, size: 0.5, transparent: true, depthWrite: false, opacity: 0 }));

// ---------- audio (synthesized; master volume from settings) ----------
let ac = null, master = null, musicTimer = 0, muted = false;
function audio() {
  if (!ac) {
    try {
      ac = new AudioContext();
      master = ac.createGain();
      master.connect(ac.destination);
    } catch { return null; }
  }
  master.gain.value = muted ? 0 : settings.volume;
  return ac;
}
function tone(freq, dur = 0.25, type = 'sine', vol = 0.12, delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), v = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  v.gain.setValueAtTime(vol, t);
  v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(v).connect(master);
  o.start(t);
  o.stop(t + dur);
}
function noise(dur = 0.6, vol = 0.05) {
  const a = audio();
  if (!a) return;
  const b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / d.length);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), v = a.createGain();
  f.type = 'bandpass'; f.frequency.value = 700; v.gain.value = vol;
  s.buffer = b;
  s.connect(f).connect(v).connect(master);
  s.start();
}
const PENTA = [262, 294, 330, 392, 440, 523, 587, 659];
function startMusic() {
  stopMusic();
  let i = 0;
  musicTimer = setInterval(() => {
    if (screen !== 'play') return;
    tone(PENTA[[0, 2, 4, 3, 5, 4, 2, 1][i % 8]] / 2, 1.6, 'sine', 0.035);
    if (i % 4 === 0) tone(PENTA[[0, 3, 4, 2][(i / 4) % 4]] / 4, 3.2, 'triangle', 0.03);
    if (i % 3 === 0) tone(PENTA[5 + (i % 3)], 0.5, 'sine', 0.012, 0.25);
    i++;
  }, 600);
}
function stopMusic() { clearInterval(musicTimer); }
const SFX = {
  mote_picked: () => tone(PENTA[4 + Math.floor(Math.random() * 4)] * 2, 0.16, 'triangle', 0.05),
  deposit: () => tone(587, 0.3, 'sine', 0.09),
  lantern_lit: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.8, 'triangle', 0.08, i * 0.08)),
  lantern_out: () => [523, 392, 262].forEach((f, i) => tone(f, 0.6, 'sine', 0.08, i * 0.15)),
  refuel: () => [659, 880].forEach((f, i) => tone(f, 0.25, 'triangle', 0.06, i * 0.06)),
  pulse: () => { tone(196, 0.6, 'sine', 0.15); tone(392, 0.5, 'triangle', 0.07, 0.03); },
  player_hit: () => tone(110, 0.45, 'sawtooth', 0.08),
  shade_spawned: () => tone(73, 0.9, 'square', 0.03),
  dash: () => noise(0.25, 0.08),
  jump: () => tone(440, 0.15, 'triangle', 0.05),
  charm_picked: () => [784, 988, 1175].forEach((f, i) => tone(f, 0.3, 'triangle', 0.07, i * 0.05)),
  drifter_steal: () => [660, 520, 400].forEach((f, i) => tone(f, 0.2, 'triangle', 0.06, i * 0.06)),
  drifter_drop: () => tone(880, 0.3, 'triangle', 0.06),
  tick: () => tone(1200, 0.08, 'square', 0.04),
  won: () => [523, 587, 659, 784, 880, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.9, 'triangle', 0.08, i * 0.11)),
  lost: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.8, 'sine', 0.1, i * 0.22)),
  wind: () => noise(1.6, 0.06),
};

// ---------- entity views ----------
function makeMay() {
  const g = new THREE.Group();
  const robe = new THREE.MeshStandardMaterial({ color: PALETTE.robe, roughness: 0.6 });
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.0, 16, 1, true), robe);
  skirt.position.y = 0.5;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.55, 12), robe);
  torso.position.y = 1.1;
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.12, 12), new THREE.MeshStandardMaterial({ color: PALETTE.scarf }));
  sash.position.y = 0.93;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), new THREE.MeshStandardMaterial({ color: '#f5d3b0' }));
  head.position.y = 1.55;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.255, 16, 12, 0, TAU, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: '#1a1020' }));
  hair.position.y = 1.57;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.45, 24), new THREE.MeshStandardMaterial({ color: '#e3cf8f', roughness: 0.7 }));
  hat.position.y = 1.92;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshStandardMaterial({ color: PALETTE.lanternLit, emissive: PALETTE.lanternLit, emissiveIntensity: 2 }));
  lamp.position.set(0, 1.35, 0.68);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: PALETTE.lanternCore, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  lampGlow.position.copy(lamp.position);
  const light = new THREE.PointLight(PALETTE.lanternLit, 6, 14, 1);
  light.position.copy(lamp.position);
  const ribbons = [];
  for (const side of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(0.1, 1.3, 1, 10);
    geo.translate(0, -0.65, 0);
    const rb = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: PALETTE.scarf, side: THREE.DoubleSide }));
    rb.position.set(side * 0.18, 1.72, -0.55);
    rb.userData.base = geo.attributes.position.array.slice();
    ribbons.push(rb);
    g.add(rb);
  }
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: runeTex, color: PALETTE.gold, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.05;
  const body = new THREE.Group();
  body.add(skirt, torso, sash, head, hair, hat, lamp, lampGlow, light);
  g.add(body, aura);
  g.userData = { body, light, lampGlow, ribbons, aura };
  return g;
}
const may = makeMay();
scene.add(may);

function makeLantern(cost) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.5, 8), MAT.stone);
  base.position.y = 0.25;
  g.add(base);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.6, 8), MAT.wood);
    post.position.set(s * 0.95, 2.55, 0);
    g.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 0.3), MAT.wood);
  beam.position.y = 4.7;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.8, 4), MAT.roof);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.45;
  roof.position.y = 5.2;
  g.add(beam, roof);
  const paperMat = new THREE.MeshStandardMaterial({ color: PALETTE.lanternOff, emissive: '#000000', roughness: 0.7 });
  const paper = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), paperMat);
  paper.scale.y = 1.2;
  paper.position.y = 3.35;
  for (const y of [2.62, 4.08]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.14, 12), MAT.gold);
    cap.position.y = y;
    g.add(cap);
  }
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: PALETTE.lanternCore, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  core.position.y = 3.35;
  core.scale.setScalar(2.2);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: PALETTE.lanternLit, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 3.35;
  halo.scale.setScalar(6);
  const light = new THREE.PointLight(PALETTE.lanternLit, 0, 30, 1.1);
  light.position.y = 3.35;
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(TUNING.safe_radius * 2, TUNING.safe_radius * 2), new THREE.MeshBasicMaterial({ map: runeTex, color: PALETTE.lanternLit, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  pillar.position.y = 34;
  const orbs = [];
  for (let i = 0; i < Math.max(cost, TUNING.lantern_cost); i++) {
    const a = (i / cost) * TAU;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#3a3f55' }));
    orb.position.set(Math.cos(a) * 1.55, 0.6, Math.sin(a) * 1.55);
    orbs.push(orb);
    g.add(orb);
  }
  // Fuel bar (Ticket-03): background + fill, shown above the roof while lit.
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.26), new THREE.MeshBasicMaterial({ color: '#0b0f22', transparent: true, opacity: 0.85, depthWrite: false }));
  const barFill = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.18), new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit }));
  barFill.geometry.translate(1.05, 0, 0);
  barFill.position.set(-1.05, 0, 0.01);
  const bar = new THREE.Group();
  bar.add(barBg, barFill);
  bar.position.y = 6.1;
  // Torn paper (shown while unlit) so lit/unlit can be told apart without colour.
  const tearShape = new THREE.Shape();
  [[-0.05, 0.35], [0.1, 0.15], [-0.08, 0.02], [0.12, -0.15], [-0.04, -0.33], [0.05, -0.33], [0.2, -0.15], [0.02, 0.02], [0.18, 0.15], [0.05, 0.35]].forEach(([x, y], i) => (i ? tearShape.lineTo(x, y) : tearShape.moveTo(x, y)));
  const tearMat = new THREE.MeshBasicMaterial({ color: '#05060c', side: THREE.DoubleSide });
  const tear = new THREE.Group();
  for (const z of [0.63, -0.63]) {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(tearShape), tearMat);
    m.position.set(0, 0, z);
    tear.add(m);
  }
  tear.position.y = 3.35;
  g.add(paper, core, halo, light, ring, pillar, bar, tear);
  g.userData = { paperMat, paper, core, halo, light, ring, pillar, orbs, bar, barFill, tear, glow: 0, kick: 0 };
  return g;
}
const moteGeo = new THREE.SphereGeometry(0.08, 8, 6);
const moteCore = new THREE.MeshBasicMaterial({ color: PALETTE.moteCore });
function makeMote() {
  const g = new THREE.Group();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: PALETTE.moteHalo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  g.add(new THREE.Mesh(moteGeo, moteCore), glow);
  g.userData = { glow };
  return g;
}
const inkGeo = new THREE.IcosahedronGeometry(0.75, 2);
function makeShade() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: PALETTE.shadeBody, emissive: PALETTE.shadeRim, emissiveIntensity: 0.25, roughness: 0.3, transparent: true, opacity: 0.95, flatShading: true });
  const body = new THREE.Mesh(inkGeo, mat);
  body.scale.set(1, 1.2, 1);
  const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat);
  const e2 = e1.clone();
  e1.position.set(-0.24, 0.25, 0.66);
  e2.position.set(0.24, 0.25, 0.66);
  const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: PALETTE.shadeRim, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  rim.scale.setScalar(3.6);
  const seal = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: runeTex, color: PALETTE.gold, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  seal.position.y = 1.5;
  seal.rotation.x = -Math.PI / 2;
  const tendrilGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tendril = new THREE.Line(tendrilGeo, new THREE.LineBasicMaterial({ color: PALETTE.shadeRim, transparent: true, opacity: 0.9 }));
  tendril.frustumCulled = false;
  scene.add(tendril);
  g.add(body, e1, e2, rim, seal);
  g.userData = { mat, eyeMat, rim, seal, tendril, ph: Math.random() * TAU };
  return g;
}
function removeShadeView(v) { scene.remove(v.userData.tendril); }
function makeDrifter() {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.45, 3, 1, 16);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: PALETTE.drifter, side: THREE.DoubleSide, transparent: true, opacity: 0.85, emissive: PALETTE.drifter, emissiveIntensity: 0.15 });
  const ribbon = new THREE.Mesh(geo, mat);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: PALETTE.drifter, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(2.6);
  const loot = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(moteGeo, moteCore);
    loot.add(m);
  }
  g.add(ribbon, glow, loot);
  g.userData = { ribbon, base: geo.attributes.position.array.slice(), mat, loot, last: null };
  return g;
}
function makeCharm() {
  const g = new THREE.Group();
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.1), new THREE.MeshBasicMaterial({ map: talismanTex, side: THREE.DoubleSide }));
  card.position.y = 1.1;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: PALETTE.gold, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.y = 1.1;
  glow.scale.setScalar(2);
  g.add(card, glow);
  g.userData = { card };
  return g;
}

// Pulse VFX.
const pulseCircle = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: runeTex, color: PALETTE.gold, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
pulseCircle.rotation.x = -Math.PI / 2;
const shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
shock.rotation.x = -Math.PI / 2;
scene.add(pulseCircle, shock);
let pulseFx = 1, shake = 0, winFx = 0;

// ---------- input ----------
const keys = new Set();
let camYaw = 0, dragging = false, lastX = 0;
addEventListener('keydown', (e) => {
  if (e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) return;
  keys.add(e.code);
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (screen === 'play') pauseGame();
    else if (screen === 'paused') resumeGame();
    else if (screen === 'settings') openPause();
  }
  if (e.code === 'Enter') document.querySelector('#card .btn')?.click();
  if (e.code === 'KeyR' && screen === 'result') startNight(night);
  if (e.code === 'KeyM') muted = !muted;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (screen === 'play') pauseGame(); });
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; });
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => {
  if (!dragging || screen !== 'play') return;
  camYaw -= (e.clientX - lastX) * 0.3 * settings.sens;
  lastX = e.clientX;
});
function readInput() {
  // Camera looks along forward = (sin θ, cos θ); screen-right is contract move x = -1.
  let x = 0, z = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x += 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x -= 1;
  return { move: [x, z], cam_yaw_deg: camYaw, jump: keys.has('Space'), interact: keys.has('KeyE'), pulse: keys.has('KeyF'), dash: keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyQ') };
}

// ---------- campaign / screens ----------
let game = null, night = 1, screen = 'menu', world = null;
const won = {};
const views = { lanterns: new Map(), motes: new Map(), shades: new Map(), drifters: new Map(), charms: new Map() };
function clearViews() {
  for (const m of Object.values(views)) { for (const v of m.values()) { scene.remove(v); if (v.userData.tendril) removeShadeView(v); } m.clear(); }
}
function card(html) { $('card').innerHTML = html; $('overlay').classList.remove('hidden'); $('hud').classList.add('hidden'); }
function hideCard() { $('overlay').classList.add('hidden'); }
function bind(id, fn) { const b = document.getElementById(id); if (b) b.onclick = fn; }

function showMenu() {
  screen = 'menu';
  stopMusic();
  card(`<div class="seal">燈</div><h1>Đảo Đèn Lồng</h1><div class="sub">Ba hòn đảo · Ba đêm</div><div class="divider"></div>
    <p>Sương mực đã nuốt ánh sáng của các hòn đảo giữa biển mây. Giúp Mây — người giữ đèn nhỏ tuổi — gom đom đóm, thắp lại các Đèn Lồng Lớn qua ba đêm trước khi trời sáng.</p>
    <div class="keys"><span><kbd>WASD</kbd> đi</span><span><kbd>Space</kbd> nhảy</span><span><kbd>Shift</kbd>/<kbd>Q</kbd> lướt</span><span><kbd>E</kbd> nạp đèn</span><span><kbd>F</kbd> tỏa sáng</span><span>kéo chuột: xoay</span><span><kbd>Esc</kbd>/<kbd>P</kbd> tạm dừng</span></div>
    <div class="menu"><button class="btn" id="b-start">Bắt đầu (Enter)</button><button class="btn ghost" id="b-set">Cài đặt</button></div>`);
  bind('b-start', () => { Object.keys(won).forEach((k) => delete won[k]); startNight(Number(params.get('night')) || 1); });
  bind('b-set', () => openSettings(showMenu));
}
const need = () => Math.ceil((game.lanterns.length * 6) / 10);
function startNight(n) {
  night = n;
  const seed = params.has('seed') ? Number(params.get('seed')) : (Date.now() >>> 0) % 100000;
  const lit = Number(params.get('lit') || 0); // debug/screenshot only: pre-light first K lanterns
  const fuel = params.has('fuel') ? Number(params.get('fuel')) : undefined; // debug/screenshot only: fuel of pre-lit lanterns
  const scenario = lit ? { lanterns: Array.from({ length: lit }, (_, i) => ({ id: `L${i + 1}`, lit: true, ...(fuel ? { fuel } : {}) })) } : null;
  game = createGame({ seed, night: n, scenario });
  window.__game = game;
  if (world) scene.remove(world.group);
  world = buildNight(n, MAPS[n], { bench: IS_BENCH });
  scene.add(world.group);
  clearViews();
  for (const l of game.lanterns) {
    const v = makeLantern(TUNING.lantern_cost);
    v.position.set(...l.pos);
    if (l.lit) v.userData.glow = 1;
    scene.add(v);
    views.lanterns.set(l.id, v);
  }
  camYaw = n === 3 ? 0 : 0;
  winFx = 0;
  lastSec = Infinity;
  windWarned = false;
  camPos.set(game.player.pos[0], 6, game.player.pos[2] - 10);
  sync(0, 0);
  screen = 'intro';
  card(`<div class="seal">${n}</div><div class="sub">Đêm ${n}</div><h1>${MAPS[n].name}</h1><div class="divider"></div>
    <p class="quote">Ông Đăng: “${NIGHT_LINES[n]}”</p>
    <p>${game.lanterns.length} Đèn Lồng Lớn · giữ ít nhất <b>${need()}</b> đèn sáng khi trời hửng · ${Math.round(MAPS[n].duration_s / 60 * 10) / 10} phút</p>
    <div class="menu"><button class="btn" id="b-go">Vào Đêm (Enter)</button></div>`);
  bind('b-go', play);
  if (params.has('autostart')) play();
}
function play() {
  screen = 'play';
  hideCard();
  $('hud').classList.remove('hidden');
  audio();
  startMusic();
}
function pauseGame() { screen = 'paused'; keys.clear(); openPause(); }
function openPause() {
  screen = 'paused';
  card(`<div class="sub">Tạm dừng</div><h1>${MAPS[night].name}</h1><div class="divider"></div>
    <div class="menu"><button class="btn" id="b-res">Tiếp tục</button><button class="btn ghost" id="b-restart">Chơi lại Đêm</button>
    <button class="btn ghost" id="b-set">Cài đặt</button><button class="btn ghost" id="b-menu">Về menu</button></div>`);
  bind('b-res', resumeGame);
  bind('b-restart', () => startNight(night));
  bind('b-set', () => openSettings(openPause));
  bind('b-menu', showMenu);
}
function resumeGame() { play(); }
function openSettings(back) {
  const prev = screen;
  screen = prev === 'paused' ? 'settings' : prev;
  card(`<div class="sub">Cài đặt</div><h1>Tùy chỉnh</h1><div class="divider"></div>
    <div class="row"><label for="s-vol">Âm lượng</label><input id="s-vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"><span id="v-vol">${Math.round(settings.volume * 100)}</span></div>
    <div class="row"><label for="s-sens">Độ nhạy chuột</label><input id="s-sens" type="range" min="0.2" max="3" step="0.1" value="${settings.sens}"><span id="v-sens">${settings.sens.toFixed(1)}</span></div>
    <div class="row"><label for="s-cb">Bảng màu dễ phân biệt</label><input id="s-cb" type="checkbox" ${settings.colorblind ? 'checked' : ''} style="width:22px;height:22px"><span>${settings.colorblind ? 'Bật' : 'Tắt'}</span></div>
    <p class="sub" style="letter-spacing:.05em">Được lưu cho lần mở game sau</p>
    <div class="menu"><button class="btn" id="b-back">Xong</button></div>`);
  $('s-vol').oninput = (e) => { settings.volume = Number(e.target.value); $('v-vol').textContent = Math.round(settings.volume * 100); saveSettings(); audio(); tone(660, 0.1, 'sine', 0.08); };
  $('s-sens').oninput = (e) => { settings.sens = Number(e.target.value); $('v-sens').textContent = settings.sens.toFixed(1); saveSettings(); };
  $('s-cb').onchange = (e) => { settings.colorblind = e.target.checked; e.target.nextElementSibling.textContent = settings.colorblind ? 'Bật' : 'Tắt'; saveSettings(); applyCB(); };
  bind('b-back', back);
}
function nightOver(result, reason) {
  stopMusic();
  const score = game.score;
  if (result === 'won') {
    won[night] = score;
    SFX.won();
    winFx = 5;
    if (night === 3) return setTimeout(showDawn, 1200);
    screen = 'result';
    card(`<div class="seal">勝</div><div class="sub">Đêm ${night} · ${MAPS[night].name}</div><h1>Đảo sáng tới bình minh</h1><div class="divider"></div>
      <p class="big">Điểm đêm: <b>${score}</b></p><p>Tổng điểm: <b>${Object.values(won).reduce((a, b) => a + b, 0)}</b></p>
      <div class="menu"><button class="btn" id="b-next">Đêm ${night + 1} (Enter)</button><button class="btn ghost" id="b-menu">Về menu</button></div>`);
    bind('b-next', () => startNight(night + 1));
    bind('b-menu', showMenu);
  } else {
    SFX.lost();
    screen = 'result';
    const why = { dawn: `Bình minh đã tới nhưng chưa đủ ${need()} đèn đang sáng…`, no_flames: 'Ngọn lửa của Mây đã tắt trong sương mực…' }[reason];
    card(`<div class="seal">夜</div><div class="sub">Đêm ${night} · ${MAPS[night].name}</div><h1>Đêm chưa qua</h1><div class="divider"></div>
      <p>${why}</p><p class="big">Điểm đêm: <b>${score}</b> (chỉ đêm thắng mới được cộng)</p>
      <div class="menu"><button class="btn" id="b-retry">Chơi lại Đêm ${night} (Enter / R)</button><button class="btn ghost" id="b-menu">Về menu</button></div>`);
    bind('b-retry', () => startNight(night));
    bind('b-menu', showMenu);
  }
}
function showDawn() {
  screen = 'dawn';
  const total = Object.values(won).reduce((a, b) => a + b, 0);
  card(`<div class="seal">曙</div><div class="sub">Bình Minh</div><h1>Ba đảo đã sáng</h1><div class="divider"></div>
    <p>Ông Đăng: “Con làm được rồi, Mây. Biển mây lại ánh vàng — từ nay các đảo không còn sợ đêm.”</p>
    <table class="nights">${[1, 2, 3].map((n) => `<tr><td>Đêm ${n} · ${MAPS[n].name}</td><td><b>${won[n] ?? '—'}</b></td></tr>`).join('')}</table>
    <p class="big">Tổng điểm: <b>${total}</b></p>
    <div class="menu"><button class="btn" id="b-menu">Về menu (Enter)</button></div>`);
  bind('b-menu', showMenu);
}

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
      shake = 0.3;
      burst(P.pos[0], P.pos[1] + 1.2, P.pos[2], 80, { speed: 8, up: 1.5, color: PALETTE.gold, life: 0.8, gravity: 0.5, ring: true });
    }
    if (e.name === 'dash') burst(P.pos[0], P.pos[1] + 0.6, P.pos[2], 24, { speed: 2, up: 1, color: PALETTE.robe, life: 0.5, gravity: 0 });
    if (e.name === 'player_hit') {
      shake = 0.5;
      burst(P.pos[0], P.pos[1] + 1, P.pos[2], 40, { speed: 4, up: 3, color: PALETTE.shadeRim, life: 0.8 });
      const v = $('vignette');
      v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit');
      $('h-flames').classList.remove('flash'); void $('h-flames').offsetWidth; $('h-flames').classList.add('flash');
      if (e.data.by === 'fall') banner('Mây rơi xuống biển mây!', true);
    }
    if (e.name === 'lantern_lit') {
      const l = views.lanterns.get(e.data.lantern_id);
      if (l) { l.userData.kick = 1; burst(l.position.x, l.position.y + 3.4, l.position.z, 150, { speed: 6, up: 9, color: PALETTE.lanternLit, life: 1.6, gravity: 5 }); }
      banner(`${e.data.lantern_id} — ${e.data.relight ? 'Thắp lại!' : 'Đèn đã sáng!'}`);
    }
    if (e.name === 'charm_picked') banner('Bùa Gió! Chạy nhanh, lướt không hồi chiêu');
    if (e.name === 'lantern_out') { banner(`${e.data.lantern_id} đã cạn dầu và tắt!`, true); const l = views.lanterns.get(e.data.lantern_id); if (l) burst(l.position.x, l.position.y + 3.4, l.position.z, 40, { speed: 2, up: 1, color: '#444a66', life: 1.2, gravity: -0.5 }); }
    if (e.name === 'refuel') { const l = views.lanterns.get(e.data.lantern_id); if (l) burst(l.position.x, l.position.y + 3.4, l.position.z, 30, { speed: 2, up: 3, color: PALETTE.lanternCore, life: 0.8 }); }
    if (e.name === 'fuel_drain') { const l = views.lanterns.get(e.data.lantern_id); if (l) burst(l.position.x, l.position.y + 3.4, l.position.z, 12, { speed: 1.5, up: 0.5, color: cb().shadeRim, life: 0.8, gravity: 0 }); }
    if (e.name === 'drifter_steal') banner(`Gió Lạc cướp ${e.data.amount} đom đóm!`, true);
    if (e.name === 'shade_spawned') banner('Bóng Mực trỗi dậy từ sương đen…', true);
    if (e.name === 'game_over') nightOver(e.data.result, e.data.reason);
  }
}

// ---------- per-frame sync ----------
const tmp = new THREE.Vector3();
const camPos = new THREE.Vector3(0, 6, -10);
let lastMay = [0, 0, 0], stride = 0, lastSec = Infinity, windWarned = false;
function syncMap(map, list, make, update, onRemove) {
  const seen = new Set();
  for (const e of list) {
    seen.add(e.id);
    let v = map.get(e.id);
    if (!v) { v = make(e); scene.add(v); map.set(e.id, v); }
    update(v, e);
  }
  for (const [id, v] of map) if (!seen.has(id)) { onRemove && onRemove(v); scene.remove(v); map.delete(id); }
}
function sync(t, dt) {
  if (!game) return;
  const P = game.player, ud = may.userData;
  may.position.set(...P.pos);
  const moved = Math.hypot(P.pos[0] - lastMay[0], P.pos[2] - lastMay[2]);
  lastMay = [...P.pos];
  let d = Math.atan2(P.facing[0], P.facing[1]) - may.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  may.rotation.y += d * 0.3;
  stride += moved * 2.2;
  ud.body.position.y = moved > 0.001 && P.grounded ? Math.abs(Math.sin(stride)) * 0.08 : 0;
  may.visible = !P.dead && !(P.invulnT > 0 && Math.floor(t * 12) % 2 === 0);
  ud.light.intensity = 3 + P.carried * 0.25;
  ud.aura.rotation.z = t * 0.8;
  ud.aura.material.opacity = (P.charmT > 0 ? 0.6 : 0.2) + (P.carried / TUNING.carry_capacity) * 0.3;
  for (const rb of ud.ribbons) {
    const pa = rb.geometry.attributes.position, base = rb.userData.base;
    for (let i = 0; i < pa.count; i++) {
      const y = base[i * 3 + 1], f = -y;
      pa.setZ(i, base[i * 3 + 2] - f * (0.35 + Math.min(moved * 6, 0.8)) + Math.sin(t * 7 + y * 4) * 0.08 * f);
    }
    pa.needsUpdate = true;
  }

  let lit = 0;
  for (const l of game.lanterns) {
    const u = views.lanterns.get(l.id).userData;
    if (l.lit) lit++;
    u.glow += ((l.lit ? 1 : 0) - u.glow) * (dt > 0 ? 0.05 : 1);
    u.paperMat.color.set(l.lit ? PALETTE.lanternLit : PALETTE.lanternOff);
    u.paperMat.emissive.set(PALETTE.lanternLit).multiplyScalar(u.glow * 1.6);
    u.core.material.opacity = u.glow;
    u.halo.material.opacity = 0.7 * u.glow;
    u.light.intensity = u.glow * 40;
    u.ring.material.opacity = l.lit && l.fuelU < 1800 ? 0 : 0.5 * u.glow; // weak lantern (fuel < 30) has no safe zone
    u.ring.rotation.z = t * 0.25;
    u.kick = Math.max(0, u.kick - dt * 0.4);
    u.pillar.material.opacity = u.glow * 0.08 + u.kick * 0.5;
    const cost = l.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
    u.orbs.forEach((o, i) => { o.visible = i < cost; o.material.color.set(i < l.deposited || l.lit ? PALETTE.moteCore : '#3a3f55'); });
    // Fuel (Ticket-03): bar while lit, slow 1 Hz blink when fuel < 30; unlit lanterns are squashed 20% and torn.
    const fuel = l.lit ? l.fuelU / 60 : 0;
    const low = l.lit && fuel < TUNING.low_fuel_threshold;
    const blinkOff = low && Math.floor(t * 2) % 2 === 1;
    u.bar.visible = l.lit && !blinkOff;
    u.bar.quaternion.copy(camera.quaternion);
    u.barFill.scale.x = Math.max(0.001, fuel / TUNING.fuel_max);
    u.barFill.material.color.set(low ? cb().uiDanger : PALETTE.lanternLit);
    if (blinkOff) { u.light.intensity *= 0.25; u.core.material.opacity *= 0.3; u.paperMat.emissive.multiplyScalar(0.3); }
    u.paper.scale.set(1, l.lit ? 1.2 : 1.2 * 0.8, 1);
    u.paper.position.y = l.lit ? 3.35 : 3.35 - 0.62 * 0.24;
    u.tear.visible = !l.lit;
  }
  const total = game.lanterns.length;
  hemi.intensity = ambientIntensity(lit, total); // falls again when a lantern runs out
  sky.uni.k.value += (lit / total - sky.uni.k.value) * (dt > 0 ? 0.02 : 1);
  scene.fog.density = 0.008 - sky.uni.k.value * 0.003;

  syncMap(views.motes, game.motes, makeMote, (v, m) => {
    const ph = m.pos[0] * 1.7 + m.pos[2];
    v.position.set(m.pos[0] + Math.sin(t * 1.3 + ph) * 0.15, m.pos[1] + 0.8 + Math.sin(t * 2.1 + ph) * 0.25, m.pos[2] + Math.cos(t * 1.1 + ph) * 0.15);
    const fast = m.kind === 'dropped' && m.ttl < 120 ? 14 : 7;
    v.userData.glow.scale.setScalar(0.8 + 0.3 * Math.sin(t * fast + ph));
  }, (v) => dt > 0 && burst(v.position.x, v.position.y, v.position.z, 14, { speed: 2, up: 2, color: PALETTE.moteHalo, life: 0.6, gravity: 1 }));

  syncMap(views.shades, game.shades, makeShade, (v, s) => {
    v.userData.drain = s.state === 'drain';
    const u = v.userData;
    v.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + u.ph) * 0.12, s.pos[2]);
    tmp.set(P.pos[0], v.position.y, P.pos[2]);
    v.lookAt(tmp);
    const st = s.state === 'stunned';
    u.mat.color.set(st ? PALETTE.shadeStunned : PALETTE.shadeBody);
    u.mat.emissiveIntensity = st ? 0.05 : 0.25;
    u.rim.material.opacity = s.state === 'spawning' ? 0.9 : st ? 0.15 : 0.5 + Math.sin(t * 4 + u.ph) * 0.1;
    u.eyeMat.color.set(st ? PALETTE.uiText : cb().shadeRim);
    u.rim.material.color.set(s.state === 'drain' ? cb().shadeRim : st ? PALETTE.shadeStunned : cb().shadeRim);
    u.mat.emissive.set(cb().shadeRim);
    const drainL = s.state === 'drain' && s.targetL ? s.targetL : null;
    u.tendril.visible = !!drainL;
    if (drainL) {
      const pa = u.tendril.geometry.attributes.position;
      pa.setXYZ(0, v.position.x, v.position.y, v.position.z);
      pa.setXYZ(1, drainL.pos[0], drainL.pos[1] + 3.35, drainL.pos[2]);
      pa.needsUpdate = true;
      u.tendril.material.color.set(cb().shadeRim);
      u.tendril.material.opacity = 0.6 + Math.sin(t * 10) * 0.3;
    }
    u.seal.visible = st;
    u.seal.rotation.z = t * 2;
    v.scale.setScalar(s.state === 'spawning' ? 0.5 : s.state === 'recoil' ? 0.85 : s.state === 'drain' ? 1 + Math.sin(t * 6) * 0.08 : 1);
  }, removeShadeView);

  syncMap(views.drifters, game.drifters.filter((x) => x.state !== 'removed'), makeDrifter, (v, dr) => {
    const u = v.userData;
    const prev = u.last || dr.pos;
    const dx = dr.pos[0] - prev[0], dz = dr.pos[2] - prev[2];
    if (Math.hypot(dx, dz) > 1e-4) v.rotation.y = Math.atan2(dx, dz);
    u.last = [...dr.pos];
    v.position.set(...dr.pos);
    const pa = u.ribbon.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const z = u.base[i * 3 + 2];
      pa.setY(i, u.base[i * 3 + 1] + Math.sin(t * 8 + z * 2) * 0.25);
      pa.setX(i, u.base[i * 3] + Math.sin(t * 5 + z * 1.5) * 0.2);
    }
    pa.needsUpdate = true;
    u.mat.opacity = dr.state === 'flee' ? 0.5 : 0.85;
    u.loot.children.forEach((m, i) => {
      m.visible = i < dr.stolen;
      m.position.set(Math.cos(t * 4 + i * 2.1) * 0.5, 0.3, Math.sin(t * 4 + i * 2.1) * 0.5);
    });
  });

  syncMap(views.charms, game.charms, makeCharm, (v, c) => {
    v.visible = c.available;
    v.position.set(...c.pos);
    v.userData.card.rotation.y = t * 1.5;
    v.userData.card.position.y = 1.1 + Math.sin(t * 2) * 0.15;
  });

  if (pulseFx < 1) {
    pulseFx = Math.min(1, pulseFx + dt * 1.8);
    const e = 1 - Math.pow(1 - pulseFx, 3);
    pulseCircle.position.set(P.pos[0], P.pos[1] + 0.12, P.pos[2]);
    pulseCircle.scale.setScalar(0.5 + e * TUNING.pulse_radius);
    pulseCircle.rotation.z = pulseFx * 3;
    pulseCircle.material.opacity = 1.1 * (1 - pulseFx);
    shock.position.set(P.pos[0], P.pos[1] + 0.8, P.pos[2]);
    shock.scale.setScalar(0.5 + Math.min(1, pulseFx * 1.6) * TUNING.pulse_radius);
    shock.material.opacity = Math.max(0, 1 - pulseFx * 1.6);
  } else pulseCircle.material.opacity = shock.material.opacity = 0;

  if (winFx > 0 && dt > 0) {
    winFx -= dt;
    if (Math.random() < dt * 3) {
      const a = Math.random() * TAU, r = 10 + Math.random() * 20;
      burst(P.pos[0] + Math.cos(a) * r, 18 + Math.random() * 10, P.pos[2] + Math.sin(a) * r, 110, { speed: 8, up: 3, color: [PALETTE.lanternLit, PALETTE.gold, PALETTE.lanternCore, PALETTE.scarf][Math.floor(Math.random() * 4)], life: 1.8, gravity: 2 });
    }
  }

  // Petals and wind leaves (warning 2 s before + during gusts).
  const W = game.wind;
  const windy = W.active || W.warn;
  const wd = W.dir === null ? [1, 0] : [Math.cos((W.dir * Math.PI) / 180), Math.sin((W.dir * Math.PI) / 180)];
  leaves.pts.material.opacity += ((windy ? 0.95 : 0) - leaves.pts.material.opacity) * 0.05;
  for (const [L, speed, fall] of [[petals, 1, 0.5], [leaves, windy ? (W.active ? 14 : 8) : 2, 0.2]]) {
    for (let i = 0; i < L.n; i++) {
      const o = i * 3;
      L.pos[o] += (L === leaves ? wd[0] * speed : 0.7 + Math.sin(t + i) * 0.4) * dt;
      L.pos[o + 1] -= fall * dt;
      L.pos[o + 2] += (L === leaves ? wd[1] * speed : Math.cos(t * 0.7 + i) * 0.5) * dt;
      if (L.pos[o + 1] < P.pos[1] - 2 || Math.hypot(L.pos[o] - P.pos[0], L.pos[o + 2] - P.pos[2]) > 45) {
        L.pos[o] = P.pos[0] + (Math.random() - 0.5) * 70 - wd[0] * (L === leaves ? 25 : 0);
        L.pos[o + 1] = P.pos[1] + 2 + Math.random() * 12;
        L.pos[o + 2] = P.pos[2] + (Math.random() - 0.5) * 70 - wd[1] * (L === leaves ? 25 : 0);
      }
    }
    L.pts.geometry.attributes.position.needsUpdate = true;
  }
  if (W.warn && !windWarned && dt > 0) { windWarned = true; SFX.wind(); banner('Gió lớn sắp tới — giữ chặt nón!', true); }
  if (!W.warn) windWarned = false;

  updateSparks(dt);
  world && world.update(t);

  // Camera.
  const th = (camYaw * Math.PI) / 180;
  tmp.set(P.pos[0] - Math.sin(th) * 9.5, P.pos[1] + 5.2, P.pos[2] - Math.cos(th) * 9.5);
  camPos.lerp(tmp, dt > 0 ? Math.min(1, dt * 8) : 1);
  shake = Math.max(0, shake - dt);
  camera.position.copy(camPos);
  if (shake > 0) camera.position.add(tmp.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
  camera.lookAt(P.pos[0], P.pos[1] + 1.4, P.pos[2]);
  sky.update(camera, t);

  hud(lit, total);
}

// ---------- HUD ----------
const fmt = (s) => { s = Math.max(0, Math.ceil(s - 1e-9)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const proj = new THREE.Vector3();
function hud(lit, total) {
  const P = game.player;
  const tl = timeLeft(game);
  $('h-flames').innerHTML = `<span class="lbl">Ngọn lửa</span>${Array.from({ length: Math.max(TUNING.flames, P.flames) }, (_, i) => `<i class="flame ${i < P.flames ? 'on' : ''}"></i>`).join('')}<span class="num">${P.flames}</span>`;
  $('h-clock').innerHTML = `<span class="lbl">Đêm ${night}</span><span class="num">${tl <= 30 && settings.colorblind ? '⚠ ' : ''}${fmt(tl)}</span>`;
  $('h-clock').classList.toggle('danger', tl <= 30);
  const n60 = need();
  $('h-right').innerHTML = `<span><span class="lbl">Đèn</span> <span class="num ${lit < n60 ? 'warn' : ''}">${lit < n60 && settings.colorblind ? '⚠ ' : ''}${lit}/${total}</span> <span class="lbl">cần ${n60}</span></span><span class="score num">${game.score}</span>`;
  const cap = capacity(P);
  $('h-motes').innerHTML = `<span class="lbl">Đom đóm</span>${Array.from({ length: cap }, (_, i) => `<i class="cell ${i < P.carried ? 'on' : ''}"></i>`).join('')}<span class="num">${P.carried}/${cap}</span>`;
  const dashP = P.charmT > 0 ? 0 : (P.dashCdT / 90) * 100;
  const pulseP = (P.pulseCdT / 180) * 100;
  const pulseOk = P.carried >= TUNING.pulse_cost;
  $('h-skills').innerHTML = `<div class="skill ${dashP > 0 ? 'off' : ''}"><div class="cd" style="--p:${dashP}%"></div><span class="key">⇧</span><span class="name">Lướt${P.charmT > 0 ? ' ∞' : ''}</span></div>
    <div class="skill ${pulseP > 0 || !pulseOk ? 'off' : ''}"><div class="cd" style="--p:${pulseOk ? pulseP : 100}%"></div><span class="key">F</span><span class="name">Tỏa sáng</span></div>`;
  // Countdown sound in the last 10 s.
  const sec = Math.ceil(tl);
  if (screen === 'play' && sec <= 10 && sec < lastSec && sec > 0) SFX.tick();
  lastSec = sec;
  // Lantern prompt.
  const near = game.lanterns.find((l) => (!l.lit || l.fuelU < 6000) && Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]) <= TUNING.interact_radius && Math.abs(l.pos[1] - P.pos[1]) <= 1.5);
  $('prompt').innerHTML = !near || game.state !== 'playing' ? ''
    : near.lit ? `<b>E</b> — Châm dầu (${Math.floor(near.fuelU / 60)}/100)`
    : `<b>E</b> — ${near.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${near.deposited}/${near.everLit ? TUNING.relight_cost : TUNING.lantern_cost})`;
  // Off-screen arrow to the nearest unlit lantern.
  const arrow = $('arrow');
  const target = game.lanterns.filter((l) => !l.lit || l.fuelU < 1800).sort((a, b) => Math.hypot(a.pos[0] - P.pos[0], a.pos[2] - P.pos[2]) - Math.hypot(b.pos[0] - P.pos[0], b.pos[2] - P.pos[2]))[0];
  arrow.style.display = 'none';
  if (target && game.state === 'playing') {
    proj.set(target.pos[0], target.pos[1] + 3.4, target.pos[2]).project(camera);
    const behind = proj.z > 1;
    let x = proj.x, y = proj.y;
    if (behind) { x = -x; y = -y; }
    if (behind || Math.abs(x) > 1 || Math.abs(y) > 1) {
      const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
      x /= m; y /= m;
      const W2 = innerWidth / 2, H2 = innerHeight / 2;
      const px = W2 + x * (W2 - 40), py = H2 - y * (H2 - 50);
      arrow.style.display = 'block';
      arrow.style.left = `${px - 14}px`;
      arrow.style.top = `${py - 13}px`;
      arrow.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
    }
  }
}

// ---------- loop (fixed 60 Hz sim, same as headless) ----------
let acc = 0, last = performance.now();
const perf = (window.__perf = { frames: 0, t0: performance.now(), fps: 0, samples: [] });
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (screen === 'play' && game.state === 'playing') {
    acc += dt * SPEED;
    const input = readInput();
    while (acc >= 1 / TICK_RATE && game.state === 'playing') {
      const wasGrounded = game.player.grounded;
      handleEvents(step(game, input));
      if (wasGrounded && !game.player.grounded && game.player.vel[1] > 6.5 && !game.player.launch) SFX.jump();
      if (wasGrounded && game.player.launch) SFX.dash();
      acc -= 1 / TICK_RATE;
    }
  } else if (screen === 'bench') {
    acc += dt;
    while (acc >= 1 / TICK_RATE) { step(game, BENCH_INPUT); acc -= 1 / TICK_RATE; }
  } else acc = 0;
  sync(now / 1000, dt);
  if (screen === 'bench') benchFrame(now);
  composer.render();
  perf.frames++;
  if (now - perf.t0 >= 1000) {
    perf.fps = (perf.frames * 1000) / (now - perf.t0);
    perf.samples.push(Math.round(perf.fps * 10) / 10);
    perf.frames = 0;
    perf.t0 = now;
  }
  requestAnimationFrame(frame);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---------- benchmark scene (Ticket-04 §1) ----------
const BENCH_INPUT = { move: [0, 0], cam_yaw_deg: 0 };
const benchState = (window.__bench = { phase: 'loading', first_frame_epoch_ms: null, dts: [], result: null });
let benchT0 = 0, benchPrev = 0;
function startBench() {
  const seed = Number(params.get('seed') || 42);
  const duration = Number(params.get('duration') || 30);
  night = 1;
  game = createGame({ seed, night: 1, scenario: benchScenario(seed), bench: true });
  window.__game = game;
  if (world) scene.remove(world.group);
  world = buildNight(1, MAPS[1], { bench: true });
  scene.add(world.group);
  clearViews();
  for (const l of game.lanterns) {
    const v = makeLantern(TUNING.lantern_cost);
    v.position.set(...l.pos);
    if (l.lit) v.userData.glow = 1;
    scene.add(v);
    views.lanterns.set(l.id, v);
  }
  petals.pts.visible = leaves.pts.visible = false; // creative extras off in the standard scene
  benchState.duration = duration;
  benchState.seed = seed;
  screen = 'bench';
  hideCard();
  $('hud').classList.remove('hidden');
}
function benchFrame(now) {
  if (benchState.first_frame_epoch_ms === null) {
    benchState.first_frame_epoch_ms = performance.timeOrigin + now;
    benchT0 = now;
    benchState.phase = 'warmup';
  }
  const t = (now - benchT0) / 1000;
  camera.position.set(...benchCamera(t));
  camera.lookAt(0, 0, 0);
  if (t >= BENCH.WARMUP_S) {
    if (benchState.phase === 'warmup') benchState.phase = 'measure';
    else benchState.dts.push(now - benchPrev);
    if (t >= BENCH.WARMUP_S + benchState.duration && benchState.phase === 'measure') {
      benchState.phase = 'done';
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      benchState.result = {
        ...benchStats(benchState.dts),
        renderer: `three.js r${THREE.REVISION} WebGL${renderer.capabilities.isWebGL2 ? '2' : '1'} + UnrealBloom · ${dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)} · ${navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] || navigator.userAgent}`,
        canvas: [renderer.domElement.width, renderer.domElement.height, devicePixelRatio],
        viewport: [innerWidth, innerHeight],
      };
    }
  }
  benchPrev = now;
}

window.__ui = { get screen() { return screen; }, get night() { return night; }, won, settings };
applyCB();
if (IS_BENCH) startBench();
else if (params.has('autostart')) startNight(Number(params.get('night')) || 1);
else showMenu();
requestAnimationFrame(frame);
