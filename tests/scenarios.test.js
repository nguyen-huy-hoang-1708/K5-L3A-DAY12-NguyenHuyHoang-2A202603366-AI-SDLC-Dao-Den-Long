// Headless scenarios run through the real CLI (Test Contract v1.2: Ticket-02 numbers + Ticket-03 fuel rules).
// Phase 1/2 criteria kept; tests changed by Ticket-03 are updated with the reason in docs/notes/phase-3.md §1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScenario, events, snaps, end, snapAt } from './helpers.js';

const XZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const near = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;

// ---------- Phase 1 behaviour (regression, standard numbers) ----------

test('AC1 idle: night_start first, exact tick count, time_left, end line last', () => {
  const r = runScenario('idle', { ticks: 600 });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.lines[0], { type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
  assert.deepEqual(end(r.lines), { type: 'end', ticks: 600, state: 'playing', score: 0 });
  assert.equal(snapAt(r.lines, 0).time_left_s, 240); // Ticket-03: night 1 = 240 s
  assert.equal(snapAt(r.lines, 600).time_left_s, 230);
  assert.equal(snaps(r.lines).length, 61);
  assert.equal(events(r.lines).length, 0);
  for (const s of snaps(r.lines)) assert.equal(s.sim_tick, s.tick);
});

test('v1.1 snapshot fields present', () => {
  const s = snapAt(runScenario('idle', { ticks: 10 }).lines, 10);
  assert.equal(s.night, 1);
  assert.deepEqual(Object.keys(s.wind).sort(), ['active', 'dir_deg']);
  for (const k of ['pos', 'vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s', 'flames', 'carried']) assert.ok(k in s.player, k);
  for (const k of ['motes', 'drifters', 'charms', 'lanterns', 'shades']) assert.ok(Array.isArray(s[k]), k);
  assert.equal(s.player.grounded, true);
});

test('AC2 walk forward 60 ticks at 6 m/s -> z = 6 (accel <= 0.1 s: instant)', () => {
  const r = runScenario('walk_forward', { ticks: 60 });
  assert.deepEqual(snapAt(r.lines, 60).player.pos, [0, 0, 6]);
  assert.deepEqual(snapAt(r.lines, 10).player.vel, [0, 0, 6]);
});

test('AC4 pickup within 1.0 m (tick 40); no points for picking (points on deposit)', () => {
  const r = runScenario('pickup', { ticks: 60 });
  const ev = events(r.lines, 'mote_picked');
  assert.deepEqual(ev.map((e) => [e.tick, e.data]), [[40, { carried: 1 }]]);
  assert.equal(end(r.lines).score, 0);
});

test('AC6 deposit 10 lights the lantern: +5/mote +100 (Ticket-03 scores), fuel 100, relight false', () => {
  const r = runScenario('light_one', { ticks: 30 });
  assert.deepEqual(events(r.lines, 'deposit').map((e) => [e.tick, e.data]), [[1, { lantern_id: 'L1', amount: 10, deposited: 10 }]]);
  assert.deepEqual(events(r.lines, 'lantern_lit').map((e) => [e.tick, e.data]), [[1, { lantern_id: 'L1', relight: false }]]);
  assert.equal(end(r.lines).score, 150);
  const L1 = snapAt(r.lines, 10).lanterns[0];
  assert.equal(L1.fuel, 99.9); // lit at tick 1, decays ticks 2..10: 5991/60 = 99.85
  assert.equal(L1.ever_lit, true);
  assert.equal(snapAt(r.lines, 10).player.capacity, 12);
});

// Ticket-03 [THAY THẾ]: the old "win as soon as every lantern is lit" test (fixture `win`) is replaced by `no_early_win`.
test('P3-9 lighting the last lantern no longer ends the night', () => {
  const r = runScenario('no_early_win', { ticks: 300 });
  assert.equal(events(r.lines, 'game_over').length, 0);
  assert.deepEqual(end(r.lines), { type: 'end', ticks: 300, state: 'playing', score: 2 * 5 + 100 });
});

test('AC8/P2-6 shade hit: -1 flame, floor(n/2) dropped onto 1.5-2.5 m ring (TTL 480), shade recoils', () => {
  const r = runScenario('hit', { ticks: 400 });
  const hits = events(r.lines, 'player_hit');
  const h0 = hits[0].tick;
  assert.ok(h0 === 30 || h0 === 31, `first hit ${h0}`); // 3 m -> 1 m at 4 m/s
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: 2 });
  assert.deepEqual(hits.map((e) => e.tick - h0), [0, 90, 180], 'invuln 90 + recoil 60 + 30 ticks back');
  const s = snapAt(r.lines, 40);
  assert.equal(s.player.carried, 2);
  assert.equal(s.shades[0].state, 'recoil');
  const dropped = s.motes.filter((m) => m.kind === 'dropped');
  assert.equal(dropped.length, 2);
  for (const m of dropped) {
    const d = XZ(m.pos, s.player.pos);
    assert.ok(d >= 1.5 - 1e-3 && d <= 2.5 + 1e-3, `ring ${d}`);
    assert.ok(m.ttl_s > 7.5 && m.ttl_s <= 8);
  }
  assert.equal(s.player.invuln, true);
  assert.deepEqual(events(r.lines, 'game_over').map((e) => e.data), [{ result: 'lost', reason: 'no_flames' }]);
});

