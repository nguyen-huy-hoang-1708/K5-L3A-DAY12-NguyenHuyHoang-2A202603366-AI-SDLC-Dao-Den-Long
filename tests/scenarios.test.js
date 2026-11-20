// Headless scenarios run through the real CLI. One test per acceptance criterion (docs/notes/phase-1.md §3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScenario, events, snaps, end, snapAt } from './helpers.js';

const XZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

test('AC1 idle: exact tick count, time_left, end line last', () => {
  const r = runScenario('idle', { ticks: 600 });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(end(r.lines), { type: 'end', ticks: 600, state: 'playing', score: 0 });
  assert.equal(snapAt(r.lines, 0).time_left_s, 300);
  assert.equal(snapAt(r.lines, 600).time_left_s, 290);
  assert.equal(snaps(r.lines).length, 61); // ticks 0,10,...,600
  assert.equal(events(r.lines).length, 0);
  for (const s of snaps(r.lines)) assert.equal(s.sim_tick, s.tick);
});

test('AC2 walk forward 60 ticks at 6 m/s -> z = 6', () => {
  const r = runScenario('walk_forward', { ticks: 60 });
  assert.deepEqual(snapAt(r.lines, 60).player.pos, [0, 0, 6]);
  assert.deepEqual(snapAt(r.lines, 10).player.pos, [0, 0, 1]);
});

test('AC4 pickup when within pickup_radius (tick 40 at z = 4)', () => {
  const r = runScenario('pickup', { ticks: 60 });
  const ev = events(r.lines, 'mote_picked');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tick, 40);
  assert.deepEqual(ev[0].data, { carried: 1 });
  assert.equal(snapAt(r.lines, 40).motes_active, 0);
  assert.equal(end(r.lines).score, 10);
});

test('AC6 deposit lantern_cost into L1 lights it (+100)', () => {
  const r = runScenario('light_one', { ticks: 30 });
  const dep = events(r.lines, 'deposit');
  assert.deepEqual(dep.map((e) => [e.tick, e.data]), [[1, { lantern_id: 'L1', amount: 5, deposited: 5 }]]);
  assert.deepEqual(events(r.lines, 'lantern_lit').map((e) => [e.tick, e.data]), [[1, { lantern_id: 'L1' }]]);
  const L1 = snapAt(r.lines, 10).lanterns.find((l) => l.id === 'L1');
  assert.equal(L1.lit, true);
  assert.equal(snapAt(r.lines, 10).player.carried, 0);
  assert.equal(end(r.lines).score, 100);
});

test('AC7 + AC15 win: lighting the last lantern ends with all_lit and bonus', () => {
  const r = runScenario('win', { ticks: 600 });
  const go = events(r.lines, 'game_over');
  assert.deepEqual(go.map((e) => [e.tick, e.data]), [[1, { result: 'won', reason: 'all_lit' }]]);
  // preset lit lanterns give no points; 100 (L1) + floor(300 - 1/60)=299 + 3 flames * 50
  assert.deepEqual(end(r.lines), { type: 'end', ticks: 1, state: 'won', score: 100 + 299 + 150 });
  assert.equal(snapAt(r.lines, 0).score, 0);
});

test('AC8 shade chases and hits: flames -1, drops floor(carried*0.5)', () => {
  const r = runScenario('hit', { ticks: 100 });
  const hits = events(r.lines, 'player_hit');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].tick, 35); // 3 m -> 1 m at 3.5 m/s = 34.29 ticks
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: 2 });
  assert.equal(snapAt(r.lines, 40).player.carried, 2);
  assert.equal(snapAt(r.lines, 20).shades[0].state, 'chase');
});

test('AC9 invulnerability: next hit exactly invuln_s later', () => {
  const r = runScenario('hit', { ticks: 400 });
  const hits = events(r.lines, 'player_hit').map((e) => e.tick);
  assert.deepEqual(hits, [35, 155, 275]);
  assert.deepEqual(events(r.lines, 'game_over').map((e) => e.data), [{ result: 'lost', reason: 'no_flames' }]);
  assert.equal(end(r.lines).state, 'lost');
  assert.equal(end(r.lines).ticks, 275);
});

test('AC10 last flame lost -> game_over lost no_flames, stops early', () => {
  const r = runScenario('lose_flames', { ticks: 1000 });
  const go = events(r.lines, 'game_over');
  assert.equal(go.length, 1);
  assert.deepEqual(go[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(end(r.lines).state, 'lost');
  assert.ok(end(r.lines).ticks < 1000);
  assert.equal(end(r.lines).score, 0);
});

test('AC11 time runs out -> lost dawn at tick 60 when time_left_s = 1', () => {
  const r = runScenario('dawn', { ticks: 100 });
  assert.deepEqual(events(r.lines, 'game_over').map((e) => [e.tick, e.data]), [[60, { result: 'lost', reason: 'dawn' }]]);
  assert.deepEqual(end(r.lines), { type: 'end', ticks: 60, state: 'lost', score: 0 });
  assert.equal(snapAt(r.lines, 30).time_left_s, 0.5);
});

test('AC12 + AC13 pulse stuns & pushes in radius, costs light, respects cooldown', () => {
  const r = runScenario('pulse', { ticks: 400 });
  const p = events(r.lines, 'pulse');
  assert.equal(p.length, 1, 'second press blocked by cooldown/cost');
  assert.deepEqual([p[0].tick, p[0].data], [1, { stunned_ids: ['A'] }]);
  const s10 = snapAt(r.lines, 10);
  const A = s10.shades.find((s) => s.id === 'A');
  assert.equal(A.state, 'stunned');
  assert.deepEqual(A.pos, [9, 1, 0]); // 5 m + push 4 m, did not move while stunned
  assert.equal(s10.shades.find((s) => s.id === 'B').state, 'chase');
  assert.equal(s10.player.carried, 1);
  assert.equal(snapAt(r.lines, 180).shades.find((s) => s.id === 'A').state, 'stunned');
  assert.equal(snapAt(r.lines, 190).shades.find((s) => s.id === 'A').state, 'chase');
  assert.ok(end(r.lines).score >= 20);
});

test('AC14 shades never enter safe_radius of a lit lantern; player inside is safe', () => {
  const r = runScenario('safe_zone', { ticks: 900 });
  assert.equal(events(r.lines, 'player_hit').length, 0);
  for (const s of snaps(r.lines)) {
    for (const sh of s.shades) assert.ok(XZ(sh.pos, [0, 0, 10]) >= 5 - 1e-3, `tick ${s.tick} ${sh.id} at ${sh.pos}`);
  }
  assert.equal(end(r.lines).state, 'playing');
});

test('AC15 scenario setup emits no events and awards no points', () => {
  const r = runScenario('preset_lit', { ticks: 10 });
  assert.equal(events(r.lines).length, 0);
  assert.equal(snapAt(r.lines, 0).lanterns.find((l) => l.id === 'L1').lit, true);
  assert.equal(end(r.lines).score, 0);
});

test('AC18 defaults: 30 motes, 2 shades, shade_spawned every 30 s with fresh ids', () => {
  const r = runScenario('default_spawn', { seed: 7, ticks: 1801 });
  const s0 = snapAt(r.lines, 0);
  assert.equal(s0.motes_active, 30);
  assert.equal(s0.motes.length, 30);
  assert.deepEqual(s0.shades.map((s) => s.id), ['S1', 'S2']);
  assert.deepEqual(events(r.lines, 'shade_spawned').map((e) => [e.tick, e.data]), [[1800, { id: 'S3' }]]);
  for (const m of s0.motes) assert.equal(m.pos[1], 0);
});
