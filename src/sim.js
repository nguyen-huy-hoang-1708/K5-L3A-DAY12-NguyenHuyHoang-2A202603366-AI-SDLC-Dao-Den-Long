// Đảo Đèn Lồng — pure, deterministic game logic (Test Contract v1.0).
// Shared by the headless CLI (Node) and the 3D web client (browser).
// Rules: no Math.random, no Date, no DOM in this file.

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const TUNING = Object.freeze({
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.0,
  interact_radius: 2.5,
  pulse_cost: 2,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 2,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 1,
  safe_radius: 5,
  shade_speed: 3.5,
  shade_hit_radius: 1.0,
  fall_enabled: false,
  island_radius: 40,
  score: Object.freeze({
    per_mote: 10,
    per_lantern: 100,
    per_stun: 20,
    per_second_left: 1,
    per_flame_left: 50,
  }),
});

// Internal (non-contract) constants.
const JUMP_SPEED = 7;
const GRAVITY = 22;
const LANTERN_RING_R = 25;
const DEFAULT_MOTES = 30;
const MOTE_RESPAWN_S = 4;
const DEFAULT_SHADES = 2;
const SHADE_SPAWN_S = 30;
const MAX_SHADES = 6;
const SHADE_SPAWN_MIN_DIST = 20;
const SHADE_Y = 1.0;

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

const secToTicks = (s) => Math.round(s * TICK_RATE);
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const r3 = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return Object.is(x, -0) ? 0 : x;
};
const r3v = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}
function vec3(v, what) {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) {
    throw new ScenarioError(`${what} must be [x, y, z] numbers`);
  }
  return [v[0], v[1], v[2]];
}

function defaultLanterns() {
  const out = [];
  for (let i = 0; i < TUNING.lantern_count_night1; i++) {
    const a = (i * 2 * Math.PI) / TUNING.lantern_count_night1;
    out.push({
      id: `L${i + 1}`,
      pos: [r3(LANTERN_RING_R * Math.sin(a)), 0, r3(LANTERN_RING_R * Math.cos(a))],
      lit: false,
      deposited: 0,
    });
  }
  return out;
}

function clampToIsland(p) {
  const d = Math.hypot(p[0], p[2]);
  const R = TUNING.island_radius;
  if (d > R) {
    p[0] *= R / d;
    p[2] *= R / d;
  }
}

/**
 * Create a new game state.
 * @param {{seed:number, night?:number, scenario?:object}} opts
 */
