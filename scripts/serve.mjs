#!/usr/bin/env node
/** serve.mjs — tiny static file server for local development (no deps). */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = join(process.cwd(), 'public');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

createServer(async (req, res) => {
  let path = decodeURIComponent(req.url.split('?')[0]);
  if (path === '/') path = '/index.html';
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    // SPA fallback via hash routing — everything lives at /index.html
    try {
      const body = await readFile(join(ROOT, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(body);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  }
}).listen(8080, () => console.log('dev server: http://localhost:8080'));
