// P4-6: leaderboard rules, disk persistence through the server API, and --export-leaderboard order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addEntry, nameError, isoLocal } from '../src/leaderboard.js';
import { ROOT } from './helpers.js';

const E = (name, score, at, extra = {}) => ({ name, score, nights_won: 1, achieved_at: at, seed: 7, ...extra });

test('names: 3-12 of [A-Za-z0-9_], Vietnamese letters accepted', () => {
  for (const ok of ['Moy', 'may_2026', 'ABCDEFGHIJKL', 'Hoàng', 'Mây_Đèn']) assert.equal(nameError(ok), null, ok);
  for (const bad of ['ab', 'ABCDEFGHIJKLM', 'two words', 'x-y-z', '', 'a!b']) assert.notEqual(nameError(bad), null, bad);
});

test('sorted by score desc, ties: earlier achieved_at first; keeps top 10', () => {
  let lb = [];
  lb = addEntry(lb, E('late_', 100, '2026-11-20T10:00:00+07:00'));
  lb = addEntry(lb, E('early', 100, '2026-11-20T09:00:00+07:00'));
  lb = addEntry(lb, E('best_', 300, '2026-11-20T11:00:00+07:00'));
  assert.deepEqual(lb.map((e) => e.name), ['best_', 'early', 'late_']);
  for (let i = 0; i < 12; i++) lb = addEntry(lb, E(`p${String(i).padStart(2, '0')}`, i * 10, `2026-11-20T12:00:${String(i).padStart(2, '0')}+07:00`));
  assert.equal(lb.length, 10);
  assert.equal(lb[0].name, 'best_');
  assert.ok(lb.every((e, i) => i === 0 || lb[i - 1].score >= e.score));
  assert.throws(() => addEntry(lb, E('no', 5, '2026-11-20T12:00:00+07:00')));
  assert.throws(() => addEntry(lb, E('ok_name', 5, '2026-11-20T12:00:00+07:00', { nights_won: 4 })));
});

test('isoLocal has a time-zone offset and parses', () => {
  const s = isoLocal(new Date(Date.UTC(2026, 10, 20, 8, 4, 5)));
  assert.match(s, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  assert.equal(Date.parse(s), Date.UTC(2026, 10, 20, 8, 4, 5));
});

test('server persists entries to disk and --export-leaderboard writes them in order', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-lb-'));
  const data = path.join(dir, 'lb.json');
  const port = 9000 + Math.floor(Math.random() * 800);
  const env = { ...process.env, DDL_DATA: data, NO_OPEN: '1' };
  const srv = spawn(process.execPath, [path.join(ROOT, 'tools/serve.js'), '--port', String(port), '--no-open'], { env, stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 50 && !up; i++) { try { await fetch(`http://127.0.0.1:${port}/api/leaderboard`); up = true; } catch { await new Promise((r) => setTimeout(r, 100)); } }
    const post = (e) => fetch(`http://127.0.0.1:${port}/api/leaderboard`, { method: 'POST', body: JSON.stringify(e) });
    assert.equal((await post(E('Hoàng', 50, '2026-11-20T10:00:00+07:00'))).status, 200);
    assert.equal((await post(E('top_one', 900, '2026-11-20T11:00:00+07:00', { nights_won: 3 }))).status, 200);
    assert.equal((await post(E('x', 1, '2026-11-20T11:00:00+07:00'))).status, 400, 'invalid name rejected');
  } finally {
    srv.kill();
  }
  // "Restart the game": a new process reads the same file.
  const out = path.join(dir, 'out.json');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/serve.js'), '--export-leaderboard', out], { env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(j.entries.map((e) => [e.name, e.score, e.nights_won]), [['top_one', 900, 3], ['Hoàng', 50, 1]]);
  for (const e of j.entries) assert.deepEqual(Object.keys(e).sort(), ['achieved_at', 'name', 'nights_won', 'score', 'seed']);
});
