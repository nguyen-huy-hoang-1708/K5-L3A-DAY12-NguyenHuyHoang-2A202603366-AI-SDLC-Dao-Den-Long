#!/usr/bin/env node
// Zero-dependency static server for the 3D web client + local leaderboard API (Ticket-04 §3).
//   node tools/serve.js [--port 8080] [--no-open]
//   node tools/serve.js --export-leaderboard out.json      -> {"entries": [...]} in rank order, then exit
// Leaderboard file: data/leaderboard.json (override with DDL_DATA=/path/leaderboard.json).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { addEntry, LB_MAX } from '../src/leaderboard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const DATA = path.resolve(process.env.DDL_DATA || path.join(ROOT, 'data', 'leaderboard.json'));

function readBoard() {
  try {
    const j = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    return Array.isArray(j.entries) ? j.entries.slice(0, LB_MAX) : [];
  } catch {
    return [];
  }
}
function writeBoard(entries) {
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  const tmp = `${DATA}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ entries }, null, 2) + '\n');
  fs.renameSync(tmp, DATA); // atomic replace: survives crashes mid-write
}

const exportTo = opt('--export-leaderboard');
if (exportTo) {
  fs.writeFileSync(exportTo, JSON.stringify({ entries: readBoard() }, null, 2) + '\n');
  console.log(`exported ${readBoard().length} entries from ${DATA} to ${exportTo}`);
  process.exit(0);
}

const PORT = Number(opt('--port') || process.env.PORT || 8080);
const OPEN = !argv.includes('--no-open') && !process.env.NO_OPEN;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const ALLOWED = ['web', 'src'];
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/api/leaderboard') {
    if (req.method === 'GET') return json(res, 200, { entries: readBoard() });
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
      req.on('end', () => {
        try {
          const entries = addEntry(readBoard(), JSON.parse(body));
          writeBoard(entries);
          json(res, 200, { entries });
        } catch (e) {
          json(res, 400, { error: e.message });
        }
      });
      return;
    }
    return json(res, 405, { error: 'method not allowed' });
  }
  if (url === '/' || url === '/web') {
    res.writeHead(302, { Location: '/web/' });
    return res.end();
  }
  let file = path.normalize(path.join(ROOT, url));
  const top = path.relative(ROOT, file).split(path.sep)[0];
  if (!file.startsWith(ROOT) || !ALLOWED.includes(top)) {
    res.writeHead(404);
    return res.end('not found');
  }
  if (url.endsWith('/')) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const link = `http://localhost:${PORT}/web/`;
  console.log(`Đảo Đèn Lồng running at ${link}  (Ctrl+C to stop) · leaderboard: ${DATA}`);
  if (OPEN) {
    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    try {
      spawn(cmd, [link], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
    } catch {}
  }
});