test('AC10 last flame -> lost no_flames, stops early', () => {
  const r = runScenario('lose_flames', { ticks: 1000 });
  assert.equal(end(r.lines).state, 'lost');
  assert.ok(end(r.lines).ticks <= 10);
});

test('AC11 dawn at tick 60 when time_left_s = 1', () => {
  const r = runScenario('dawn', { ticks: 100 });
  assert.deepEqual(events(r.lines, 'game_over').map((e) => [e.tick, e.data]), [[60, { result: 'lost', reason: 'dawn' }]]);
});

test('AC12/P2-7 pulse: 3D radius 5 from feet+0.8, stun 120, push 4 m over 15 ticks, +5, cooldown/cost', () => {
  const r = runScenario('pulse', { ticks: 400 });
  const p = events(r.lines, 'pulse');
  assert.equal(p.length, 1);
  assert.deepEqual([p[0].tick, p[0].data], [1, { stunned_ids: ['A'] }]);
  const A = (t) => snapAt(r.lines, t).shades.find((s) => s.id === 'A');
  assert.ok(near(A(10).pos[0], 4 + 10 * (4 / 15)), `${A(10).pos}`);
  assert.ok(near(A(20).pos[0], 8));
  assert.equal(A(120).state, 'stunned');
  assert.equal(A(130).state, 'chase');
  assert.equal(snapAt(r.lines, 10).shades.find((s) => s.id === 'B').state, 'wander');
  assert.equal(snapAt(r.lines, 10).player.carried, 0);
  assert.equal(snapAt(r.lines, 10).player.pulse_cd_s, 2.85);
});

test('AC14/P2-9 shades never enter safe radius 6 of a lit lantern', () => {
  const r = runScenario('safe_zone', { ticks: 900 });
  assert.equal(events(r.lines, 'player_hit').length, 0);
  for (const s of snaps(r.lines)) for (const sh of s.shades) assert.ok(XZ(sh.pos, [0, 0, 10]) >= 6 - 1e-3, `t${s.tick} ${sh.id}`);
});

test('P2-9 shade inside a just-lit lantern is pushed to the edge within 30 ticks and does no damage', () => {
  const r = runScenario('safe_evict', { ticks: 600 });
  assert.deepEqual(events(r.lines, 'lantern_lit').map((e) => e.tick), [1]);
  assert.equal(events(r.lines, 'player_hit').length, 0);
  const d = (t) => XZ(snapAt(r.lines, t).shades[0].pos, [0, 0, 10]);
  assert.ok(d(10) > 1.5 && d(10) < 6);
  assert.ok(near(d(30), 6));
});

