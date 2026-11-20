// 3D client: renders the shared deterministic sim (src/sim.js) and feeds it contract-shaped inputs.
// Everything here is presentation only — it never changes game rules, so headless output is unaffected.
import * as THREE from 'three';
import { createGame, step, TUNING, TICK_RATE, timeLeft } from '../src/sim.js';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const SPEED = Math.max(1, Math.min(8, Number(params.get('speed') || 1))); // debug/playtest only: sim steps per real tick

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const NIGHT = new THREE.Color('#1a0f2e');
const DAWNISH = new THREE.Color('#5a3a5e');
scene.background = NIGHT.clone();
scene.fog = new THREE.Fog(NIGHT.clone(), 14, 55);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
const ambient = new THREE.HemisphereLight('#8a6ac0', '#3a2a18', 0.9);
scene.add(ambient);
const moon = new THREE.DirectionalLight('#b9a6ff', 0.6);
moon.position.set(-20, 40, -10);
scene.add(moon);

// Island + sea of clouds.
const R = TUNING.island_radius;
const island = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.8, 6, 64), new THREE.MeshStandardMaterial({ color: '#4b3a2c', roughness: 1 }));
island.position.y = -3;
scene.add(island);
const grass = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshStandardMaterial({ color: '#3d4a2e', roughness: 1 }));
grass.rotation.x = -Math.PI / 2;
grass.position.y = 0.01;
scene.add(grass);
const clouds = new THREE.Mesh(new THREE.CircleGeometry(220, 48), new THREE.MeshBasicMaterial({ color: '#2b1d44' }));
clouds.rotation.x = -Math.PI / 2;
clouds.position.y = -5;
scene.add(clouds);
// A few decorative rocks/trees (fixed layout, visual only).
const deco = new THREE.Group();
const rockMat = new THREE.MeshStandardMaterial({ color: '#5b4b5f', roughness: 1 });
const treeMat = new THREE.MeshStandardMaterial({ color: '#2f3d2a', roughness: 1 });
for (let i = 0; i < 22; i++) {
  const a = i * 2.39996;
  const r = 30 + ((i * 7) % 8);
  const m = i % 3 === 0 ? new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + (i % 4) * 0.3), rockMat) : new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.5 + (i % 3), 7), treeMat);
  m.position.set(r * Math.cos(a), m.geometry.type === 'ConeGeometry' ? 1.8 : 0.4, r * Math.sin(a));
  deco.add(m);
}
scene.add(deco);

// ---------- player (Mây) ----------
function makeMay() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.0, 12), new THREE.MeshStandardMaterial({ color: '#c2483c' }));
  body.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), new THREE.MeshStandardMaterial({ color: '#f2cfa5' }));
  head.position.y = 1.22;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.42, 20), new THREE.MeshStandardMaterial({ color: '#e7cf8a' }));
  hat.position.y = 1.58;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), new THREE.MeshBasicMaterial({ color: '#222' }));
  string.position.set(0.5, 1.26, 0.2);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
  lamp.position.set(0.5, 1.07, 0.2);
  const light = new THREE.PointLight('#ffae55', 6, 12, 1);
  light.position.copy(lamp.position);
  g.add(body, head, hat, string, lamp, light);
  g.userData = { body, lamp, light };
  return g;
}
const may = makeMay();
scene.add(may);

// ---------- lanterns ----------
const lanternViews = new Map();
function makeLantern() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 3.2, 8), new THREE.MeshStandardMaterial({ color: '#3b2a1e' }));
  pole.position.y = 1.6;
  const shellMat = new THREE.MeshStandardMaterial({ color: '#5a3d30', emissive: '#000000' });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 10), shellMat);
  shell.position.y = 3.6;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.4, 10), new THREE.MeshStandardMaterial({ color: '#2a1a12' }));
  cap.position.y = 4.25;
  const light = new THREE.PointLight('#ffa040', 0, 30, 1);
  light.position.y = 3.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.12, TUNING.safe_radius, 64), new THREE.MeshBasicMaterial({ color: '#ffb35c', transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  const fill = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32, 1, 0, 0.0001), new THREE.MeshBasicMaterial({ color: '#ffd27a', side: THREE.DoubleSide }));
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.04;
  g.add(pole, shell, cap, light, ring, fill);
  g.userData = { shellMat, light, ring, fill, glow: 0 };
  return g;
}

// ---------- motes / shades ----------
const moteGeo = new THREE.SphereGeometry(0.13, 8, 6);
const moteMat = new THREE.MeshBasicMaterial({ color: '#ffe27a' });
const moteViews = new Map();
const shadeViews = new Map();
const shadeBodyGeo = new THREE.SphereGeometry(0.75, 16, 12);
function makeShade() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#2a0f3f', emissive: '#3b0d5c', emissiveIntensity: 0.6, roughness: 0.4, transparent: true, opacity: 0.92 });
  const body = new THREE.Mesh(shadeBodyGeo, mat);
  body.scale.set(1, 1.25, 1);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#c77dff' });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), eyeMat);
  const e2 = e1.clone();
  e1.position.set(-0.22, 0.25, 0.62);
  e2.position.set(0.22, 0.25, 0.62);
  g.add(body, e1, e2);
  g.userData = { mat, eyeMat };
  return g;
}

