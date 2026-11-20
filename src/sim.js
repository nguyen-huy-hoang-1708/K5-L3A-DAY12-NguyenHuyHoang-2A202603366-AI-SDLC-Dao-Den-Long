// Đảo Đèn Lồng — pure, deterministic game logic (Test Contract v1.2: Ticket-02 numbers + Ticket-03 lantern fuel).
// Shared by the headless CLI (Node) and the 3D web client (browser).
// Rules: no Math.random, no Date, no DOM in this file. All timers are integer tick counters.
import { MAPS } from './maps.js';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export { MAPS };

export const TUNING = Object.freeze({
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1.0,
  interact_radius: 2.0,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 240,
  night2_duration_s: 270,
  night3_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4.0,
  shade_hit_radius: 1.0,
  fall_enabled: true,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  relight_cost: 5,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  capacity_max: 20,
  score: Object.freeze({ per_mote: 5, per_lantern: 100, per_stun: 5, per_second_left: 0, per_flame_left: 50, per_relight: 40, per_stun_draining: 15, per_lit_lantern_at_dawn: 50 }),
});

// Standard constants not exposed in tuning (Ticket-02 Part 1).
export const K = Object.freeze({
  JUMP_V: 7, GRAVITY: 20, STEP: 0.35, PICK_DY: 1.5,
  DASH_T: 12, DASH_CD_T: 90, CHARM_SPEED: 7.2, CHARM_T: 600, CHARM_RESPAWN_T: 2700,
  PULSE_CD_T: 180, PULSE_CENTER_Y: 0.8, STUN_T: 120, PUSH_T: 15,
  INVULN_T: 90, RECOIL_T: 60, RECOIL_M: 2, DROP_TTL_T: 480, DROP_R0: 1.5, DROP_R1: 2.5,
  FALL_Y: -10, RESPAWN_T: 60, EVICT_T: 30,
  MOTE_START: 20, MOTE_CAP: 30, MOTE_EVERY: 240,
  SHADE_FIRST: 300, SHADE_MIN_DIST: 15, DETECT: 12, LOSE: 18, WANDER_SPEED: 1.5, SHADE_HOVER: 1.0,
  DRIFT_EVERY: 1200, DRIFT_MAX: 2, DRIFT_SPEED: 7, DRIFT_IDLE: 2, DRIFT_CHASE_N: 5, DRIFT_CHASE_R: 15,
  DRIFT_TOUCH: 1.2, DRIFT_STEAL: 3, DRIFT_FLEE_T: 240, DRIFT_DROP_REMOVE_T: 120, DRIFT_HOVER: 1.5,
  WIND_EVERY: 1800, WIND_T: 300, WIND_WARN_T: 120, WIND_SPEED: 2,
  // Ticket-03: fuel in integer units of 1/60 (1 unit per tick of decay).
  FUEL_MAX_U: 6000, FUEL_PER_MOTE_U: 600, LOW_U: 1800, DECAY_U: 1, DRAIN_U: 5, DRAIN_DIST: 2, DRAIN_CHASE: 6,
  DRAIN_EVENT_EVERY: 60, CAP_STEP: 2, CAP_MAX: 20,
});
export const capacity = (P) => Math.min(K.CAP_MAX, TUNING.carry_capacity + K.CAP_STEP * P.successful);
const fuelOut = (u) => Math.round((u / 60) * 10) / 10;

const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed'];

