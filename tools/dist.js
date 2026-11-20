#!/usr/bin/env node
// Builds the release package: dist/dao-den-long-v<version>-web.zip — a static web build + the tiny Node server/CLI.
// Run: npm run dist   (needs the `zip` command, preinstalled on macOS / most Linux)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const name = `dao-den-long-v${pkg.version}-web`;
const out = path.join(ROOT, 'dist', name);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const copy = (rel) => fs.cpSync(path.join(ROOT, rel), path.join(out, rel), { recursive: true });
for (const rel of ['web', 'src', 'headless', 'tools/serve.js', 'tools/bench.js', 'package.json', 'game.contract.json', 'README.md', 'LICENSE', 'CREDITS.md', 'CHANGELOG.md']) copy(rel);
fs.writeFileSync(path.join(out, 'HOW-TO-RUN.txt'), [
  `Đảo Đèn Lồng v${pkg.version} — bản web tĩnh`,
  '',
  'Cần: Node.js >= 18 và một trình duyệt có WebGL2 (Chrome, Edge, Firefox, Safari bản mới).',
  '  1) Giải nén file zip',
  `  2) cd ${name}`,
  '  3) node tools/serve.js        -> mở http://localhost:8080/web/',
  '',
  'Headless : node headless/run.js --seed 1 --night 1 --ticks 600 --out out.jsonl',
  'Bench    : node tools/bench.js --seed 42 --duration 30 --out bench.json   (cần Google Chrome/Chromium)',
  'Soak     : node --jitless --expose-gc headless/soak.js --seed 7 --nights 10 --out soak.json',
  'Bảng xếp hạng: node tools/serve.js --export-leaderboard out.json',
  '',
  'Thư mục web/ + src/ cũng có thể đặt lên bất kỳ máy chủ tĩnh nào (mở /web/); khi không có tools/serve.js,',
  'bảng xếp hạng lưu trong localStorage của trình duyệt.',
].join('\n') + '\n');
const zip = path.join(ROOT, 'dist', `${name}.zip`);
fs.rmSync(zip, { force: true });
execFileSync('zip', ['-qr', zip, name], { cwd: path.join(ROOT, 'dist') });
console.log(`${zip} (${(fs.statSync(zip).size / 1048576).toFixed(2)} MB)`);
