// Unit tests for src/sim.js + src/inputs.js, plus CLI error codes and determinism (AC16, AC17).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGame, step, snapshot, TUNING } from '../src/sim.js';
import { parseInputs, InputTimeline } from '../src/inputs.js';
import { runHeadless, runScenario } from './helpers.js';

const EMPTY = { random_motes: false, random_shades: false, motes: [], shades: [] };
const idle = { move: [0, 0], cam_yaw_deg: 0 };
const run = (g, n, input = idle) => {
  const evs = [];
  for (let i = 0; i < n; i++) evs.push(...step(g, input));
  return evs;
};

test('AC3 cam_yaw_deg 90 rotates move [0,1] to +X', () => {
  const g = createGame({ seed: 1, scenario: EMPTY });
  run(g, 60, { move: [0, 1], cam_yaw_deg: 90 });
  const p = snapshot(g).player.pos;
  assert.deepEqual(p, [6, 0, 0]);
});

test('move vectors longer than 1 are normalized', () => {
  const g = createGame({ seed: 1, scenario: EMPTY });
  run(g, 60, { move: [1, 1], cam_yaw_deg: 0 });
  const [x, , z] = snapshot(g).player.pos;
  assert.ok(Math.abs(Math.hypot(x, z) - 6) < 1e-3);
});

test('player is kept on the island (fall disabled)', () => {
  const g = createGame({ seed: 1, scenario: EMPTY });
  run(g, 60 * 20, { move: [0, 1], cam_yaw_deg: 0 });
  assert.equal(snapshot(g).player.pos[2], TUNING.island_radius);
});

test('jump: leaves ground, lands, only from ground', () => {
  const g = createGame({ seed: 1, scenario: EMPTY });
  step(g, { ...idle, jump: true });
  run(g, 10, { ...idle, jump: true }); // held: no re-trigger
  assert.ok(g.player.pos[1] > 0.5);
  run(g, 60, idle);
  assert.equal(g.player.pos[1], 0);
});

test('AC5 carry_capacity limits pickup', () => {
  const motes = Array.from({ length: 15 }, () => [0, 0, 0.5]);
  const g = createGame({ seed: 1, scenario: { ...EMPTY, motes } });
  const evs = run(g, 1);
  assert.equal(evs.filter((e) => e.name === 'mote_picked').length, TUNING.carry_capacity);
  assert.equal(g.player.carried, TUNING.carry_capacity);
  assert.equal(g.motes.length, 5);
});

test('partial deposit keeps lantern unlit', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 23], carried: 3 } } });
  const evs = run(g, 1, { ...idle, interact: true });
  assert.deepEqual(evs.map((e) => e.name), ['deposit']);
  assert.equal(g.lanterns[0].deposited, 3);
  assert.equal(g.lanterns[0].lit, false);
});

test('deposit never exceeds lantern_cost; surplus stays carried', () => {
  // Added after mutation check (amount = carried) survived the suite — see docs/proof/phase-1/README.md.
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 23], carried: 8 }, lanterns: [{ id: 'L1', deposited: 1 }] } });
  const evs = run(g, 1, { ...idle, interact: true });
  assert.deepEqual(evs[0].data, { lantern_id: 'L1', amount: 4, deposited: 5 });
  assert.equal(g.player.carried, 4);
  assert.equal(g.lanterns[0].lit, true);
});

test('nearest unlit lantern in range wins; lit lanterns are skipped', () => {
  const lanterns = [{ id: 'L1', pos: [0, 0, 2], lit: true }, { id: 'L2', pos: [0, 0, 2.2] }, { id: 'L3', pos: [0, 0, -1] }];
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { carried: 1 }, lanterns } });
  const evs = run(g, 1, { ...idle, interact: true });
  assert.equal(evs[0].data.lantern_id, 'L3');
});

test('interact outside interact_radius does nothing', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 22.4], carried: 5 } } });
  assert.deepEqual(run(g, 1, { ...idle, interact: true }), []);
});

test('AC13 pulse without enough light emits nothing', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { carried: 1 }, shades: [{ pos: [3, 1, 0] }] } });
  assert.deepEqual(run(g, 1, { ...idle, pulse: true }), []);
});

