// P4-2..P4-4: bench scene rules (headless), statistics definitions, camera orbit; soak smoke run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGame, step } from '../src/sim.js';
import { benchScenario, benchStats, benchCamera } from '../src/bench.js';
import { ROOT } from './helpers.js';

test('bench scene: 200 wander shades, 100 motes, L1-L3 lit at fuel 100; seed-deterministic', () => {
  const sc = benchScenario(42);
  const g = createGame({ seed: 42, night: 1, scenario: sc, bench: true });
  assert.equal(g.shades.length, 200);
  assert.ok(g.shades.every((s) => s.state === 'wander' && Math.hypot(s.pos[0], s.pos[2]) <= 38));
  assert.equal(g.motes.length, 100);
  assert.deepEqual(g.lanterns.map((l) => [l.id, l.lit, l.fuelU / 60]), [['L1', true, 100], ['L2', true, 100], ['L3', true, 100], ['L4', false, 0], ['L5', false, 0]]);
  assert.deepEqual(benchScenario(42), sc);
  assert.notDeepEqual(benchScenario(43).shades[0].pos, sc.shades[0].pos);
});

test('bench scene disables spawns, damage, pickup, fuel loss and night end; shades still move', () => {
  const g = createGame({ seed: 42, night: 1, scenario: benchScenario(42), bench: true });
  const p0 = g.shades.map((s) => [...s.pos]);
  const names = new Set();
  for (let k = 0; k < 60 * 300; k++) for (const e of step(g, { move: [0, 0] })) names.add(e.name);
  assert.equal(g.state, 'playing', 'no night end even after 300 s');
  assert.deepEqual([...names], []);
  assert.equal(g.shades.length, 200);
  assert.equal(g.motes.length, 100);
  assert.equal(g.player.flames, 3);
  assert.ok(g.lanterns.slice(0, 3).every((l) => l.lit && l.fuelU === 6000));
  assert.ok(g.shades.some((s, i) => Math.hypot(s.pos[0] - p0[i][0], s.pos[2] - p0[i][2]) > 1), 'shades move');
});

test('bench statistics follow Ticket-04 definitions', () => {
  const dts = [...Array(98).fill(10), 30, 50]; // 100 frames
  const s = benchStats(dts);
  assert.equal(s.frames, 100);
  assert.equal(s.avg_fps, Math.round((1000 * 100 / 1060) * 10) / 10);
  assert.equal(s.p1_low_fps, 20); // k = ceil(1) = 1 -> worst 50 ms
  assert.equal(s.frame_ms_p95, 10);
  const t = benchStats([...Array(190).fill(5), ...Array(10).fill(20)]);
  assert.equal(t.p1_low_fps, 50); // k = 2 -> mean(20, 20)
  assert.equal(t.frame_ms_p95, 5); // 95th percentile nearest-rank = 190th value
});

test('bench camera: r 30, y 15, starts at (30,15,0), counter-clockwise from above, 15 s per lap', () => {
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(benchCamera(0), [30, 15, 0]));
  assert.ok(near(benchCamera(3.75), [0, 15, 30])); // quarter lap -> +Z (angles measured like the maps)
  assert.ok(near(benchCamera(15), [30, 15, 0]));
});

test('soak runner: crash-free, report fields present (3 nights)', () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-soak-')), 'soak.json');
  const r = spawnSync(process.execPath, ['--jitless', '--expose-gc', path.join(ROOT, 'headless/soak.js'), '--seed', '7', '--nights', '3', '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(j.nights, 3);
  assert.equal(j.crashes, 0);
  assert.equal(j.results.length, 3);
  for (const k of ['mem_start_mb', 'mem_end_mb', 'duration_s']) assert.equal(typeof j[k], 'number', k);
});