export function createGame({ seed = 0, night = 1, scenario = null } = {}) {
  if (night !== 1) throw new Error(`night ${night} not available`);
  const rng = mulberry32(seed);
  const g = {
    rng,
    tick: 0,
    state: 'playing',
    result: null,
    score: 0,
    timeLeft0: TUNING.night1_duration_s,
    player: { pos: [0, 0, 0], vy: 0, carried: 0, flames: TUNING.flames, invulnT: 0, pulseCdT: 0 },
    lanterns: defaultLanterns(),
    shades: [],
    motes: [],
    randomMotes: true,
    randomShades: true,
    nextMote: 1,
    nextShade: 1,
    moteTimer: 0,
    shadeTimer: 0,
    prevButtons: { jump: false, interact: false, pulse: false, dash: false },
    events: [],
  };

  const sc = scenario || {};
  if (typeof sc !== 'object' || Array.isArray(sc)) throw new ScenarioError('scenario must be an object');

  if ('random_motes' in sc) {
    if (typeof sc.random_motes !== 'boolean') throw new ScenarioError('random_motes must be boolean');
    g.randomMotes = sc.random_motes;
  }
  if ('random_shades' in sc) {
    if (typeof sc.random_shades !== 'boolean') throw new ScenarioError('random_shades must be boolean');
    g.randomShades = sc.random_shades;
  }

  // Lanterns (update by id).
  if ('lanterns' in sc) {
    if (!Array.isArray(sc.lanterns)) throw new ScenarioError('lanterns must be an array');
    for (const l of sc.lanterns) {
      if (!l || typeof l !== 'object') throw new ScenarioError('lantern entry must be an object');
      const tgt = g.lanterns.find((x) => x.id === l.id);
      if (!tgt) throw new ScenarioError(`unknown lantern id ${l.id}`);
      if ('pos' in l) tgt.pos = vec3(l.pos, `lanterns.${l.id}.pos`);
      if ('deposited' in l) {
        if (!Number.isInteger(l.deposited) || l.deposited < 0) throw new ScenarioError('deposited must be int >= 0');
        tgt.deposited = l.deposited;
      }
      if ('lit' in l) {
        if (typeof l.lit !== 'boolean') throw new ScenarioError('lit must be boolean');
        tgt.lit = l.lit;
      }
    }
  }

  // Player.
  if ('player' in sc) {
    const p = sc.player;
    if (!p || typeof p !== 'object') throw new ScenarioError('player must be an object');
    if ('pos' in p) g.player.pos = vec3(p.pos, 'player.pos');
    if ('carried' in p) {
      if (!Number.isInteger(p.carried) || p.carried < 0) throw new ScenarioError('carried must be int >= 0');
      g.player.carried = p.carried;
    }
    if ('flames' in p) {
      if (!Number.isInteger(p.flames) || p.flames < 0) throw new ScenarioError('flames must be int >= 0');
      g.player.flames = p.flames;
    }
  }

  if ('time_left_s' in sc) {
    if (!isNum(sc.time_left_s)) throw new ScenarioError('time_left_s must be a number');
    g.timeLeft0 = sc.time_left_s;
  }

  // Motes.
  if ('motes' in sc) {
    if (!Array.isArray(sc.motes)) throw new ScenarioError('motes must be an array');
    sc.motes.forEach((m, i) => {
      const pos = vec3(Array.isArray(m) ? m : m && m.pos, `motes[${i}]`);
      g.motes.push({ id: `M${g.nextMote++}`, pos });
    });
  } else {
    for (let i = 0; i < DEFAULT_MOTES; i++) spawnMote(g);
  }

  // Shades.
  if ('shades' in sc) {
    if (!Array.isArray(sc.shades)) throw new ScenarioError('shades must be an array');
    const used = new Set();
    sc.shades.forEach((s, i) => {
      if (!s || typeof s !== 'object') throw new ScenarioError(`shades[${i}] must be an object`);
      const pos = vec3(s.pos, `shades[${i}].pos`);
      let id = s.id;
      if (id !== undefined && typeof id !== 'string') throw new ScenarioError('shade id must be a string');
      if (id !== undefined && used.has(id)) throw new ScenarioError(`duplicate shade id ${id}`);
      g.shades.push({ id, pos, state: 'chase', stunT: 0 });
      if (id) used.add(id);
    });
    for (const s of g.shades) if (!s.id) s.id = freshShadeId(g, used);
  } else {
    for (let i = 0; i < DEFAULT_SHADES; i++) spawnShade(g, false);
  }

  return g;
}

function freshShadeId(g, used) {
  let id;
  do id = `S${g.nextShade++}`;
  while ((used && used.has(id)) || g.shades.some((s) => s.id === id));
  if (used) used.add(id);
  return id;
}

function spawnMote(g) {
  // Uniform in disc of radius 36, keep 3 m away from lanterns.
  for (let tries = 0; tries < 50; tries++) {
    const r = Math.sqrt(g.rng()) * (TUNING.island_radius - 4);
    const a = g.rng() * 2 * Math.PI;
    const pos = [r3(r * Math.cos(a)), 0, r3(r * Math.sin(a))];
    if (g.lanterns.every((l) => distXZ(l.pos, pos) > 3) && Math.hypot(pos[0], pos[2]) > 2) {
      g.motes.push({ id: `M${g.nextMote++}`, pos });
      return;
    }
  }
}

