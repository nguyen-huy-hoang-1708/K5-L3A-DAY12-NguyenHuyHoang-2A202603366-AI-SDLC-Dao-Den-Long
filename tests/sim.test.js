// Unit tests for src/sim.js + src/inputs.js, CLI error codes and determinism (Contract v1.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGame, step, snapshot, TUNING, MAPS } from '../src/sim.js';
import { parseInputs, InputTimeline } from '../src/inputs.js';
import { runHeadless, runScenario } from './helpers.js';

const EMPTY = { random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [], charms: [] };
const idle = { move: [0, 0], cam_yaw_deg: 0 };
const run = (g, n, input = idle) => {
  const evs = [];
  for (let i = 0; i < n; i++) evs.push(...step(g, input));
  return evs;
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('AC3 cam_yaw_deg 90 rotates move [0,1] to +X', () => {
  const g = createGame({ seed: 1, scenario: EMPTY });
  run(g, 60, { move: [0, 1], cam_yaw_deg: 90 });
  assert.deepEqual(snapshot(g).player.pos, [6, 0, 0]);
});

test('move vectors longer than 1 are normalized', () => {
  const g = createGame({ seed: 1, scenario: EMPTY });
  run(g, 60, { move: [1, 1], cam_yaw_deg: 0 });
  const [x, , z] = snapshot(g).player.pos;
  assert.ok(near(Math.hypot(x, z), 6, 1e-3));
});

test('P2-3 jump: 7 m/s, gravity 20, only from the ground; apex ~1.2 m; lands', () => {
  const g = createGame({ seed: 1, scenario: EMPTY });
  let apex = 0;
  for (let i = 0; i < 80; i++) {
    step(g, { ...idle, jump: true }); // held: must not re-trigger in the air
    apex = Math.max(apex, g.player.pos[1]);
  }
  assert.ok(apex > 1.1 && apex < 1.3, `apex ${apex}`);
  assert.equal(g.player.pos[1], 0);
  assert.equal(g.player.grounded, true);
});

test('P2-2 air dash keeps altitude; dash while dashing is ignored', () => {
  const g = createGame({ seed: 1, scenario: EMPTY });
  step(g, { ...idle, jump: true });
  run(g, 10);
  const y = g.player.pos[1];
  const evs = [...step(g, { ...idle, dash: true }), ...run(g, 5, { ...idle, dash: true })];
  assert.equal(evs.filter((e) => e.name === 'dash').length, 1);
  assert.ok(near(g.player.pos[1], y), `${g.player.pos[1]} vs ${y}`);
});

test('P2-14 charm: dash has no cooldown (needs a new press), run speed 7.2', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { charm_ticks: 600 } } });
  const ticks = [];
  for (let k = 0; k < 60; k++) for (const e of step(g, { ...idle, dash: k % 15 === 0 })) if (e.name === 'dash') ticks.push(e.tick);
  assert.deepEqual(ticks, [1, 16, 31, 46]);
  const h = createGame({ seed: 1, scenario: { ...EMPTY, player: { charm_ticks: 600 } } });
  run(h, 60, { move: [0, 1], cam_yaw_deg: 0 });
  assert.ok(near(h.player.pos[2], 7.2, 1e-9));
});

test('P2-14 charm respawns after its timer', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, charms: [{ id: 'C1', pos: [10, 0, 0], available: false, respawn_ticks: 5 }] } });
  run(g, 4);
  assert.equal(g.charms[0].available, false);
  run(g, 1);
  assert.equal(g.charms[0].available, true);
});

test('AC5 carry_capacity limits pickup', () => {
  const motes = Array.from({ length: 15 }, () => [0, 0, 0.5]);
  const g = createGame({ seed: 1, scenario: { ...EMPTY, motes } });
  const evs = run(g, 1);
  assert.equal(evs.filter((e) => e.name === 'mote_picked').length, TUNING.carry_capacity);
  assert.equal(g.motes.length, 5);
});

test('pickup needs height difference <= 1.5 m', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, motes: [[0, 1.6, 0], [0, 1.5, 0]] } });
  assert.equal(run(g, 1).filter((e) => e.name === 'mote_picked').length, 1);
});