export class ScenarioError extends Error {}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const r3 = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return Object.is(x, -0) ? 0 : x;
};
const r3v = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isTicks = (v) => Number.isInteger(v) && v >= 0;
function vec3(v, what) {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) throw new ScenarioError(`${what} must be [x, y, z] numbers`);
  return [v[0], v[1], v[2]];
}
const idNum = (id) => {
  const m = /(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
};

export function timeLeft(g) {
  return g.timeLeft0 - g.simTick / TICK_RATE;
}
const groundOr0 = (g, x, z) => {
  const h = g.map.surface(x, z);
  return h === null ? 0 : h;
};

/**
 * Create a new game. opts: { seed, night (1..3), scenario }
 */
export function createGame({ seed = 0, night = 1, scenario = null, bench = false } = {}) {
  const map = MAPS[night];
  if (!map) throw new Error(`night ${night} not available (1, 2, 3)`);
  const sc = scenario || {};
  if (typeof sc !== 'object' || Array.isArray(sc)) throw new ScenarioError('scenario must be an object');
  const flag = (k, def) => {
    if (!(k in sc)) return def;
    if (typeof sc[k] !== 'boolean') throw new ScenarioError(`${k} must be boolean`);
    return sc[k];
  };
  const g = {
    night, map, rng: mulberry32(seed), bench: !!bench, // bench (Ticket-04): no spawns, damage, pickup, fuel loss or night end
    tick: 0, simTick: 0, state: 'playing', paused: false, score: 0,
    timeLeft0: map.duration_s,
    player: {
      pos: [...map.start], vel: [0, 0, 0], facing: [0, 1], grounded: true,
      carried: 0, flames: TUNING.flames,
      invulnT: 0, dashCdT: 0, pulseCdT: 0, charmT: 0, dashT: 0, dashDir: [0, 1], launch: null, respawnT: 0, dead: false, successful: 0,
    },
    lanterns: map.lanterns.map((p, i) => ({ id: `L${i + 1}`, pos: [...p], lit: false, deposited: 0, fuelU: 0, everLit: false, relit: 0 })),
    shades: [], drifters: [], motes: [], charms: [],
    randomMotes: flag('random_motes', true),
    randomShades: flag('random_shades', true),
    randomDrifters: flag('random_drifters', map.drifters),
    windEnabled: flag('wind_enabled', map.wind),
    wind: { active: false, dir: null, warn: false },
    nextMote: 1, nextShade: 1, nextDrifter: 1,
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    events: [],
  };

  if ('lanterns' in sc) {
    if (!Array.isArray(sc.lanterns)) throw new ScenarioError('lanterns must be an array');
    for (const l of sc.lanterns) {
      if (!l || typeof l !== 'object') throw new ScenarioError('lantern entry must be an object');
      const tgt = g.lanterns.find((x) => x.id === l.id);
      if (!tgt) throw new ScenarioError(`unknown lantern id ${l.id}`);
      if ('pos' in l) tgt.pos = vec3(l.pos, `lanterns.${l.id}.pos`);
      if ('deposited' in l) {
        if (!isTicks(l.deposited)) throw new ScenarioError('deposited must be int >= 0');
        tgt.deposited = l.deposited;
      }
      if ('lit' in l) {
        if (typeof l.lit !== 'boolean') throw new ScenarioError('lit must be boolean');
        tgt.lit = l.lit;
      }
      if ('fuel' in l && (!isNum(l.fuel) || l.fuel < 0)) throw new ScenarioError('fuel must be a number >= 0');
      if ('ever_lit' in l && typeof l.ever_lit !== 'boolean') throw new ScenarioError('ever_lit must be boolean');
      if ('relit_count' in l) {
        if (!isTicks(l.relit_count)) throw new ScenarioError('relit_count must be int >= 0');
        tgt.relit = l.relit_count;
      }
      if (tgt.lit) {
        tgt.fuelU = 'fuel' in l ? Math.min(K.FUEL_MAX_U, Math.round(l.fuel * 60)) : K.FUEL_MAX_U;
        tgt.everLit = 'ever_lit' in l ? l.ever_lit : true;
        if (tgt.fuelU <= 0) throw new ScenarioError(`lantern ${l.id} is lit but has no fuel`);
      } else {
        tgt.fuelU = 0;
        if ('ever_lit' in l) tgt.everLit = l.ever_lit;
      }
    }
  }

  const P = g.player;
  if ('player' in sc) {
    const p = sc.player;
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new ScenarioError('player must be an object');
    if ('pos' in p) P.pos = vec3(p.pos, 'player.pos');
    for (const [k, f] of [['carried', 'carried'], ['flames', 'flames'], ['invuln_ticks', 'invulnT'], ['dash_cd_ticks', 'dashCdT'], ['pulse_cd_ticks', 'pulseCdT'], ['charm_ticks', 'charmT'], ['successful_lights', 'successful']]) {
      if (k in p) {
        if (!isTicks(p[k])) throw new ScenarioError(`player.${k} must be int >= 0`);
        P[f] = p[k];
      }
    }
  }
  const top = map.surface(P.pos[0], P.pos[2]);
  P.grounded = top !== null && Math.abs(P.pos[1] - top) < 1e-6;

  if ('time_left_s' in sc) {
    if (!isNum(sc.time_left_s)) throw new ScenarioError('time_left_s must be a number');
    g.timeLeft0 = sc.time_left_s;
  }

  // Motes.
  if ('motes' in sc) {
    if (!Array.isArray(sc.motes)) throw new ScenarioError('motes must be an array');
    sc.motes.forEach((m, i) => {
      const obj = Array.isArray(m) ? { pos: m } : m;
      if (!obj || typeof obj !== 'object') throw new ScenarioError(`motes[${i}] must be [x,y,z] or {pos}`);
      const pos = vec3(obj.pos, `motes[${i}]`);
      const kind = obj.kind === undefined ? 'random' : obj.kind;
      if (kind !== 'random' && kind !== 'dropped') throw new ScenarioError(`motes[${i}].kind must be random|dropped`);
      let ttl = null;
      if (kind === 'dropped') {
        const t = obj.ttl_ticks === undefined ? K.DROP_TTL_T : obj.ttl_ticks;
        if (!isTicks(t)) throw new ScenarioError(`motes[${i}].ttl_ticks must be int >= 0`);
        ttl = t;
      }
      g.motes.push({ id: `M${g.nextMote++}`, pos, kind, ttl, born: -1 });
    });
  } else if (g.randomMotes) {
    const pts = map.motePoints.map((p, i) => i);
    for (let i = 0; i < K.MOTE_START && pts.length; i++) {
      const k = Math.floor(g.rng() * pts.length);
      const [idx] = pts.splice(k, 1);
      g.motes.push({ id: `M${g.nextMote++}`, pos: [...map.motePoints[idx]], kind: 'random', ttl: null, born: -1 });
    }
  }

  // Shades.
  if ('shades' in sc) {
    if (!Array.isArray(sc.shades)) throw new ScenarioError('shades must be an array');
    const used = new Set();
    sc.shades.forEach((s, i) => {
      if (!s || typeof s !== 'object') throw new ScenarioError(`shades[${i}] must be an object`);
      const pos = vec3(s.pos, `shades[${i}].pos`);
      if (s.id !== undefined && (typeof s.id !== 'string' || used.has(s.id))) throw new ScenarioError(`bad/duplicate shade id ${s.id}`);
      const state = s.state === undefined ? 'wander' : s.state;
      if (!SHADE_STATES.includes(state)) throw new ScenarioError(`shades[${i}].state must be one of ${SHADE_STATES.join(', ')}`);
      const tl = s.state_ticks_left === undefined ? { spawning: 1, stunned: K.STUN_T, recoil: K.RECOIL_T }[state] || 0 : s.state_ticks_left;
      if (!isTicks(tl)) throw new ScenarioError(`shades[${i}].state_ticks_left must be int >= 0`);
      const sh = newShade(g, s.id, pos, state, tl);
      if (state === 'recoil') sh.recoilDir = awayDir(P.pos, pos);
      if (s.target_lantern_id !== undefined) {
        sh.targetL = g.lanterns.find((l) => l.id === s.target_lantern_id) || null;
        if (!sh.targetL) throw new ScenarioError(`shades[${i}].target_lantern_id unknown`);
      }
      if (state === 'drain' && !sh.targetL) sh.targetL = nearestLantern(g, pos, (l) => l.lit);
      if (s.id) used.add(s.id);
      g.shades.push(sh);
    });
    for (const s of g.shades) if (!s.id) s.id = freshId(g, 'S', g.shades);
    for (const s of g.shades) s.n = idNum(s.id);
    g.nextShade = Math.max(g.nextShade, ...g.shades.map((s) => s.n + 1), 1);
  }

  // Drifters.
  if ('drifters' in sc) {
    if (!Array.isArray(sc.drifters)) throw new ScenarioError('drifters must be an array');
    sc.drifters.forEach((d, i) => {
      if (!d || typeof d !== 'object') throw new ScenarioError(`drifters[${i}] must be an object`);
      const pos = vec3(d.pos, `drifters[${i}].pos`);
      const state = d.state === undefined ? 'idle' : d.state;
      if (!DRIFTER_STATES.includes(state)) throw new ScenarioError(`drifters[${i}].state must be one of ${DRIFTER_STATES.join(', ')}`);
      const stolen = d.stolen === undefined ? 0 : d.stolen;
      if (!isTicks(stolen)) throw new ScenarioError(`drifters[${i}].stolen must be int >= 0`);
      const ticks = d.state_ticks_left !== undefined ? d.state_ticks_left : state === 'flee' ? K.DRIFT_FLEE_T : 0;
      if (!isTicks(ticks)) throw new ScenarioError(`drifters[${i}].state_ticks_left must be int >= 0`);
      g.drifters.push({ id: typeof d.id === 'string' ? d.id : undefined, pos, state, stolen, ticks, target: null, born: -1 });
    });
    for (const d of g.drifters) if (!d.id) d.id = freshId(g, 'D', g.drifters);
    for (const d of g.drifters) d.n = idNum(d.id);
    g.nextDrifter = Math.max(1, ...g.drifters.map((d) => d.n + 1));
  }

  // Charms.
  const charmSrc = 'charms' in sc ? sc.charms : map.charms;
  if (!Array.isArray(charmSrc)) throw new ScenarioError('charms must be an array');
  charmSrc.forEach((c, i) => {
    if (!c || typeof c !== 'object') throw new ScenarioError(`charms[${i}] must be an object`);
    const def = map.charms.find((m) => m.id === c.id);
    const pos = c.pos !== undefined ? vec3(c.pos, `charms[${i}].pos`) : def ? [...def.pos] : null;
    if (!pos) throw new ScenarioError(`charms[${i}] needs pos`);
    const available = c.available === undefined ? true : c.available;
    if (typeof available !== 'boolean') throw new ScenarioError(`charms[${i}].available must be boolean`);
    const rt = c.respawn_ticks === undefined ? (available ? 0 : K.CHARM_RESPAWN_T) : c.respawn_ticks;
    if (!isTicks(rt)) throw new ScenarioError(`charms[${i}].respawn_ticks must be int >= 0`);
    g.charms.push({ id: typeof c.id === 'string' ? c.id : `C${i + 1}`, pos, available, respawnT: available ? 0 : rt });
  });

  return g;
}

function freshId(g, prefix, list) {
  const key = { S: 'nextShade', D: 'nextDrifter' }[prefix];
  let id;
  do id = `${prefix}${g[key]++}`;
  while (list.some((x) => x.id === id));
  return id;
}

function newShade(g, id, pos, state, ticks) {
  return {
    id, n: id ? idNum(id) : 0, pos, hover: pos[1] - groundOr0(g, pos[0], pos[2]),
    state, ticks, pushT: 0, pushDir: [1, 0], recoilDir: [1, 0], evictT: 0, evictL: null, target: null, born: -1,
    targetL: null, drainT: 0,
  };
}

/** Nearest lantern (XZ) matching pred; ties -> lower id (array order). */
function nearestLantern(g, pos, pred) {
  let best = null;
  let bd = Infinity;
  for (const l of g.lanterns) {
    if (!pred(l)) continue;
    const d = distXZ(l.pos, pos);
    if (d < bd) {
      best = l;
      bd = d;
    }
  }
  return best;
}

function awayDir(from, to) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const d = Math.hypot(dx, dz);
  return d < 1e-9 ? [1, 0] : [dx / d, dz / d];
}

