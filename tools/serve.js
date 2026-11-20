#!/usr/bin/env node
// Zero-dependency static server for the 3D web client. Usage: node tools/serve.js [--port 8080] [--no-open]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const pi = argv.indexOf('--port');
const PORT = Number(pi >= 0 ? argv[pi + 1] : process.env.PORT || 8080);
const OPEN = !argv.includes('--no-open') && !process.env.NO_OPEN;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const ALLOWED = ['web', 'src'];

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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
  console.log(`Đảo Đèn Lồng running at ${link}  (Ctrl+C to stop)`);
  if (OPEN) {
    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    try {
      spawn(cmd, [link], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
    } catch {}
  }
});
