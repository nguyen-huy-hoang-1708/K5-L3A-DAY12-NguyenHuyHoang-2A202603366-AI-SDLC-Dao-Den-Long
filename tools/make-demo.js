#!/usr/bin/env node
// Records docs/demo/demo.mp4 (< 5 min) from the REAL game running in Chrome (GPU, 1280×720):
//   menu → night 1 played by a keyboard bot (real key events, normal speed) → pause/settings/key remap →
//   nights 2 and 3 → bench scene → a page showing the real outputs of npm test, headless, bench.json, soak.json, git log.
// Frames are captured with CDP screenshots and encoded with ffmpeg. Usage: node tools/make-demo.js [--out docs/demo/demo.mp4]
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('--out', path.join(ROOT, 'docs/demo/demo.mp4')));
const FPS = 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRAMES = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-demo-'));
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && fs.existsSync(p));
const PORT = 8000 + Math.floor(Math.random() * 900);
const LB = path.join(FRAMES, 'lb.json');
const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve.js'), '--no-open', '--port', String(PORT)], { stdio: 'ignore', env: { ...process.env, DDL_DATA: LB } });
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(FRAMES, 'profile')}`, '--window-size=1280,720', '--use-angle=metal', '--mute-audio', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const cleanup = () => { chrome.kill(); server.kill(); };
process.on('exit', cleanup);
const wsUrl = await new Promise((res) => { let b = ''; chrome.stderr.on('data', (d) => { b += d; const m = b.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]); }); });
const t = (await (await fetch(wsUrl.replace('ws://', 'http://').replace(/\/devtools\/browser.*/, '/json'))).json()).find((x) => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pend.has(msg.id)) { pend.get(msg.id)(msg); pend.delete(msg.id); } };
const cdp = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (e) => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

let frame = 0;
async function record(seconds, during = null) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const t0 = Date.now();
    const { data } = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
    fs.writeFileSync(path.join(FRAMES, `f${String(frame++).padStart(6, '0')}.jpg`), Buffer.from(data, 'base64'));
    if (during) await during();
    await sleep(Math.max(0, 1000 / FPS - (Date.now() - t0)));
  }
}
const KEY = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', KeyF: 'f', Space: ' ', Enter: 'Enter', Escape: 'Escape', ShiftLeft: 'Shift' };
const held = new Set();
const key = (code, down) => cdp('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', code, key: KEY[code] });
const tap = async (code) => { await key(code, true); await sleep(40); await key(code, false); };
async function hold(codes) {
  for (const c of [...held]) if (!codes.includes(c)) { await key(c, false); held.delete(c); }
  for (const c of codes) if (!held.has(c)) { await key(c, true); held.add(c); }
}
async function botStep() {
  const s = await js(`(() => { const g = window.__game; if (!g || g.state !== 'playing') return null; return { p: g.player.pos, c: g.player.carried, m: g.motes.map(m => m.pos), l: g.lanterns.map(l => ({ pos: l.pos, lit: l.lit, dep: l.deposited, fuel: l.fuelU, ever: l.everLit })), sh: g.shades.map(s => ({ pos: s.pos, st: s.state })), cd: g.player.pulseCdT }; })()`);
  if (!s) return hold([]);
  const d = (q) => Math.hypot(q[0] - s.p[0], q[2] - s.p[2]);
  const unlit = s.l.filter((l) => !l.lit).sort((a, b) => d(a.pos) - d(b.pos));
  const weak = s.l.filter((l) => l.lit && l.fuel < 3000).sort((a, b) => d(a.pos) - d(b.pos));
  let target = null, interact = false;
  const goal = weak[0] && s.c >= 3 ? weak[0] : unlit[0] && s.c >= (unlit[0].ever ? 5 : 10) - unlit[0].dep ? unlit[0] : null;
  if (goal) { target = goal.pos; interact = d(target) <= 1.6; } else target = [...s.m].sort((a, b) => d(a) - d(b))[0];
  if (s.sh.some((x) => (x.st === 'chase' || x.st === 'wander') && d(x.pos) < 3.5) && s.c >= 3 && s.cd === 0) await tap('KeyF');
  const codes = [];
  if (target && !interact) {
    const dx = target[0] - s.p[0], dz = target[2] - s.p[2];
    if (dz > 0.25) codes.push('KeyW'); if (dz < -0.25) codes.push('KeyS');
    if (dx > 0.25) codes.push('KeyA'); if (dx < -0.25) codes.push('KeyD');
  }
  await hold(codes);
  if (interact) await tap('KeyE');
}
const base = `http://localhost:${PORT}/web/`;
const go = async (q) => { await cdp('Page.navigate', { url: base + q }); await sleep(2200); };