function emit(g, name, data) {
  g.events.push({ type: 'event', tick: g.tick, name, data });
}

function playerAlive(g) {
  return !g.player.dead;
}

// Move an entity horizontally; stops at lit-lantern safe zones (obstacles for shades).
function clampSafe(g, pos) {
  let hit = false;
  for (const l of g.lanterns) {
    if (!l.lit || l.fuelU < K.LOW_U) continue; // fuel < 30: no safe zone (exactly 30 keeps it)
    const d = distXZ(pos, l.pos);
    if (d < TUNING.safe_radius) {
      const [ux, uz] = awayDir(l.pos, pos);
      pos[0] = l.pos[0] + ux * TUNING.safe_radius;
      pos[2] = l.pos[2] + uz * TUNING.safe_radius;
      hit = true;
    }
  }
  return hit;
}

function moveToward(pos, target, maxStep) {
  const dx = target[0] - pos[0];
  const dz = target[2] - pos[2];
  const d = Math.hypot(dx, dz);
  if (d < 1e-9) return true;
  const s = Math.min(d, maxStep);
  pos[0] += (dx / d) * s;
  pos[2] += (dz / d) * s;
  return s >= d - 1e-9;
}

function addDropped(g, x, y, z) {
  g.motes.push({ id: `M${g.nextMote++}`, pos: [x, y, z], kind: 'dropped', ttl: K.DROP_TTL_T, born: g.tick });
}