test('pulse cooldown: second pulse allowed exactly pulse_cooldown_s later', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { carried: 10 } } });
  const ticks = [];
  for (let k = 0; k < 130; k++) {
    for (const e of step(g, { ...idle, pulse: k % 2 === 0 })) if (e.name === 'pulse') ticks.push(e.tick);
  }
  assert.deepEqual(ticks, [1, 61, 121]);
});

test('hit_drop_ratio rounds down', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { carried: 5 }, shades: [{ pos: [0.5, 1, 0] }] } });
  const [hit] = run(g, 1);
  assert.deepEqual(hit.data, { by: 'shade', flames: 2, dropped: 2 });
  assert.equal(g.player.carried, 3);
});

test('stunned shade does not hit', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, player: { carried: 2 }, shades: [{ pos: [0, 1, 0] }] } });
  const evs = run(g, 1, { ...idle, pulse: true });
  assert.deepEqual(evs.map((e) => e.name), ['pulse']);
  assert.deepEqual(snapshot(g).shades[0].pos, [4, 1, 0]); // degenerate direction pushes along +X
});

test('scenario shade ids: given ids kept, missing ids filled without collision', () => {
  const g = createGame({ seed: 1, scenario: { ...EMPTY, shades: [{ pos: [9, 1, 0] }, { id: 'S1', pos: [8, 1, 0] }] } });
  assert.deepEqual(g.shades.map((s) => s.id), ['S2', 'S1']);
});

test('inputs: held values persist, button edges, strict tick order', () => {
  const tl = new InputTimeline(parseInputs({ frames: [{ tick: 0, move: [0, 1] }, { tick: 5, pulse: true }] }));
  assert.deepEqual(tl.at(0).move, [0, 1]);
  assert.equal(tl.at(4).pulse, false);
  assert.equal(tl.at(5).pulse, true);
  assert.deepEqual(tl.at(9).move, [0, 1]);
  assert.throws(() => parseInputs({ frames: [{ tick: 3 }, { tick: 3 }] }));
  assert.throws(() => parseInputs({ frames: [{ tick: 0, move: [1] }] }));
  assert.throws(() => parseInputs({ frames: [{ tick: 0, jump: 1 }] }));
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
  ]) {
    const r = runHeadless({ ticks: 10, [kind]: tmpFile(body) });
    assert.equal(r.code, 2, `${kind} ${body}`);
    assert.match(r.stderr, /error/);
  }
});

test('CLI: missing required args -> non-zero exit', () => {
  const r = runHeadless({ ticks: 10, extra: ['--bogus'] });
  assert.notEqual(r.code, 0);
});

test('AC16 determinism: same seed/scenario/inputs -> byte-identical output', () => {
  const inputs = tmpFile(JSON.stringify({
    frames: [
      { tick: 0, move: [0.3, 1], cam_yaw_deg: 30 },
      { tick: 200, move: [-1, 0.2], pulse: true },
      { tick: 201, pulse: false },
      { tick: 600, move: [0, -1], cam_yaw_deg: -45, jump: true },
      { tick: 601, jump: false },
    ],
  }));
  const a = runHeadless({ seed: 42, ticks: 3000, inputs, every: 7 });
  const b = runHeadless({ seed: 42, ticks: 3000, inputs, every: 7 });
  assert.equal(a.code, 0, a.stderr);
  assert.ok(a.raw.length > 1000);
  assert.equal(a.raw, b.raw);
  const c = runHeadless({ seed: 43, ticks: 3000, inputs, every: 7 });
  assert.notEqual(a.raw, c.raw, 'different seed changes the world');
});

test('AC16 determinism on every fixture scenario', () => {
  for (const name of fs.readdirSync(new URL('./scenarios/', import.meta.url))) {
    const a = runScenario(name, { seed: 5, ticks: 900 });
    const b = runScenario(name, { seed: 5, ticks: 900 });
    assert.equal(a.raw, b.raw, name);
  }
});

test('output lines: coords rounded to 3 decimals; end is last', () => {
  const r = runHeadless({ seed: 3, ticks: 333 });
  assert.equal(r.lines.at(-1).type, 'end');
  for (const l of r.lines.filter((x) => x.type === 'snapshot')) {
    for (const p of [l.player.pos, ...l.shades.map((s) => s.pos), ...l.motes.map((m) => m.pos)]) {
      for (const v of p) assert.equal(Math.round(v * 1000) / 1000, v);
    }
  }
});