console.log('1/6 menu + night 1 (bot, real time)');
await go('?seed=11');
await record(3);
await tap('Enter');
await record(3);
await tap('Enter');
await record(55, botStep);
await hold([]);
console.log('2/6 pause, settings, key remap');
await tap('Escape');
await record(2);
await js(`document.getElementById('b-set').click()`);
await record(3);
await js(`document.getElementById('b-keys').click()`);
await record(3);
await js(`document.getElementById('b-kdone').click()`);
await js(`document.getElementById('b-back').click()`);
await js(`document.getElementById('b-res').click()`);
await record(8, botStep);
await hold([]);
console.log('3/6 nights 2 and 3');
await go('?seed=12&night=2&autostart=1');
await record(14, botStep);
await hold([]);
await go('?seed=13&night=3&autostart=1&lit=3');
await record(14, botStep);
await hold([]);
console.log('4/6 leaderboard');
await go('?seed=14');
await js(`fetch('/api/leaderboard', { method: 'POST', body: JSON.stringify({ name: 'Mây_Demo', score: 1234, nights_won: 2, achieved_at: new Date().toISOString(), seed: 14 }) })`);
await js(`document.getElementById('b-lb').click()`);
await record(4);
console.log('5/6 bench scene');
await go('?bench=1&seed=42&duration=8');
await record(10);

console.log('6/6 real outputs (tests, headless, bench, soak, git)');
const run = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }); return (r.stdout + r.stderr).trim(); };
const testOut = run('npm', ['test', '--silent']).split('\n').filter((l) => /^ℹ|✔ (AC|P[234]-|v1|palette|bench|soak|names|server)/.test(l)).slice(-40).join('\n');
const tmp = path.join(FRAMES, 'h.jsonl');
run(process.execPath, ['headless/run.js', '--seed', '1', '--night', '1', '--ticks', '600', '--scenario', 'tests/scenarios/refuel/scenario.json', '--inputs', 'tests/scenarios/refuel/inputs.json', '--out', tmp, '--snapshot-every', '300']);
const headless = fs.readFileSync(tmp, 'utf8').split('\n').filter(Boolean).map((l) => (l.length > 220 ? l.slice(0, 220) + ' …' : l)).join('\n');
const esc = (x) => x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const sec = (title, cmd, body) => `<section><h2>${title}</h2><div class="cmd">$ ${esc(cmd)}</div><pre>${esc(body)}</pre></section>`;
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#0E1430;color:#F5F1E6;font:18px/1.45 Menlo,monospace;padding:24px 32px}h1{color:#F2C14E;font-family:Georgia,serif}h2{color:#F2C14E;margin:26px 0 6px}.cmd{color:#9fe1ff}pre{white-space:pre-wrap;margin:6px 0;background:#121a3d;padding:10px;border-left:3px solid #F2C14E}</style>
<h1>Đảo Đèn Lồng v1.0.0 — bằng chứng (output thật, sinh lúc quay video)</h1>
${sec('Test tự động', 'npm test', testOut)}
${sec('Headless (Test Contract v1.3) — châm dầu', 'node headless/run.js --seed 1 --night 1 --ticks 600 --scenario tests/scenarios/refuel/scenario.json ...', headless)}
${sec('Benchmark (cửa sổ Chrome 1280×720, vsync tắt)', 'cat bench.json', fs.readFileSync(path.join(ROOT, 'bench.json'), 'utf8'))}
${sec('Soak 10 Đêm', 'cat soak.json', fs.readFileSync(path.join(ROOT, 'soak.json'), 'utf8'))}
${sec('Mutation check', 'tools/mutation-check.sh | tail -3', fs.readFileSync(path.join(ROOT, 'docs/proof/phase-4/mutation-check.txt'), 'utf8').trim().split('\n').slice(-3).join('\n'))}
${sec('Lịch sử git + tag', 'git log --oneline --decorate | head -25', run('git', ['log', '--oneline', '--decorate', '-25']))}`;
await cdp('Page.navigate', { url: 'about:blank' });
await sleep(300);
const { frameTree } = await cdp('Page.getFrameTree');
await cdp('Page.setDocumentContent', { frameId: frameTree.frame.id, html });
await sleep(500);
const H = await js('document.body.scrollHeight');
for (let y = 0; y <= H; y += 120) {
  await js(`window.scrollTo(0, ${y})`);
  await record(1.3);
}
await record(2);

cleanup();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FRAMES, 'f%06d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-preset', 'veryfast', '-movflags', '+faststart', OUT]);
const dur = (frame / FPS).toFixed(1);
console.log(`${OUT}: ${frame} frames, ${dur} s, ${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB`);
process.exit(0);