// Pulse VFX.
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2;
pulseRing.position.y = 0.1;
scene.add(pulseRing);
let pulseFx = 1;

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
const SFX = {
  mote_picked: () => tone(880 + Math.random() * 220, 0.12, 'triangle', 0.06),
  deposit: () => tone(523, 0.2, 'sine', 0.1),
  lantern_lit: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'sine', 0.1, i * 0.09)),
  pulse: () => tone(330, 0.4, 'sine', 0.12),
  player_hit: () => tone(140, 0.35, 'sawtooth', 0.08),
  shade_spawned: () => tone(98, 0.6, 'square', 0.03),
  won: () => [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.7, 'triangle', 0.09, i * 0.12)),
  lost: () => [330, 262, 196].forEach((f, i) => tone(f, 0.6, 'sine', 0.1, i * 0.2)),
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
function newGame() {
  const seed = params.has('seed') ? Number(params.get('seed')) : (Date.now() >>> 0) % 100000;
  const lit = Number(params.get('lit') || 0); // debug/screenshot only: pre-light first K lanterns
  const scenario = lit ? { lanterns: Array.from({ length: lit }, (_, i) => ({ id: `L${i + 1}`, lit: true })) } : null;
  game = createGame({ seed, night: 1, scenario });
  window.__game = game;
  for (const m of [lanternViews, moteViews, shadeViews]) {
    for (const v of m.values()) scene.remove(v);
    m.clear();
  }
  for (const l of game.lanterns) {
    const v = makeLantern();
    v.position.set(l.pos[0], l.pos[1], l.pos[2]);
    scene.add(v);
    lanternViews.set(l.id, v);
  }
  camYaw = 0;
  paused = !started;
  if (started) hideOverlay();
  sync(0);
}

