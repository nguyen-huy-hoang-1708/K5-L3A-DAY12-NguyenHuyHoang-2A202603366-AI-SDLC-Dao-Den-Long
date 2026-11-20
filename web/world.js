// Static scenery for the 3 standard maps + procedural textures. Presentation only (never read by the sim).
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const TAU = Math.PI * 2;
let vs = 1234567;
export const vrand = () => ((vs = (vs * 16807) % 2147483647) / 2147483647);
export const resetVrand = (s = 1234567) => (vs = s);

// ---------- textures ----------
function canvasTex(size, draw, w = size) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = size;
  draw(c.getContext('2d'), size, w);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const glowTex = canvasTex(128, (x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,.65)');
  g.addColorStop(0.5, 'rgba(255,255,255,.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
});
export const runeTex = canvasTex(512, (x, s) => {
  const c = s / 2;
  x.translate(c, c);
  x.strokeStyle = x.fillStyle = '#ffe3a0';
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
      if ((i >> b) & 1) { x.fillRect(-0.11 * c, y, 0.085 * c, 0.035 * c); x.fillRect(0.025 * c, y, 0.085 * c, 0.035 * c); }
      else x.fillRect(-0.11 * c, y, 0.22 * c, 0.035 * c);
    }
    x.restore();
  }
  x.lineWidth = 2.5;
  for (const rot of [0, Math.PI / 4]) { x.save(); x.rotate(rot); x.strokeRect(-0.38 * c, -0.38 * c, 0.76 * c, 0.76 * c); x.restore(); }
});
export const cloudTex = canvasTex(512, (x, s) => {
  for (let i = 0; i < 140; i++) {
    const px = vrand() * s, py = vrand() * s, r = 20 + vrand() * 70;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(255,255,255,${0.12 + vrand() * 0.18})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { x.save(); x.translate(ox, oy); x.fillRect(px - r, py - r, 2 * r, 2 * r); x.restore(); }
  }
});
export const petalTex = canvasTex(64, (x, s) => {
  x.translate(s / 2, s / 2); x.rotate(0.6);
  x.fillStyle = 'rgba(255,190,210,0.95)';
  x.beginPath(); x.ellipse(0, 0, s * 0.42, s * 0.22, 0, 0, TAU); x.fill();
});
export const leafTex = canvasTex(64, (x, s) => {
  x.translate(s / 2, s / 2); x.rotate(-0.5);
  x.fillStyle = 'rgba(160,200,120,0.95)';
  x.beginPath(); x.ellipse(0, 0, s * 0.45, s * 0.18, 0, 0, TAU); x.fill();
});
// Bùa Gió: red talisman with gold border and a wind glyph (drawn, not text).
export const talismanTex = canvasTex(128, (x, h, w) => {
  x.fillStyle = PALETTE.charm;
  x.fillRect(0, 0, w, h);
  x.strokeStyle = PALETTE.gold;
  x.lineWidth = 6;
  x.strokeRect(5, 5, w - 10, h - 10);
  x.lineWidth = 2;
  x.strokeRect(12, 12, w - 24, h - 24);
  x.lineWidth = 5;
  x.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    x.beginPath();
    const y = 34 + i * 26;
    x.moveTo(16, y);
    x.bezierCurveTo(28, y - 14, 40, y + 14, 50, y - 2);
    x.stroke();
  }
}, 64);
cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;

// ---------- shared materials ----------
export const MAT = {
  grass: new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.95 }),
  sand: new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.8 }),
  rock: new THREE.MeshStandardMaterial({ color: '#3b3a4e', roughness: 1, flatShading: true }),
  stone: new THREE.MeshStandardMaterial({ color: '#77748a', roughness: 0.85 }),
  pine: new THREE.MeshStandardMaterial({ color: '#1f4a3c', roughness: 0.9, flatShading: true }),
  blossom: new THREE.MeshStandardMaterial({ color: '#e9a3bd', roughness: 0.8, flatShading: true }),
  roof: new THREE.MeshStandardMaterial({ color: '#25344a', roughness: 0.6, flatShading: true }),
  lacquer: new THREE.MeshStandardMaterial({ color: '#8e2a22', roughness: 0.5 }),
  gold: new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.7, roughness: 0.35, emissive: '#4a3000', emissiveIntensity: 0.4 }),
};

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