test('AC15 scenario setup emits no events and awards no points', () => {
  const r = runScenario('preset_lit', { ticks: 10 });
  assert.equal(events(r.lines).length, 0);
  assert.equal(end(r.lines).score, 0);
});

test('P2-5/P2-8 defaults night 1: 20 motes on standard points, +1 per 240 ticks; shades 2 @300 then every 480', () => {
  const r = runScenario('default_spawn', { seed: 7, ticks: 1801 });
  const s0 = snapAt(r.lines, 0);
  assert.equal(s0.motes_active, 20);
  assert.equal(new Set(s0.motes.map((m) => m.pos.join())).size, 20);
  for (const m of s0.motes) {
    const rr = Math.hypot(m.pos[0], m.pos[2]);
    assert.ok(near(rr, 12) || near(rr, 33), `point ${m.pos}`);
    assert.equal(m.kind, 'random');
    assert.equal(m.ttl_s, null);
  }
  assert.equal(snapAt(r.lines, 240).motes_active, 21);
  assert.equal(snapAt(r.lines, 1200).motes_active, 24, 'only 24 standard points on night 1');
  assert.deepEqual(events(r.lines, 'shade_spawned').map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3'], [1260, 'S4'], [1740, 'S5']]);
  const at300 = snapAt(r.lines, 300).shades;
  assert.deepEqual(at300.map((s) => s.state), ['spawning', 'spawning']);
  for (const s of at300) assert.ok(near(Math.hypot(s.pos[0], s.pos[2]), 37) && XZ(s.pos, [0, 0, 0]) >= 15);
  assert.equal(snapAt(r.lines, 310).shades[0].state === 'spawning', false);
});

// ---------- Phase 2 features ----------

test('P2-2 dash: 12 ticks x 14 m/s along facing, cooldown 90 ticks from start', () => {
  const r = runScenario('dash', { ticks: 120 });
  assert.deepEqual(events(r.lines, 'dash').map((e) => e.tick), [1, 91]);
  assert.ok(near(snapAt(r.lines, 20).player.pos[2], 2.8));
  assert.ok(near(snapAt(r.lines, 110).player.pos[2], 5.6));
  assert.equal(snapAt(r.lines, 10).player.dash_cd_s, 1.35);
});

test('P2-4 fall off the island: one player_hit{fall,lost}, 60-tick wait, respawn at start with 90 ticks invuln', () => {
  const r = runScenario('fall', { ticks: 200 });
  const f = events(r.lines, 'player_hit');
  assert.equal(f.length, 1);
  assert.deepEqual(f[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 4 });
  const ft = f[0].tick;
  const before = snaps(r.lines).filter((s) => s.tick < ft).at(-1);
  assert.ok(before.player.pos[1] < 0 && before.player.grounded === false);
  const waiting = snaps(r.lines).find((s) => s.tick > ft && s.tick < ft + 50);
  assert.ok(waiting.player.respawn_s > 0 && waiting.player.pos[1] < -9, 'waits 60 ticks before respawn');
  const back = snaps(r.lines).find((s) => s.tick >= ft + 60);
  assert.deepEqual(back.player.pos, [0, 0, 0]);
  assert.equal(back.player.invuln, true);
  assert.equal(back.player.carried, 0);
  assert.equal(end(r.lines).state, 'playing');
});

test('P2-4 falling with the last flame loses immediately', () => {
  const r = runScenario('fall_last_flame', { ticks: 300 });
  const go = events(r.lines, 'game_over');
  assert.deepEqual(go.map((e) => e.data), [{ result: 'lost', reason: 'no_flames' }]);
  assert.equal(go[0].tick, events(r.lines, 'player_hit')[0].tick);
});

test('P2-6 dropped motes expire after their TTL', () => {
  const r = runScenario('dropped_ttl', { ticks: 20 });
  assert.deepEqual(snapAt(r.lines, 0).motes.map((m) => m.kind), ['dropped', 'random']);
  assert.equal(snapAt(r.lines, 10).motes_active, 1);
});

test('P2-10 night 2 launch pad flies Mây to the other island (~1.4 s)', () => {
  const r = runScenario('n2_pad', { ticks: 150 });
  assert.equal(events(r.lines, 'player_hit').length, 0);
  assert.ok(snaps(r.lines).some((s) => s.player.pos[1] > 4.5), 'airborne (apex 14^2/40 = 4.9 m)');
  const landed = snaps(r.lines).find((s) => s.tick > 10 && s.player.grounded);
  assert.ok(landed.tick >= 80 && landed.tick <= 90, `landed at ${landed.tick}`);
  assert.ok(XZ(landed.player.pos, [70, 0, 0]) <= 28);
  assert.equal(snapAt(r.lines, 0).lanterns.length, 6);
});

test('P2-11 night 3 ramp leads to tier 1 (Y=3)', () => {
  const r = runScenario('n3_ramp', { ticks: 120 });
  assert.ok(near(snapAt(r.lines, 30).player.pos[1], 1));
  const s = snapAt(r.lines, 120);
  assert.ok(near(s.player.pos[1], 3) && s.player.grounded);
  assert.equal(s.lanterns.length, 7);
});

test('P2-11 night 3 tier edge is a wall from below', () => {
  const s = snapAt(runScenario('n3_wall', { ticks: 120 }).lines, 120);
  assert.ok(s.player.pos[2] > 24 && s.player.pos[1] === 0, `${s.player.pos}`);
});

test('P2-11 night 3 launch pad (0,3,13) lands on tier 2 (Y=6)', () => {
  const r = runScenario('n3_pad', { ticks: 120 });
  const s = snapAt(r.lines, 120);
  assert.ok(near(s.player.pos[1], 6) && s.player.grounded, `${s.player.pos}`);
  assert.ok(Math.hypot(s.player.pos[0], s.player.pos[2]) <= 8);
});

test('P2-12 strong wind: active 300 ticks every 1800, pushes 2 m/s', () => {
  const r = runScenario('wind', { ticks: 2200 });
  assert.equal(snapAt(r.lines, 1790).wind.active, false);
  const w = snapAt(r.lines, 1800).wind;
  assert.equal(w.active, true);
  assert.equal(snapAt(r.lines, 2100).wind.active, false);
  const p = snapAt(r.lines, 2200).player.pos;
  assert.ok(near(Math.hypot(p[0], p[2]), 10, 1e-2), `${p}`);
  const a = (w.dir_deg * Math.PI) / 180;
  assert.ok(near(p[0], 10 * Math.cos(a), 1e-2) && near(p[2], 10 * Math.sin(a), 1e-2));
});

test('P2-13 drifter: idle -> chase (>=5 carried, <=15 m), steals min(3,n) at 1.2 m, flees 240 ticks, removed', () => {
  const r = runScenario('drifter_steal', { ticks: 300 });
  const st = events(r.lines, 'drifter_steal');
  assert.deepEqual(st.map((e) => [e.tick, e.data]), [[33, { drifter_id: 'D1', amount: 3, carried: 3 }]]);
  assert.equal(snapAt(r.lines, 10).drifters[0].state, 'chase');
  assert.deepEqual(snapAt(r.lines, 270).drifters[0].state, 'flee');
  assert.deepEqual([snapAt(r.lines, 280).drifters[0].state, snapAt(r.lines, 280).drifters[0].stolen], ['removed', 3]);
  assert.equal(events(r.lines, 'player_hit').length, 0, 'drifters never cost flames');
});

test('P2-13 pulse on a chasing drifter: flees without stealing', () => {
  const r = runScenario('drifter_pulse_chase', { ticks: 300 });
  assert.deepEqual(events(r.lines, 'pulse').map((e) => e.tick), [2]);
  assert.equal(events(r.lines, 'drifter_steal').length, 0);
  assert.equal(snapAt(r.lines, 10).drifters[0].state, 'flee');
  assert.equal(snapAt(r.lines, 250).drifters[0].state, 'removed');
});

test('P2-13 pulse on a fleeing drifter with loot: drops it all as dropped motes, removed after 120 ticks', () => {
  const r = runScenario('drifter_pulse_drop', { ticks: 200 });
  assert.deepEqual(events(r.lines, 'drifter_drop').map((e) => [e.tick, e.data]), [[1, { drifter_id: 'D1', amount: 3 }]]);
  const s = snapAt(r.lines, 10);
  assert.equal(s.motes.filter((m) => m.kind === 'dropped').length, 3);
  assert.equal(s.drifters[0].stolen, 0);
  assert.equal(snapAt(r.lines, 120).drifters[0].state, 'flee');
  assert.equal(snapAt(r.lines, 130).drifters[0].state, 'removed');
});

test('P2-14 wind charm: picked like a mote, 600 ticks of 7.2 m/s, respawns after 2700 ticks', () => {
  const r = runScenario('charm', { ticks: 140 });
  const c = events(r.lines, 'charm_picked');
  assert.equal(c.length, 1);
  assert.ok(c[0].tick === 10 || c[0].tick === 11);
  assert.deepEqual(c[0].data, { charm_id: 'C1', charm_ticks: 600 });
  const x = (t) => snapAt(r.lines, t).player.pos[0];
  assert.ok(near(x(130) - x(70), 7.2));
  const ch = snapAt(r.lines, 20).charms[0];
  assert.equal(ch.available, false);
  assert.ok(ch.respawn_s > 44 && ch.respawn_s < 45);
  assert.ok(snapAt(r.lines, 20).player.charm_s > 9.5);
});

test('P2-15 pause: tick advances, sim_tick/time/movement frozen, state paused, events paused/resumed', () => {
  const r = runScenario('pause', { ticks: 100 });
  assert.deepEqual(events(r.lines, 'paused').map((e) => e.tick), [11]);
  assert.deepEqual(events(r.lines, 'resumed').map((e) => e.tick), [51]);
  const s20 = snapAt(r.lines, 20);
  assert.equal(s20.state, 'paused');
  assert.equal(s20.sim_tick, 10);
  assert.ok(near(s20.time_left_s, 240 - 10 / 60)); // Ticket-03: night 1 = 240 s
  assert.deepEqual(s20.player.pos, [0, 0, 1]);
  const s100 = snapAt(r.lines, 100);
  assert.equal(s100.sim_tick, 60);
  assert.ok(near(s100.player.pos[2], 6));
  assert.equal(end(r.lines).ticks, 100);
});

test('P2-8 shade schedule nights 2/3: 2 @300 then every 420 / 360 ticks; caps 8 / 10; drifters every 1200', () => {
  for (const [night, every, max] of [[2, 420, 8], [3, 360, 10]]) {
    const r = runScenario('default_spawn', { night, seed: 3, ticks: 5000 });
    const ticks = events(r.lines, 'shade_spawned').map((e) => e.tick);
    const want = [300, 300];
    for (let t = 300 + every; want.length < max; t += every) want.push(t);
    assert.deepEqual(ticks, want, `night ${night}`);
    const s = snapAt(r.lines, 1200);
    assert.equal(s.drifters.length, 1, `night ${night} drifter at 1200`);
    assert.equal(s.drifters[0].id, 'D1');
  }
});

// ---------- Phase 3 (Ticket-03, contract v1.2) ----------

test('P3-2 lit lantern starts at fuel 100 and loses exactly 1 per second', () => {
  const r = runScenario('fuel_decay', { ticks: 600 });
  assert.equal(snapAt(r.lines, 0).lanterns[0].fuel, 100);
  assert.equal(snapAt(r.lines, 60).lanterns[0].fuel, 99);
  assert.equal(snapAt(r.lines, 600).lanterns[0].fuel, 90);
});

test('P3-3 fuel runs out -> lantern_out, unlit, deposited 0, ever_lit, fuel 0', () => {
  const r = runScenario('fuel_out', { ticks: 100 });
  assert.deepEqual(events(r.lines, 'lantern_out').map((e) => [e.tick, e.data]), [[60, { lantern_id: 'L1' }]]);
  const L = snapAt(r.lines, 60).lanterns[0];
  assert.deepEqual([L.lit, L.fuel, L.deposited, L.ever_lit], [false, 0, 0, true]);
});

test('P3-4 refuel: used = min(carried, ceil((100-fuel)/10)), capped at 100, +5 per mote', () => {
  const r = runScenario('refuel', { ticks: 10 });
  assert.deepEqual(events(r.lines, 'refuel').map((e) => [e.tick, e.data]), [[1, { lantern_id: 'L1', amount: 7, fuel: 100 }], [6, { lantern_id: 'L1', amount: 1, fuel: 100 }]]);
  assert.equal(snapAt(r.lines, 10).player.carried, 1);
  assert.equal(end(r.lines).score, 40);
  assert.equal(events(r.lines, 'deposit').length, 0);
});

test('P3-5 relight costs 5, +40, relight true, relit_count and capacity grow', () => {
  const r = runScenario('relight', { ticks: 10 });
  assert.deepEqual(events(r.lines, 'deposit').map((e) => e.data), [{ lantern_id: 'L1', amount: 5, deposited: 5 }]);
  assert.deepEqual(events(r.lines, 'lantern_lit').map((e) => e.data), [{ lantern_id: 'L1', relight: true }]);
  assert.equal(end(r.lines).score, 25 + 40);
  const s = snapAt(r.lines, 10);
  assert.deepEqual([s.lanterns[0].relit_count, s.player.carried, s.player.capacity], [1, 2, 12]);
});

test('P3-7 wander shades go to the nearest weak lantern, drain within 2 m (stacking), fuel_drain every 60 ticks, lantern goes out', () => {
  const r = runScenario('drain', { ticks: 260 });
  const st = (t, id) => snapAt(r.lines, t).shades.find((x) => x.id === id);
  assert.equal(st(20, 'S2').state, 'drain');
  assert.equal(st(20, 'S2').target_lantern_id, 'L1');
  assert.equal(st(40, 'S1').state, 'wander');
  assert.equal(st(50, 'S1').state, 'drain');
  assert.deepEqual(events(r.lines, 'fuel_drain').slice(0, 2).map((e) => [e.tick, e.data.shade_id, e.data.lantern_id]), [[78, 'S2', 'L1'], [105, 'S1', 'L1']]);
  assert.equal(snapAt(r.lines, 100).lanterns[0].fuel, 15.9, '1740 - 18 - 27*6 - 55*11 units');
  assert.deepEqual(events(r.lines, 'lantern_out').map((e) => [e.tick, e.data.lantern_id]), [[187, 'L1']]);
  assert.equal(st(190, 'S1').state, 'wander');
  assert.equal(st(190, 'S1').target_lantern_id, 'L2');
});

test('P3-8 draining shade switches to chase when Mây comes within 6 m', () => {
  const r = runScenario('drain_exit', { ticks: 130 });
  assert.equal(snapAt(r.lines, 100).shades[0].state, 'drain');
  assert.equal(snapAt(r.lines, 120).shades[0].state, 'chase');
});

test('P3-9/P3-10 dawn with >= ceil(0.6 n) lit -> won dawn_survived; bonus 50 + floor(fuel) per lit lantern + 50 per flame', () => {
  const r = runScenario('dawn_win', { ticks: 100 });
  assert.deepEqual(events(r.lines, 'game_over').map((e) => [e.tick, e.data]), [[60, { result: 'won', reason: 'dawn_survived' }]]);
  assert.equal(end(r.lines).score, (50 + 49) + (50 + 99) + (50 + 9) + 3 * 50);
});

test('P3-9 dawn with too few lanterns lit -> lost dawn, no bonus', () => {
  const r = runScenario('dawn_lose', { ticks: 100 });
  assert.deepEqual(events(r.lines, 'game_over').map((e) => e.data), [{ result: 'lost', reason: 'dawn' }]);
  assert.equal(end(r.lines).score, 0);
});