test('dropped motes are picked up again (from the tick after they drop)', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, motes: [{ pos: [0, 0, 2], kind: 'dropped' }] } });
  run(g, 20, { move: [0, 1], cam_yaw_deg: 0 });
  assert.equal(g.player.carried, 1);
});

test('partial deposit keeps lantern unlit and lantern remembers progress', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 23], carried: 3 } } });
  const evs = run(g, 1, { ...idle, interact: true });
  assert.deepEqual(evs.map((e) => e.name), ['deposit']);
  assert.equal(g.lanterns[0].deposited, 3);
  assert.equal(g.lanterns[0].lit, false);
  assert.equal(g.score, 30);
});

test('deposit never exceeds lantern_cost; surplus stays carried', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 23], carried: 10 }, lanterns: [{ id: 'L1', deposited: 6 }] } });
  const evs = run(g, 1, { ...idle, interact: true });
  assert.deepEqual(evs[0].data, { lantern_id: 'L1', amount: 4, deposited: 10 });
  assert.equal(g.player.carried, 6);
  assert.equal(g.lanterns[0].lit, true);
});

test('nearest unlit lantern in range wins; lit lanterns are skipped', () => {
  const lanterns = [{ id: 'L1', pos: [0, 0, 1], lit: true }, { id: 'L2', pos: [0, 0, 1.9] }, { id: 'L3', pos: [0, 0, -1] }];
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { carried: 1 }, lanterns } });
  assert.equal(run(g, 1, { ...idle, interact: true })[0].data.lantern_id, 'L3');
});

test('interact outside 2.0 m does nothing', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 22.9], carried: 5 } } });
  assert.deepEqual(run(g, 1, { ...idle, interact: true }), []);
});

test('AC13 pulse without 3 motes emits nothing', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { carried: 2 }, shades: [{ pos: [3, 1, 0] }] } });
  assert.deepEqual(run(g, 1, { ...idle, pulse: true }).filter((e) => e.name === 'pulse'), []);
});

test('pulse cooldown 3 s from activation', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { carried: 10 } } });
  const ticks = [];
  for (let k = 0; k < 400; k++) for (const e of step(g, { ...idle, pulse: k % 2 === 0 })) if (e.name === 'pulse') ticks.push(e.tick);
  assert.deepEqual(ticks, [1, 181, 361]);
});

test('pulse re-hits a stunned shade (+5 again, stun refreshed)', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { carried: 6, pulse_cd_ticks: 0 }, shades: [{ id: 'S1', pos: [2, 1, 0], state: 'stunned', state_ticks_left: 10 }] } });
  const e = run(g, 1, { ...idle, pulse: true }).find((x) => x.name === 'pulse');
  assert.deepEqual(e.data.stunned_ids, ['S1']);
  assert.equal(g.score, 5);
  assert.equal(g.shades[0].ticks, 120);
});

test('hit drops floor(n/2); shade on top of Mây pushed +X by pulse; stunned shade does not hit', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { carried: 5 }, shades: [{ pos: [0.5, 1, 0] }] } });
  const [hit] = run(g, 1).filter((e) => e.name === 'player_hit');
  assert.deepEqual(hit.data, { by: 'shade', flames: 2, dropped: 2 });
  const h = createGame({ seed: 1, scenario: { ...EMPTY, player: { carried: 3 }, shades: [{ pos: [0, 1, 0] }] } });
  const evs = run(h, 1, { ...idle, pulse: true });
  assert.deepEqual(evs.map((e) => e.name), ['pulse']);
  assert.ok(near(h.shades[0].pos[0], 4 / 15));
});

test('invulnerability 90 ticks: a second shade touching Mây cannot hit until it ends', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { flames: 3 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }, { id: 'S2', pos: [-0.5, 1, 0] }] } });
  const hits = [];
  for (let k = 0; k < 100; k++) for (const e of step(g, idle)) if (e.name === 'player_hit') hits.push(e.tick);
  assert.equal(hits[0], 1);
  assert.ok(hits.length === 1 || hits[1] >= 91, `${hits}`);
});