function spawnShade(g, emit) {
  let pos = null;
  for (let tries = 0; tries < 50; tries++) {
    const a = g.rng() * 2 * Math.PI;
    const r = TUNING.island_radius - 2;
    const p = [r3(r * Math.cos(a)), SHADE_Y, r3(r * Math.sin(a))];
    pos = p;
    if (distXZ(p, g.player.pos) >= SHADE_SPAWN_MIN_DIST) break;
  }
  const id = freshShadeId(g);
  g.shades.push({ id, pos, state: 'chase', stunT: 0 });
  if (emit) g.events.push({ type: 'event', tick: g.tick, name: 'shade_spawned', data: { id } });
}

export function timeLeft(g) {
  return g.timeLeft0 - g.tick / TICK_RATE;
}

function emit(g, name, data) {
  g.events.push({ type: 'event', tick: g.tick, name, data });
}

function endGame(g, result, reason) {
  g.state = result;
  if (result === 'won') {
    const sc = TUNING.score;
    g.score += Math.floor(Math.max(0, timeLeft(g)) + 1e-9) * sc.per_second_left + g.player.flames * sc.per_flame_left;
  }
  emit(g, 'game_over', { result, reason });
}

/**
 * Advance one tick. `input` = {move:[x,z], cam_yaw_deg, jump, interact, pulse, dash}.
 * Returns the events produced in this step (stamped with the new tick).
 */
