import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SCEN = path.join(ROOT, 'tests', 'scenarios');

/** Run the headless CLI exactly as the grader would. Returns {code, stderr, lines, raw}. */
export function runHeadless({ seed = 1, ticks, scenario, inputs, every, extra = [] }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-'));
  const out = path.join(dir, 'out.jsonl');
  const args = [path.join(ROOT, 'headless', 'run.js'), '--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out];
  if (scenario) args.push('--scenario', scenario);
  if (inputs) args.push('--inputs', inputs);
  if (every) args.push('--snapshot-every', String(every));
  args.push(...extra);
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const raw = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  const lines = raw ? raw.trim().split('\n').map((l) => JSON.parse(l)) : [];
  return { code: r.status, stderr: r.stderr, lines, raw };
}

/** Run a fixture folder under tests/scenarios/<name>/. */
export function runScenario(name, opts = {}) {
  const d = path.join(SCEN, name);
  const sc = path.join(d, 'scenario.json');
  const inp = path.join(d, 'inputs.json');
  return runHeadless({
    ...opts,
    scenario: fs.existsSync(sc) ? sc : undefined,
    inputs: fs.existsSync(inp) ? inp : undefined,
  });
}

export const events = (lines, name) => lines.filter((l) => l.type === 'event' && (!name || l.name === name));
export const snaps = (lines) => lines.filter((l) => l.type === 'snapshot');
export const end = (lines) => lines[lines.length - 1];
export const snapAt = (lines, t) => snaps(lines).find((s) => s.tick === t);