test('shade with height difference > 1.5 m does not hit (jumping over is possible)', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, shades: [{ pos: [0, 2.6, 0] }] } });
  assert.equal(run(g, 1).filter((e) => e.name === 'player_hit').length, 0);
});

test('P2-8 shade detection 12 m / lose 18 m', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, shades: [{ id: 'S1', pos: [11, 1, 0] }, { id: 'S2', pos: [13, 1, 0] }, { id: 'S3', pos: [17, 1, 0], state: 'chase' }, { id: 'S4', pos: [19, 1, 0], state: 'chase' }] } });
  run(g, 1);
  assert.deepEqual(g.shades.map((s) => s.state), ['chase', 'wander', 'chase', 'wander']);
});

test('P2-8 night 3 shades move at 4.5 m/s', () => {
  const g = createGame({ seed: 1, night: 3, scenario: { ...EMPTY, wind_enabled: false, shades: [{ pos: [0, 1, -20] }] } });
  run(g, 60);
  assert.ok(near(g.shades[0].pos[2], -24.5, 1e-9), `${g.shades[0].pos}`);
});

test('P2-16 priority: no flames beats all lanterns lit', () => {
  const lanterns = [1, 2, 3, 4, 5].map((i) => ({ id: `L${i}`, lit: true }));
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { flames: 0 }, lanterns } });
  assert.deepEqual(run(g, 1).find((e) => e.name === 'game_over').data, { result: 'lost', reason: 'no_flames' });
});

test('P2-9 lighting a lantern evicts a shade touching Mây: no damage, still a win', () => {
  const lanterns = [{ id: 'L1', deposited: 9 }, ...[2, 3, 4, 5].map((i) => ({ id: `L${i}`, lit: true }))];
  const h = createGame({ seed: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 23], carried: 1, flames: 1 }, lanterns, shades: [{ pos: [0, 1, 23.5] }] } });
  const evs = run(h, 1, { ...idle, interact: true });
  assert.equal(evs.filter((e) => e.name === 'player_hit').length, 0);
  assert.equal(evs.find((e) => e.name === 'game_over').data.result, 'won');
});

test('P2-16 win on the very tick time runs out counts as a win', () => {
  const lanterns = [{ id: 'L1', deposited: 9 }, ...[2, 3, 4, 5].map((i) => ({ id: `L${i}`, lit: true }))];
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 23], carried: 1 }, lanterns, time_left_s: 1 / 60 } });
  const go = run(g, 1, { ...idle, interact: true }).find((e) => e.name === 'game_over');
  assert.deepEqual(go.data, { result: 'won', reason: 'all_lit' });
  assert.equal(g.score, 10 + 100 + 0 + 150);
});

test('map sanity: standard lantern counts, starts on ground, pads land on target island', () => {
  assert.deepEqual([1, 2, 3].map((n) => MAPS[n].lanterns.length), [5, 6, 7]);
  for (const n of [1, 2, 3]) assert.notEqual(MAPS[n].surface(MAPS[n].start[0], MAPS[n].start[2]), null);
  for (const n of [1, 2, 3]) for (const p of MAPS[n].motePoints) assert.equal(MAPS[n].surface(p[0], p[2]), p[1], `night ${n} point ${p}`);
  for (const n of [1, 2, 3]) for (const l of MAPS[n].lanterns) assert.equal(MAPS[n].surface(l[0], l[2]), l[1], `night ${n} lantern ${l}`);
});

test('scenario shade ids: given ids kept, missing ids filled without collision; bad state rejected', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, shades: [{ pos: [9, 1, 0] }, { id: 'S1', pos: [8, 1, 0] }] } });
  assert.deepEqual(g.shades.map((s) => s.id), ['S2', 'S1']);
  assert.throws(() => createGame({ seed: 1, scenario: { shades: [{ pos: [0, 1, 0], state: 'angry' }] } }));
});