export function step(g, input) {
  g.events = [];
  if (g.state !== 'playing') return g.events;
  g.tick += 1;
  const P = g.player;
  const sc = TUNING.score;
  const edge = (k) => !!input[k] && !g.prevButtons[k];
  const jumpE = edge('jump');
  const interactE = edge('interact');
  const pulseE = edge('pulse');
  for (const k of ['jump', 'interact', 'pulse', 'dash']) g.prevButtons[k] = !!input[k];

  // Timers are integer tick counters (no float drift).
  if (P.invulnT > 0) P.invulnT -= 1;
  if (P.pulseCdT > 0) P.pulseCdT -= 1;

  // 1) Movement.
  let [mx, mz] = input.move || [0, 0];
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  P.pos[0] += wx * TUNING.player_speed * DT;
  P.pos[2] += wz * TUNING.player_speed * DT;
  clampToIsland(P.pos);

  // Jump (vertical only, display + feel; distances are XZ).
  const grounded = P.pos[1] <= 0 && P.vy <= 0;
  if (jumpE && grounded) P.vy = JUMP_SPEED;
  if (P.vy !== 0 || P.pos[1] > 0) {
    P.vy -= GRAVITY * DT;
    P.pos[1] += P.vy * DT;
    if (P.pos[1] <= 0) {
      P.pos[1] = 0;
      P.vy = 0;
    }
  }

  // 2) Pickup.
  for (let i = 0; i < g.motes.length && P.carried < TUNING.carry_capacity; ) {
    if (distXZ(g.motes[i].pos, P.pos) <= TUNING.pickup_radius) {
      g.motes.splice(i, 1);
      P.carried += 1;
      g.score += sc.per_mote;
      emit(g, 'mote_picked', { carried: P.carried });
    } else i++;
  }

  // 3) Interact: deposit into nearest unlit lantern in range.
  if (interactE && P.carried > 0) {
    let best = null;
    let bd = Infinity;
    for (const l of g.lanterns) {
      if (l.lit) continue;
      const d = distXZ(l.pos, P.pos);
      if (d <= TUNING.interact_radius && d < bd) {
        best = l;
        bd = d;
      }
    }
    if (best) {
      const amount = Math.min(P.carried, Math.max(0, TUNING.lantern_cost - best.deposited));
      if (amount > 0) {
        P.carried -= amount;
        best.deposited += amount;
        emit(g, 'deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      }
      if (best.deposited >= TUNING.lantern_cost) {
        best.lit = true;
        g.score += sc.per_lantern;
        emit(g, 'lantern_lit', { lantern_id: best.id });
        if (g.lanterns.every((l) => l.lit)) {
          endGame(g, 'won', 'all_lit');
          return g.events;
        }
      }
    }
  }

  // 4) Pulse.
  if (pulseE && P.pulseCdT <= 0 && P.carried >= TUNING.pulse_cost) {
    P.carried -= TUNING.pulse_cost;
    P.pulseCdT = secToTicks(TUNING.pulse_cooldown_s);
    const ids = [];
    for (const s of g.shades) {
      const d = distXZ(s.pos, P.pos);
      if (d <= TUNING.pulse_radius) {
        let dx = s.pos[0] - P.pos[0];
        let dz = s.pos[2] - P.pos[2];
        if (d < 1e-9) {
          dx = 1;
          dz = 0;
        } else {
          dx /= d;
          dz /= d;
        }
        s.pos[0] += dx * TUNING.pulse_push_m;
        s.pos[2] += dz * TUNING.pulse_push_m;
        clampToIsland(s.pos);
        s.state = 'stunned';
        s.stunT = secToTicks(TUNING.pulse_stun_s);
        ids.push(s.id);
        g.score += sc.per_stun;
      }
    }
    emit(g, 'pulse', { stunned_ids: ids });
  }

  // 5) Shades move.
  for (const s of g.shades) {
    if (s.state === 'stunned') {
      // Stunned for exactly pulse_stun_s * 60 states, then resumes chasing.
      if (s.stunT > 0) {
        s.stunT -= 1;
        continue;
      }
      s.state = 'chase';
    }
    const dx = P.pos[0] - s.pos[0];
    const dz = P.pos[2] - s.pos[2];
    const d = Math.hypot(dx, dz);
    const stepLen = Math.min(d, TUNING.shade_speed * DT);
    if (d > 1e-9) {
      s.pos[0] += (dx / d) * stepLen;
      s.pos[2] += (dz / d) * stepLen;
    }
    // Lit lanterns repel: shades cannot be inside safe_radius.
    for (const l of g.lanterns) {
      if (!l.lit) continue;
      const ex = s.pos[0] - l.pos[0];
      const ez = s.pos[2] - l.pos[2];
      const e = Math.hypot(ex, ez);
      if (e < TUNING.safe_radius) {
        const ux = e < 1e-9 ? 1 : ex / e;
        const uz = e < 1e-9 ? 0 : ez / e;
        s.pos[0] = l.pos[0] + ux * TUNING.safe_radius;
        s.pos[2] = l.pos[2] + uz * TUNING.safe_radius;
      }
    }
    clampToIsland(s.pos);
  }

  // 6) Hits.
  if (P.invulnT <= 0) {
    const hitter = g.shades.find((s) => s.state !== 'stunned' && distXZ(s.pos, P.pos) <= TUNING.shade_hit_radius);
    if (hitter) {
      P.flames = Math.max(0, P.flames - 1);
      const dropped = Math.floor(P.carried * TUNING.hit_drop_ratio + 1e-9);
      P.carried -= dropped;
      P.invulnT = secToTicks(TUNING.invuln_s);
      emit(g, 'player_hit', { by: 'shade', flames: P.flames, dropped });
      if (P.flames <= 0) {
        endGame(g, 'lost', 'no_flames');
        return g.events;
      }
    }
  }

  // 7) Spawning.
  if (g.randomMotes) {
    if (g.motes.length < DEFAULT_MOTES) {
      g.moteTimer += DT;
      if (g.moteTimer >= MOTE_RESPAWN_S - 1e-9) {
        g.moteTimer = 0;
        spawnMote(g);
      }
    } else g.moteTimer = 0;
  }
  if (g.randomShades && g.shades.length < MAX_SHADES) {
    g.shadeTimer += 1;
    if (g.shadeTimer >= SHADE_SPAWN_S * TICK_RATE) {
      g.shadeTimer = 0;
      spawnShade(g, true);
    }
  }

  // 8) Time.
  if (timeLeft(g) <= 1e-9) endGame(g, 'lost', 'dawn');
  return g.events;
}

export function snapshot(g) {
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.tick,
    state: g.state,
    time_left_s: r3(Math.max(0, timeLeft(g))),
    score: g.score,
    player: { pos: r3v(g.player.pos), flames: g.player.flames, carried: g.player.carried },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: r3v(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: r3v(s.pos), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: r3v(m.pos) })),
  };
}

export function contractTuning() {
  return JSON.parse(JSON.stringify(TUNING));
}