function begin() {
  started = true;
  paused = false;
  hideOverlay();
  tone(660, 0.2, 'sine', 0.05);
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

function handleEvents(evs) {
  for (const e of evs) {
    SFX[e.name] && SFX[e.name]();
    if (e.name === 'pulse') pulseFx = 0;
    if (e.name === 'player_hit') {
      $('h-flames').classList.remove('flash');
      void $('h-flames').offsetWidth;
      $('h-flames').classList.add('flash');
    }
    if (e.name === 'game_over') {
      const won = e.data.result === 'won';
      SFX[won ? 'won' : 'lost']();
      const why = { all_lit: 'Mọi Đèn Lồng Lớn đã sáng lại!', dawn: 'Trời đã sáng mà đảo vẫn chưa đủ ánh đèn…', no_flames: 'Ngọn lửa của Mây đã tắt…' }[e.data.reason];
      showCard(`<h1>${won ? 'Chiến thắng!' : 'Thua rồi'}</h1><p>${why}</p><p>Điểm: <b>${game.score}</b></p><p>Nhấn <kbd>R</kbd> hoặc bấm vào đây để chơi lại</p>`);
    }
  }
}

// ---------- sync visuals with sim state ----------
const tmp = new THREE.Vector3();
function sync(t) {
  const P = game.player;
  may.position.set(P.pos[0], P.pos[1], P.pos[2]);
  const inp = readInput();
  if (inp.move[0] || inp.move[1]) {
    const th = (camYaw * Math.PI) / 180;
    const wx = inp.move[0] * Math.cos(th) + inp.move[1] * Math.sin(th);
    const wz = -inp.move[0] * Math.sin(th) + inp.move[1] * Math.cos(th);
    may.rotation.y = Math.atan2(wx, wz);
  }
  may.visible = !(P.invulnT > 0 && Math.floor(t * 12) % 2 === 0);
  may.userData.light.intensity = 5 + P.carried * 0.8;

  // Lanterns + island brightening.
  let litCount = 0;
  for (const l of game.lanterns) {
    const v = lanternViews.get(l.id);
    const u = v.userData;
    if (l.lit) litCount++;
    u.glow += ((l.lit ? 1 : 0) - u.glow) * 0.05;
    u.light.intensity = u.glow * 40;
    u.shellMat.emissive.setRGB(1.6 * u.glow, 0.9 * u.glow, 0.25 * u.glow);
    u.shellMat.color.set(l.lit ? '#ffb45a' : '#5a3d30');
    u.ring.material.opacity = 0.35 * u.glow;
    const frac = Math.min(1, l.deposited / TUNING.lantern_cost);
    if (u.frac !== frac) {
      u.frac = frac;
      u.fill.geometry.dispose();
      u.fill.geometry = new THREE.RingGeometry(0.75, 0.95, 32, 1, 0, Math.max(0.0001, frac * Math.PI * 2));
    }
  }
  const k = litCount / TUNING.lantern_count_night1;
  ambient.intensity = 0.9 + k * 1.2;
  scene.background.copy(NIGHT).lerp(DAWNISH, k * 0.6);
  scene.fog.color.copy(scene.background);
  scene.fog.far = 55 + k * 60;

  // Motes.
  const seen = new Set();
  for (const m of game.motes) {
    seen.add(m.id);
    let v = moteViews.get(m.id);
    if (!v) {
      v = new THREE.Mesh(moteGeo, moteMat);
      scene.add(v);
      moteViews.set(m.id, v);
    }
    const ph = m.pos[0] * 1.7 + m.pos[2];
    v.position.set(m.pos[0] + Math.sin(t * 1.3 + ph) * 0.15, 0.7 + Math.sin(t * 2.1 + ph) * 0.25, m.pos[2] + Math.cos(t * 1.1 + ph) * 0.15);
    v.scale.setScalar(0.8 + 0.35 * Math.sin(t * 6 + ph));
  }
  for (const [id, v] of moteViews) if (!seen.has(id)) { scene.remove(v); moteViews.delete(id); }

  // Shades.
  const seenS = new Set();
  for (const s of game.shades) {
    seenS.add(s.id);
    let v = shadeViews.get(s.id);
    if (!v) {
      v = makeShade();
      scene.add(v);
      shadeViews.set(s.id, v);
    }
    v.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + s.pos[0]) * 0.12, s.pos[2]);
    tmp.set(P.pos[0], v.position.y, P.pos[2]);
    v.lookAt(tmp);
    const st = s.state === 'stunned';
    v.userData.mat.color.set(st ? '#7d6a9e' : '#2a0f3f');
    v.userData.mat.opacity = st ? 0.55 : 0.92;
    v.userData.eyeMat.color.set(st ? '#ffffff' : '#c77dff');
  }
  for (const [id, v] of shadeViews) if (!seenS.has(id)) { scene.remove(v); shadeViews.delete(id); }

  // Pulse ring.
  if (pulseFx < 1) {
    pulseFx = Math.min(1, pulseFx + 0.04);
    pulseRing.position.set(P.pos[0], 0.1, P.pos[2]);
    pulseRing.scale.setScalar(0.5 + pulseFx * TUNING.pulse_radius);
    pulseRing.material.opacity = 0.8 * (1 - pulseFx);
  } else pulseRing.material.opacity = 0;

  // Camera: third person, behind Mây along forward (sin θ, cos θ).
  const th = (camYaw * Math.PI) / 180;
  camera.position.set(P.pos[0] - Math.sin(th) * 9, P.pos[1] + 5.5, P.pos[2] - Math.cos(th) * 9);
  camera.lookAt(P.pos[0], P.pos[1] + 1.2, P.pos[2]);

  // HUD.
  $('h-flames').innerHTML = `Lửa <b>${'🔥'.repeat(P.flames) || '0'}</b>`;
  $('h-carried').innerHTML = `Đom đóm <b>${P.carried}/${TUNING.carry_capacity}</b>`;
  $('h-lanterns').innerHTML = `Đèn <b>${litCount}/${TUNING.lantern_count_night1}</b>`;
  $('h-time').innerHTML = `Còn <b>${fmtTime(timeLeft(game))}</b>`;
  $('h-score').innerHTML = `Điểm <b>${game.score}</b>`;
  $('h-pulse').innerHTML = `Tỏa sáng <b>${P.pulseCdT > 0 ? 'hồi…' : P.carried >= TUNING.pulse_cost ? 'sẵn sàng' : `cần ${TUNING.pulse_cost} đom đóm`}</b>`;
  const near = game.lanterns.find((l) => !l.lit && Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]) <= TUNING.interact_radius);
  $('prompt').textContent = game.state !== 'playing' ? '' : near ? (P.carried > 0 ? `Nhấn E để nạp ánh sáng vào ${near.id} (${near.deposited}/${TUNING.lantern_cost})` : `${near.id} cần ${TUNING.lantern_cost - near.deposited} đom đóm`) : '';
}

// ---------- fixed-step loop (60 Hz, same as headless) ----------
let acc = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
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
  sync(now / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

newGame();
showCard(`<h1>Đảo Đèn Lồng</h1><p><b>Đêm 1 – Đảo Bến</b></p>
<p>Sương đen đã nuốt ánh sáng của đảo. Giúp Mây gom đom đóm và thắp lại <b>5 Đèn Lồng Lớn</b> trước khi trời sáng. Tránh Bóng Mực tím đen — chúng sợ ánh đèn!</p>
<p><kbd>WASD</kbd> đi · <kbd>Space</kbd> nhảy · <kbd>E</kbd> nạp đèn · <kbd>F</kbd> tỏa sáng · kéo chuột / <kbd>Q</kbd><kbd>Z</kbd> xoay camera</p>
<p>Nhấn <kbd>Enter</kbd> hoặc bấm để bắt đầu</p>`);
if (params.has('autostart')) begin();
requestAnimationFrame(frame);