test('inputs: held values persist, button edges, strict tick order, pause allowed', () => {
  const tl = new InputTimeline(parseInputs({ frames: [{ tick: 0, move: [0, 1] }, { tick: 5, pulse: true, pause: false }] }));
  assert.deepEqual(tl.at(0).move, [0, 1]);
  assert.equal(tl.at(4).pulse, false);
  assert.equal(tl.at(5).pulse, true);
  assert.throws(() => parseInputs({ frames: [{ tick: 3 }, { tick: 3 }] }));
  assert.throws(() => parseInputs({ frames: [{ tick: 0, move: [1] }] }));
  assert.throws(() => parseInputs({ frames: [{ tick: 0, dash: 1 }] }));
  assert.throws(() => parseInputs([]));
});

function tmpFile(content) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-')), 'f.json');
  fs.writeFileSync(f, content);
  return f;
}

test('AC17 CLI: malformed inputs/scenario -> exit 2 with stderr', () => {
  for (const [kind, body] of [
    ['inputs', '{not json'],
    ['inputs', '{"frames":[{"tick":2},{"tick":1}]}'],
    ['scenario', '{"player":{"pos":[0,0]}}'],
    ['scenario', '[1,2]'],
    ['scenario', '{"drifters":[{"pos":[0,0,0],"state":"x"}]}'],
  ]) {
    const r = runHeadless({ ticks: 10, [kind]: tmpFile(body) });
    assert.equal(r.code, 2, `${kind} ${body}`);
    assert.match(r.stderr, /error/);
  }
});

test('CLI: bad args / night 4 -> non-zero; nights 1-3 accepted', () => {
  assert.notEqual(runHeadless({ ticks: 10, extra: ['--bogus'] }).code, 0);
  assert.notEqual(runHeadless({ ticks: 10, night: 4 }).code, 0);
  for (const night of [1, 2, 3]) assert.equal(runHeadless({ ticks: 10, night }).code, 0);
});

test('AC16 determinism: same seed/scenario/inputs -> byte-identical output (all nights)', () => {
  const inputs = tmpFile(JSON.stringify({
    frames: [
      { tick: 0, move: [0.3, 1], cam_yaw_deg: 30 },
      { tick: 200, move: [-1, 0.2], pulse: true, dash: true },
      { tick: 201, pulse: false, dash: false },
      { tick: 600, move: [0, -1], cam_yaw_deg: -45, jump: true },
      { tick: 601, jump: false },
    ],
  }));
  for (const night of [1, 2, 3]) {
    const a = runHeadless({ seed: 42, night, ticks: 3000, inputs, every: 7 });
    const b = runHeadless({ seed: 42, night, ticks: 3000, inputs, every: 7 });
    assert.equal(a.code, 0, a.stderr);
    assert.equal(a.raw, b.raw, `night ${night}`);
    assert.notEqual(a.raw, runHeadless({ seed: 43, night, ticks: 3000, inputs, every: 7 }).raw);
  }
});

test('AC16 determinism on every fixture scenario', () => {
  for (const name of fs.readdirSync(new URL('./scenarios/', import.meta.url))) {
    const a = runScenario(name, { seed: 5, ticks: 900 });
    const b = runScenario(name, { seed: 5, ticks: 900 });
    assert.equal(a.raw, b.raw, name);
  }
});

test('output lines: coords rounded to 3 decimals; end is last', () => {
  const r = runHeadless({ seed: 3, night: 3, ticks: 1333 });
  assert.equal(r.lines.at(-1).type, 'end');
  for (const l of r.lines.filter((x) => x.type === 'snapshot')) {
    for (const p of [l.player.pos, l.player.vel, ...l.shades.map((s) => s.pos), ...l.motes.map((m) => m.pos), ...l.drifters.map((d) => d.pos)]) {
      for (const v of p) assert.equal(Math.round(v * 1000) / 1000, v);
    }
  }
});

test('P2-17 a full night (21600 ticks) runs well under 30 s', () => {
  const t0 = Date.now();
  const r = runHeadless({ seed: 1, night: 3, ticks: 21600, scenario: tmpFile(JSON.stringify({ player: { flames: 100000 } })) });
  assert.equal(r.code, 0);
  assert.ok(Date.now() - t0 < 30000);
});