function endGame(g, result, reason) {
  g.state = result;
  if (result === 'won') {
    const s = TUNING.score;
    for (const l of g.lanterns) if (l.lit) g.score += s.per_lit_lantern_at_dawn + Math.floor(l.fuelU / 60);
    g.score += g.player.flames * s.per_flame_left;
  }
  emit(g, 'game_over', { result, reason });
}

/**
 * Advance one tick. input = { move:[x,z], cam_yaw_deg, jump, interact, pulse, dash, pause }.
 * Returns the events produced in this tick.
 */
export function step(g, input) {
  g.events = [];
  if (g.state !== 'playing') return g.events;
  g.tick += 1;
  const P = g.player;
  const map = g.map;

  // 1) Input (pause first).
  const edge = {};
  for (const k of ['jump', 'interact', 'pulse', 'dash', 'pause']) {
    edge[k] = !!input[k] && !g.prev[k];
    g.prev[k] = !!input[k];
  }
  if (edge.pause) {
    g.paused = !g.paused;
    emit(g, g.paused ? 'paused' : 'resumed', {});
    if (g.paused) return g.events;
  }
  if (g.paused) return g.events;
  g.simTick += 1;

  // 2) Timers: cooldowns, invulnerability, stun, charm, dropped TTL, charm respawn, wind.
  for (const k of ['invulnT', 'dashCdT', 'pulseCdT', 'charmT', 'dashT', 'respawnT']) if (P[k] > 0) P[k] -= 1;
  for (const s of g.shades) {
    if (s.pushT > 0) s.pushT -= 1;
    if (s.state === 'stunned') {
      if (s.ticks > 0) s.ticks -= 1;
      if (s.ticks <= 0) {
        s.state = 'wander';
        s.target = null;
      }
    }
  }
  for (const d of g.drifters) if ((d.state === 'flee') && d.ticks > 0) d.ticks -= 1;
  for (let i = g.motes.length - 1; i >= 0; i--) {
    const m = g.motes[i];
    if (m.kind === 'dropped') {
      m.ttl -= 1;
      if (m.ttl <= 0) g.motes.splice(i, 1);
    }
  }
  for (const c of g.charms) {
    if (!c.available && c.respawnT > 0) {
      c.respawnT -= 1;
      if (c.respawnT <= 0) c.available = true;
    }
  }
  if (g.windEnabled) {
    const t = g.simTick;
    const ph = t % K.WIND_EVERY;
    if (ph === K.WIND_EVERY - K.WIND_WARN_T) {
      g.wind.dir = Math.floor(g.rng() * 360);
      g.wind.warn = true;
    }
    if (t >= K.WIND_EVERY && ph === 0) {
      g.wind.active = true;
      g.wind.warn = false;
    }
    if (g.wind.active && ph === K.WIND_T) g.wind.active = false;
  }

  // 2b) Lantern fuel: natural decay + draining shades; then lanterns at fuel <= 0 go out.
  for (const s of g.shades) {
    if (s.state === 'drain' && s.targetL && s.targetL.lit) s.drainT += 1;
    else s.drainT = 0;
  }
  for (const l of g.lanterns) {
    if (!l.lit || g.bench) continue;
    const drainers = g.shades.filter((s) => s.state === 'drain' && s.targetL === l).length;
    l.fuelU -= K.DECAY_U + K.DRAIN_U * drainers;
  }
  for (const s of [...g.shades].sort((a, b) => a.n - b.n)) {
    if (s.drainT > 0 && s.drainT % K.DRAIN_EVENT_EVERY === 0) {
      emit(g, 'fuel_drain', { lantern_id: s.targetL.id, shade_id: s.id, fuel: fuelOut(Math.max(0, s.targetL.fuelU)) });
    }
  }
  for (const l of g.lanterns) {
    if (l.lit && l.fuelU <= 0) {
      l.lit = false;
      l.fuelU = 0;
      l.deposited = 0;
      l.everLit = true;
      emit(g, 'lantern_out', { lantern_id: l.id });
    }
  }

  // 3) Player movement (jump, dash, launch pads, wind) then fall check.
  if (P.dead && P.respawnT <= 0) {
    P.dead = false;
    P.pos = [...map.start];
    P.vel = [0, 0, 0];
    P.facing = [0, 1];
    P.grounded = true;
    P.launch = null;
    P.dashT = 0;
    P.invulnT = K.INVULN_T;
  }
  if (!P.dead) {
    // Launch pads.
    if (P.grounded && !P.launch) {
      for (const pad of map.pads) {
        if (distXZ(P.pos, pad.pos) <= 1 && Math.abs(P.pos[1] - pad.pos[1]) < 0.05) {
          const dir = pad.dir ? pad.dir : (() => { const [ux, uz] = awayDir(pad.pos, pad.target); return [ux, uz]; })();
          P.launch = [dir[0] * pad.h, dir[1] * pad.h];
          P.vel[1] = pad.vy;
          P.grounded = false;
          break;
        }
      }
    }
    let [mx, mz] = input.move || [0, 0];
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-9) P.facing = [wx / wl, wz / wl];

    if (edge.dash && P.dashT === 0 && (P.charmT > 0 || P.dashCdT === 0)) {
      P.dashDir = wl > 1e-9 ? [wx / wl, wz / wl] : [...P.facing];
      P.dashT = K.DASH_T;
      if (P.charmT <= 0) P.dashCdT = K.DASH_CD_T;
      emit(g, 'dash', {});
    }
    if (edge.jump && P.grounded && P.dashT === 0) {
      P.vel[1] = K.JUMP_V;
      P.grounded = false;
    }
    const speed = P.charmT > 0 ? K.CHARM_SPEED : TUNING.player_speed;
    if (P.dashT > 0) {
      P.vel[0] = P.dashDir[0] * TUNING.dash_speed;
      P.vel[2] = P.dashDir[1] * TUNING.dash_speed;
    } else if (P.launch) {
      P.vel[0] = P.launch[0];
      P.vel[2] = P.launch[1];
    } else {
      P.vel[0] = wx * speed;
      P.vel[2] = wz * speed;
    }
    // Vertical (air dash holds altitude).
    if (!P.grounded && !(P.dashT > 0)) {
      P.vel[1] -= K.GRAVITY * DT;
      P.pos[1] += P.vel[1] * DT;
    }
    // Horizontal with walls (try XZ, then X, then Z).
    let windX = 0;
    let windZ = 0;
    if (g.wind.active && g.wind.dir !== null) {
      windX = Math.cos((g.wind.dir * Math.PI) / 180) * K.WIND_SPEED;
      windZ = Math.sin((g.wind.dir * Math.PI) / 180) * K.WIND_SPEED;
    }
    const dx = (P.vel[0] + windX) * DT;
    const dz = (P.vel[2] + windZ) * DT;
    const free = (x, z) => {
      const h = map.surface(x, z);
      return h === null || h <= P.pos[1] + K.STEP;
    };
    if (free(P.pos[0] + dx, P.pos[2] + dz)) {
      P.pos[0] += dx;
      P.pos[2] += dz;
    } else if (free(P.pos[0] + dx, P.pos[2])) P.pos[0] += dx;
    else if (free(P.pos[0], P.pos[2] + dz)) P.pos[2] += dz;
    // Ground.
    const top = map.surface(P.pos[0], P.pos[2]);
    if (P.grounded) {
      if (top === null || top < P.pos[1] - K.STEP) {
        P.grounded = false;
        P.vel[1] = 0;
      } else P.pos[1] = top;
    } else if (top !== null && P.pos[1] <= top && P.vel[1] <= 0) {
      P.pos[1] = top;
      P.vel[1] = 0;
      P.grounded = true;
      P.launch = null;
    }
    if (P.grounded) P.vel[1] = 0;
    // Fall off the island.
    if (P.pos[1] < K.FALL_Y) {
      const lost = P.carried;
      P.carried = 0;
      P.flames = Math.max(0, P.flames - 1);
      P.dead = true;
      P.respawnT = K.RESPAWN_T;
      P.vel = [0, 0, 0];
      P.launch = null;
      P.dashT = 0;
      emit(g, 'player_hit', { by: 'fall', flames: P.flames, dropped: 0, lost });
    }
  }

  // 4) Pick up motes and charms.
  if (!P.dead && !g.bench) {
    for (let i = 0; i < g.motes.length && P.carried < capacity(P); ) {
      const m = g.motes[i];
      if (m.born < g.tick && distXZ(m.pos, P.pos) <= TUNING.pickup_radius && Math.abs(P.pos[1] - m.pos[1]) <= K.PICK_DY) {
        g.motes.splice(i, 1);
        P.carried += 1;
        emit(g, 'mote_picked', { carried: P.carried });
      } else i++;
    }
    for (const c of g.charms) {
      if (c.available && distXZ(c.pos, P.pos) <= TUNING.pickup_radius && Math.abs(P.pos[1] - c.pos[1]) <= K.PICK_DY) {
        c.available = false;
        c.respawnT = K.CHARM_RESPAWN_T;
        P.charmT = K.CHARM_T;
        emit(g, 'charm_picked', { charm_id: c.id, charm_ticks: K.CHARM_T });
      }
    }
  }

  // 5) Interact with lanterns: light / relight an unlit one, or refuel a lit one that is not full.
  const newlyLit = [];
  if (!P.dead && edge.interact && P.carried > 0) {
    const best = nearestLantern(g, P.pos, (l) => (!l.lit || l.fuelU < K.FUEL_MAX_U) &&
      distXZ(l.pos, P.pos) <= TUNING.interact_radius && Math.abs(P.pos[1] - l.pos[1]) <= K.PICK_DY);
    if (best && !best.lit) {
      const cost = best.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
      const amount = Math.min(P.carried, Math.max(0, cost - best.deposited));
      if (amount > 0) {
        P.carried -= amount;
        best.deposited += amount;
        g.score += amount * TUNING.score.per_mote;
        emit(g, 'deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      }
      if (best.deposited >= cost) {
        const relight = best.everLit;
        best.lit = true;
        best.fuelU = K.FUEL_MAX_U;
        best.everLit = true;
        if (relight) best.relit += 1;
        P.successful += 1;
        g.score += relight ? TUNING.score.per_relight : TUNING.score.per_lantern;
        emit(g, 'lantern_lit', { lantern_id: best.id, relight });
        newlyLit.push(best);
      }
    } else if (best) {
      const used = Math.min(P.carried, Math.ceil((K.FUEL_MAX_U - best.fuelU) / K.FUEL_PER_MOTE_U));
      if (used > 0) {
        const before = best.fuelU;
        best.fuelU = Math.min(K.FUEL_MAX_U, best.fuelU + K.FUEL_PER_MOTE_U * used);
        P.carried -= used;
        g.score += used * TUNING.score.per_mote;
        emit(g, 'refuel', { lantern_id: best.id, amount: used, fuel: fuelOut(best.fuelU) });
        if (before < K.LOW_U && best.fuelU >= K.LOW_U) newlyLit.push(best); // safe zone restored
      }
    }
  }

  // 6) Safe zones: shades inside a just-lit (or refuelled back to >= 30) lantern are pushed out over <= 30 ticks.
  for (const l of newlyLit) {
    for (const s of g.shades) {
      if (distXZ(s.pos, l.pos) < TUNING.safe_radius) {
        s.evictT = K.EVICT_T;
        s.evictL = l;
        if (s.state === 'drain') {
          s.state = 'wander';
          s.drainT = 0;
        }
      }
    }
  }

  // 7) Pulse.
  if (!P.dead && edge.pulse && P.pulseCdT === 0 && P.carried >= TUNING.pulse_cost) {
    P.carried -= TUNING.pulse_cost;
    P.pulseCdT = K.PULSE_CD_T;
    const c = [P.pos[0], P.pos[1] + K.PULSE_CENTER_Y, P.pos[2]];
    const d3 = (p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
    const ids = [];
    for (const s of [...g.shades].sort((a, b) => a.n - b.n)) {
      if (s.born >= g.tick || d3(s.pos) > TUNING.pulse_radius) continue;
      g.score += s.state === 'drain' ? TUNING.score.per_stun_draining : TUNING.score.per_stun;
      s.state = 'stunned';
      s.ticks = K.STUN_T;
      s.pushT = K.PUSH_T;
      s.pushDir = awayDir(P.pos, s.pos);
      s.drainT = 0;
      ids.push(s.id);
    }
    for (const d of g.drifters) {
      if (d.born >= g.tick || d.state === 'removed' || d3(d.pos) > TUNING.pulse_radius) continue;
      if (d.state === 'chase') {
        d.state = 'flee';
        d.ticks = K.DRIFT_FLEE_T;
      } else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        const y = groundOr0(g, d.pos[0], d.pos[2]);
        for (let i = 0; i < amount; i++) addDropped(g, d.pos[0], y, d.pos[2]);
        d.stolen = 0;
        d.ticks = K.DRIFT_DROP_REMOVE_T;
        emit(g, 'drifter_drop', { drifter_id: d.id, amount });
      }
    }
    emit(g, 'pulse', { stunned_ids: ids });
  }

  // 8) Shades and drifters move.
  const shadeSpeed = map.shadeSpeed * DT;
  for (const s of g.shades) {
    const busy = s.state === 'recoil' || s.state === 'drain' || s.evictT > 0; // these replace normal AI for this tick
    if (s.evictT > 0) {
      const d = distXZ(s.pos, s.evictL.pos);
      const [ux, uz] = awayDir(s.evictL.pos, s.pos);
      const nd = d + Math.max(0, TUNING.safe_radius - d) / s.evictT;
      s.pos[0] = s.evictL.pos[0] + ux * nd;
      s.pos[2] = s.evictL.pos[2] + uz * nd;
      s.evictT -= 1;
    } else if (s.state === 'spawning') {
      s.ticks -= 1;
      if (s.ticks <= 0) s.state = 'wander';
    } else if (s.state === 'stunned') {
      if (s.pushT > 0) {
        s.pos[0] += s.pushDir[0] * (TUNING.pulse_push_m / K.PUSH_T);
        s.pos[2] += s.pushDir[1] * (TUNING.pulse_push_m / K.PUSH_T);
        if (clampSafe(g, s.pos)) s.pushT = 0;
      }
    } else if (s.state === 'drain') {
      const L = s.targetL;
      if (!P.dead && distXZ(s.pos, P.pos) <= K.DRAIN_CHASE) s.state = 'chase';
      else if (!L || !L.lit || L.fuelU >= K.LOW_U || distXZ(s.pos, L.pos) > K.DRAIN_DIST + 1e-9) s.state = 'wander'; // same tolerance as entering
    } else if (s.state === 'recoil') {
      s.pos[0] += s.recoilDir[0] * (K.RECOIL_M / K.RECOIL_T);
      s.pos[2] += s.recoilDir[1] * (K.RECOIL_M / K.RECOIL_T);
      clampSafe(g, s.pos);
      s.ticks -= 1;
      if (s.ticks <= 0) {
        s.state = 'wander';
        s.target = null;
      }
    }
    if (!busy && (s.state === 'wander' || s.state === 'chase') && s.born < g.tick) {
      const d = distXZ(s.pos, P.pos);
      if (s.state === 'wander' && !P.dead && d <= K.DETECT) s.state = 'chase';
      else if (s.state === 'chase' && (P.dead || d > K.LOSE)) {
        s.state = 'wander';
        s.target = null;
      }
      if (s.state === 'chase') moveToward(s.pos, P.pos, shadeSpeed);
      else {
        // Wander: nearest weak lit lantern (fuel < 30), else nearest unlit lantern; stop within 2 m.
        const weak = nearestLantern(g, s.pos, (l) => l.lit && l.fuelU < K.LOW_U);
        const goal = weak || nearestLantern(g, s.pos, (l) => !l.lit);
        s.targetL = goal;
        if (goal && distXZ(s.pos, goal.pos) > K.DRAIN_DIST) {
          const [ux, uz] = awayDir(s.pos, goal.pos);
          const step = Math.min(shadeSpeed, distXZ(s.pos, goal.pos) - K.DRAIN_DIST);
          s.pos[0] += ux * step;
          s.pos[2] += uz * step;
        }
        if (weak && distXZ(s.pos, weak.pos) <= K.DRAIN_DIST + 1e-9) {
          s.state = 'drain';
          s.drainT = 0;
        }
      }
      clampSafe(g, s.pos);
    }
    s.pos[1] = groundOr0(g, s.pos[0], s.pos[2]) + s.hover;
  }
  for (const d of g.drifters) {
    if (d.state === 'removed' || d.born >= g.tick) continue;
    const want = !P.dead && P.carried >= K.DRIFT_CHASE_N && distXZ(d.pos, P.pos) <= K.DRIFT_CHASE_R;
    if (d.state === 'idle' && want) d.state = 'chase';
    else if (d.state === 'chase' && !want) d.state = 'idle';
    if (d.state === 'chase') moveToward(d.pos, P.pos, K.DRIFT_SPEED * DT);
    else if (d.state === 'idle') {
      if (!d.target) d.target = map.motePoints[Math.floor(g.rng() * map.motePoints.length)];
      if (moveToward(d.pos, d.target, K.DRIFT_IDLE * DT)) d.target = null;
    } else if (d.state === 'flee') {
      const [ux, uz] = awayDir(P.pos, d.pos);
      d.pos[0] += ux * K.DRIFT_SPEED * DT;
      d.pos[2] += uz * K.DRIFT_SPEED * DT;
      if (d.ticks <= 0) d.state = 'removed';
    }
    d.pos[1] = groundOr0(g, d.pos[0], d.pos[2]) + K.DRIFT_HOVER;
  }

  // 9) Contacts: drifters steal first, then one shade hit (ascending id).
  if (!P.dead && !g.bench) {
    for (const d of [...g.drifters].sort((a, b) => a.n - b.n)) {
      if (d.state !== 'chase' || distXZ(d.pos, P.pos) > K.DRIFT_TOUCH) continue;
      const amount = Math.min(K.DRIFT_STEAL, P.carried);
      if (amount <= 0) continue;
      P.carried -= amount;
      d.stolen = amount;
      d.state = 'flee';
      d.ticks = K.DRIFT_FLEE_T;
      emit(g, 'drifter_steal', { drifter_id: d.id, amount, carried: P.carried });
    }
    if (P.invulnT <= 0) {
      const hitter = [...g.shades]
        .sort((a, b) => a.n - b.n)
        .find((s) => (s.state === 'wander' || s.state === 'chase') && s.evictT === 0 && s.born < g.tick &&
          distXZ(s.pos, P.pos) <= TUNING.shade_hit_radius && Math.abs(P.pos[1] - s.pos[1]) <= K.PICK_DY);
      if (hitter) {
        P.flames = Math.max(0, P.flames - 1);
        const dropped = Math.floor(P.carried / 2);
        P.carried -= dropped;
        for (let i = 0; i < dropped; i++) {
          const a = g.rng() * 2 * Math.PI;
          const r = K.DROP_R0 + g.rng() * (K.DROP_R1 - K.DROP_R0);
          const x = P.pos[0] + Math.cos(a) * r;
          const z = P.pos[2] + Math.sin(a) * r;
          const h = map.surface(x, z);
          addDropped(g, x, h === null ? P.pos[1] : h, z);
        }
        P.invulnT = K.INVULN_T;
        hitter.state = 'recoil';
        hitter.ticks = K.RECOIL_T;
        hitter.recoilDir = awayDir(P.pos, hitter.pos);
        emit(g, 'player_hit', { by: 'shade', flames: P.flames, dropped });
      }
    }
  }

  // 10) Scheduled spawns (new entities interact from the next tick).
  const t = g.simTick;
  if (g.bench) { /* no scheduled spawns in the bench scene */ } else if (g.randomMotes && t % K.MOTE_EVERY === 0 && g.motes.length < K.MOTE_CAP) {
    const empty = map.motePoints.filter((p) => !g.motes.some((m) => m.kind === 'random' && distXZ(m.pos, p) < 0.01 && Math.abs(m.pos[1] - p[1]) < 0.01));
    if (empty.length) {
      const p = empty[Math.floor(g.rng() * empty.length)];
      g.motes.push({ id: `M${g.nextMote++}`, pos: [...p], kind: 'random', ttl: null, born: g.tick });
    }
  }
  if (!g.bench && g.randomShades && t >= K.SHADE_FIRST && (t - K.SHADE_FIRST) % map.shadeEvery === 0) {
    const count = t === K.SHADE_FIRST ? 2 : 1;
    const taken = new Set();
    for (let i = 0; i < count && g.shades.length < map.shadeMax; i++) {
      const valid = map.shadePoints.filter((p, k) => !taken.has(k) && distXZ(p, P.pos) >= K.SHADE_MIN_DIST);
      if (!valid.length) break;
      const p = valid[Math.floor(g.rng() * valid.length)];
      taken.add(map.shadePoints.indexOf(p));
      const pos = [p[0], groundOr0(g, p[0], p[2]) + K.SHADE_HOVER, p[2]];
      const s = newShade(g, freshId(g, 'S', g.shades), pos, 'spawning', 1);
      s.n = idNum(s.id);
      s.born = g.tick;
      g.shades.push(s);
      emit(g, 'shade_spawned', { id: s.id });
    }
  }
  if (!g.bench && g.randomDrifters && t % K.DRIFT_EVERY === 0 && g.drifters.filter((d) => d.state !== 'removed').length < K.DRIFT_MAX) {
    const p = map.shadePoints[Math.floor(g.rng() * map.shadePoints.length)];
    const id = freshId(g, 'D', g.drifters);
    g.drifters.push({ id, n: idNum(id), pos: [p[0], groundOr0(g, p[0], p[2]) + K.DRIFT_HOVER, p[2]], state: 'idle', stolen: 0, ticks: 0, target: null, born: g.tick });
  }

  // 11) Win / lose.
  if (g.bench) return g.events;
  if (P.flames <= 0) endGame(g, 'lost', 'no_flames');
  else if (timeLeft(g) <= 1e-9) {
    const need = Math.ceil((g.lanterns.length * 6) / 10); // ceil(0.6 × total), exact integer arithmetic
    if (g.lanterns.filter((l) => l.lit).length >= need) endGame(g, 'won', 'dawn_survived');
    else endGame(g, 'lost', 'dawn');
  }
  return g.events;
}

export function nightStartEvent(g) {
  return { type: 'event', tick: g.tick, name: 'night_start', data: { night: g.night } };
}

export function snapshot(g) {
  const P = g.player;
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.simTick,
    night: g.night,
    state: g.state === 'playing' && g.paused ? 'paused' : g.state,
    time_left_s: r3(Math.max(0, timeLeft(g))),
    score: g.score,
    wind: { active: g.wind.active, dir_deg: g.wind.dir },
    player: {
      pos: r3v(P.pos), vel: r3v(P.vel), grounded: P.grounded,
      invuln: P.invulnT > 0, invuln_s: r3(P.invulnT / TICK_RATE),
      dash_cd_s: r3(P.dashCdT / TICK_RATE), pulse_cd_s: r3(P.pulseCdT / TICK_RATE), charm_s: r3(P.charmT / TICK_RATE),
      flames: P.flames, carried: P.carried, capacity: capacity(P),
      facing_deg: r3((Math.atan2(P.facing[1], P.facing[0]) * 180) / Math.PI), respawn_s: r3(P.respawnT / TICK_RATE),
    },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: r3v(l.pos), lit: l.lit, deposited: l.deposited, fuel: l.lit ? fuelOut(l.fuelU) : 0, ever_lit: l.everLit, relit_count: l.relit })),
    shades: g.shades.map((s) => ({ id: s.id, pos: r3v(s.pos), state: s.state, ticks_left: s.state === 'stunned' || s.state === 'recoil' || s.state === 'spawning' ? s.ticks : 0, target_lantern_id: s.targetL ? s.targetL.id : null })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: r3v(m.pos), kind: m.kind, ttl_s: m.kind === 'dropped' ? r3(m.ttl / TICK_RATE) : null })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: r3v(d.pos), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: r3(c.respawnT / TICK_RATE), pos: r3v(c.pos) })),
  };
}

export function contractTuning() {
  return JSON.parse(JSON.stringify(TUNING));
}