// ---------- sky, stars, moon, peaks, cloud sea (shared by all nights) ----------
export function buildSky(scene) {
  const uni = { top: { value: new THREE.Color(PALETTE.sky) }, hor: { value: new THREE.Color(PALETTE.fog) }, k: { value: 0 } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: uni,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 top, hor; uniform float k; varying vec3 vP;
        void main(){ vec3 warm = vec3(1.0, 0.70, 0.28);
          vec3 hz = mix(hor, warm, k * 0.35);
          gl_FragColor = vec4(mix(hz, top, smoothstep(-0.02, 0.45, vP.y)), 1.0); }`,
    }),
  );
  const starGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(1400 * 3);
  for (let i = 0; i < 1400; i++) {
    const u = vrand() * TAU, cy = 0.1 + vrand() * 0.9, sy = Math.sqrt(1 - cy * cy);
    sp.set([560 * sy * Math.cos(u), 560 * cy, 560 * sy * Math.sin(u)], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#fff6e0', size: 1.5, sizeAttenuation: false, fog: false }));
  const MOON = new THREE.Vector3(-0.45, 0.42, -0.79).normalize();
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff6dc', fog: false, depthWrite: false }));
  moon.scale.setScalar(60);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#8fa3d8', fog: false, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(220);
  scene.add(sky, stars, halo, moon);
  // Peaks rising from the sea of clouds.
  const peaks = new THREE.Group();
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU + vrand() * 0.1, dist = 130 + vrand() * 170, h = 50 + vrand() * 120;
    const m = new THREE.Mesh(jagged(new THREE.ConeGeometry(10 + vrand() * 16, h, 6, 4), 0.35),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#0c1128').lerp(new THREE.Color(PALETTE.fog), (dist - 130) / 170) }));
    m.position.set(Math.cos(a) * dist, -30 + h / 2, Math.sin(a) * dist);
    peaks.add(m);
  }
  scene.add(peaks);
  const clouds = [];
  for (const [y, op, sc] of [[-9, 0.5, 5], [-15, 0.65, 3.5], [-24, 0.9, 2.5]]) {
    const map = cloudTex.clone();
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(sc, sc);
    map.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.CircleGeometry(520, 48), new THREE.MeshBasicMaterial({ map, color: PALETTE.cloudSea, transparent: true, opacity: op, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    clouds.push(m);
    scene.add(m);
  }
  return {
    uni,
    update(camera, t) {
      sky.position.copy(camera.position);
      stars.position.copy(camera.position);
      moon.position.copy(camera.position).addScaledVector(MOON, 520);
      halo.position.copy(moon.position);
      clouds.forEach((c, i) => {
        c.material.map.offset.x = t * (0.004 + i * 0.002);
        c.material.map.offset.y = t * 0.002 * (i % 2 ? -1 : 1);
      });
    },
  };
}

// ---------- island pieces ----------
function disc(cx, cz, r, top = 0, depth = 30) {
  const g = new THREE.Group();
  const grass = new THREE.Mesh(new THREE.CircleGeometry(r - 1.6, 72), MAT.grass);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(cx, top + 0.02, cz);
  const sand = new THREE.Mesh(new THREE.RingGeometry(r - 1.6, r, 72), MAT.sand);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(cx, top + 0.015, cz);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r, r - 0.6, 2, 72, 1, true), MAT.rock);
  rim.position.set(cx, top - 1, cz);
  const under = new THREE.Mesh(jagged(new THREE.ConeGeometry(r - 0.6, depth, 36, 6, true), 0.2), MAT.rock);
  under.rotation.x = Math.PI;
  under.position.set(cx, top - 2 - depth / 2, cz);
  g.add(grass, sand, rim, under);
  return g;
}
function padMesh(x, y, z) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.16, 24), MAT.stone);
  base.position.set(x, y + 0.08, z);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ map: runeTex, color: '#9fe1ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(x, y + 0.18, z);
  g.add(base, glow);
  g.userData.spin = glow;
  return g;
}
function makePine(s) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.25 * s, 1.6 * s, 6), MAT.wood);
  trunk.position.y = 0.8 * s;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry((1.6 - i * 0.4) * s, 1.6 * s, 7), MAT.pine);
    c.position.y = (1.6 + i * 0.9) * s;
    g.add(c);
  }
  return g;
}
function makeBlossom(s) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.28 * s, 2.4 * s, 6), MAT.wood);
  trunk.position.y = 1.2 * s;
  g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry((0.9 + vrand() * 0.5) * s, 0), MAT.blossom);
    b.position.set((vrand() - 0.5) * 2 * s, (2.5 + vrand() * 1.1) * s, (vrand() - 0.5) * 2 * s);
    g.add(b);
  }
  return g;
}
function makePagoda(levels) {
  const g = new THREE.Group();
  let y = 0.6;
  const base = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 4), MAT.stone);
  base.position.y = 0.3;
  g.add(base);
  for (let i = 0; i < levels; i++) {
    const w = 2.5 - i * 0.4;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 1.3, w), MAT.lacquer);
    body.position.y = y + 0.65;
    const r = new THREE.Mesh(new THREE.ConeGeometry(w * 1.05, 0.9, 4), MAT.roof);
    r.rotation.y = Math.PI / 4;
    r.position.y = y + 1.75;
    g.add(body, r);
    y += 1.55;
  }
  return g;
}
/** Scatter decor on a ring of a disc island, keeping clear of the given points. */
function decorate(group, cx, cz, r0, r1, n, avoid) {
  for (let i = 0; i < n; i++) {
    const a = vrand() * TAU, r = r0 + vrand() * (r1 - r0);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (avoid.some((p) => Math.hypot(p[0] - x, p[2] - z) < 4)) continue;
    const kind = vrand();
    const o = kind < 0.45 ? makePine(0.8 + vrand() * 0.6) : kind < 0.8 ? makeBlossom(0.8 + vrand() * 0.5) : new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + vrand() * 0.7), MAT.rock);
    o.position.set(x, o.isMesh ? 0.3 : 0, z);
    o.rotation.y = vrand() * TAU;
    group.add(o);
  }
}

/** Build the static world of a night from its standard map. */
export function buildNight(night, map) {
  resetVrand(1000 + night);
  const g = new THREE.Group();
  const pads = [];
  const avoid = [...map.lanterns, ...map.motePoints, ...map.pads.map((p) => p.pos), ...map.charms.map((c) => c.pos)];
  if (night === 1) {
    g.add(disc(0, 0, 40));
    decorate(g, 0, 0, 35.5, 38.5, 40, avoid);
    for (const a of [36, 108, 180, 252, 324]) {
      const p = makePagoda(3);
      const rad = (a * Math.PI) / 180;
      p.position.set(Math.cos(rad) * 36, 0, Math.sin(rad) * 36);
      g.add(p);
    }
  } else if (night === 2) {
    g.add(disc(0, 0, 28), disc(70, 0, 28));
    // Bamboo bridge x 26..44, z -2..2 (no railing).
    const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.25, 4), MAT.wood);
    deck.position.set(35, -0.125, 0);
    g.add(deck);
    for (let x = 26.5; x < 44; x += 0.9) {
      const slat = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4, 6), new THREE.MeshStandardMaterial({ color: '#8a6a3c' }));
      slat.rotation.x = Math.PI / 2;
      slat.position.set(x, 0.05, 0);
      g.add(slat);
    }
    decorate(g, 0, 0, 23.5, 26.5, 22, avoid);
    decorate(g, 70, 0, 23.5, 26.5, 22, avoid);
  } else {
    g.add(disc(0, 0, 45));
    // Tier 1: half ring 12-24 m, z > 0, height 3 (vertical walls).
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 24, Math.PI, TAU, false);
    shape.absarc(0, 0, 12, TAU, Math.PI, true);
    const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 48 }), MAT.stone);
    t1.rotation.x = -Math.PI / 2;
    const t1top = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), MAT.grass);
    t1top.rotation.x = -Math.PI / 2;
    t1top.position.y = 3.02;
    g.add(t1, t1top);
    // Tier 2: disc r 8, height 6.
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), MAT.stone);
    t2.position.y = 3;
    const t2top = new THREE.Mesh(new THREE.CircleGeometry(8, 48), MAT.grass);
    t2top.rotation.x = -Math.PI / 2;
    t2top.position.y = 6.02;
    g.add(t2, t2top);
    // Bell tower r 2, 8 m tall on tier 2.
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 24), MAT.lacquer);
    tower.position.y = 10;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.2, 8), MAT.roof);
    roof.position.y = 15.1;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12, 0, TAU, 0, Math.PI / 1.6), MAT.gold);
    bell.position.y = 13.4;
    bell.rotation.x = Math.PI;
    g.add(tower, roof, bell);
    // Ramps at 30° and 150°: radius 30 (Y=0) up to 24 (Y=3), 3 m wide.
    for (const deg of [30, 150]) {
      const a = (deg * Math.PI) / 180;
      const len = Math.hypot(6, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 3), MAT.wood);
      ramp.position.set(27 * Math.cos(a), 1.35, 27 * Math.sin(a));
      ramp.rotation.order = 'YXZ';
      ramp.rotation.y = -a;
      ramp.rotation.z = -Math.atan2(3, 6); // outer end (r = 30) low, inner end (r = 24) high
      g.add(ramp);
    }
    decorate(g, 0, 0, 38, 43, 34, avoid);
  }
  for (const p of map.pads) {
    const m = padMesh(p.pos[0], p.pos[1], p.pos[2]);
    pads.push(m);
    g.add(m);
  }
  return { group: g, update: (t) => pads.forEach((p) => (p.userData.spin.rotation.z = t * 2)) };
}
