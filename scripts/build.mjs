#!/usr/bin/env node
/**
 * build.mjs — compiles the static site into ./public (GitHub Pages root).
 *
 * - TypeScript -> ES2020 JS via the local `tsc` binary (no bundler needed).
 * - Copies src/site/index.html + style.css, public/data, public/assets, archive/.
 *
 * Usage: npm run build   (after npm run update-repositories)
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const SITE = join(ROOT, 'src', 'site');

// 1. Compile TypeScript -> app.js
const tsc = join(ROOT, 'node_modules', '.bin', 'tsc');
if (!existsSync(tsc)) {
  console.error('typescript not installed — run: npm install');
  process.exit(1);
}
execFileSync(tsc, ['--strict', '--target', 'es2020', '--module', 'none', '--outFile', join(PUB, 'app.js'), join(SITE, 'main.ts')], { stdio: 'inherit' });
console.log('compiled main.ts -> public/app.js');

// 2. Static assets
mkdirSync(PUB, { recursive: true });
cpSync(join(SITE, 'index.html'), join(PUB, 'index.html'));
cpSync(join(SITE, 'style.css'), join(PUB, 'style.css'));

if (existsSync(join(PUB, 'data')) === false && existsSync(join(SITE, 'data'))) {
  // fall back to committed source data if update step was skipped
  cpSync(join(SITE, 'data'), join(PUB, 'data'), { recursive: true });
}

if (existsSync(join(ROOT, 'archive'))) {
  mkdirSync(join(PUB, 'archive'), { recursive: true });
  cpSync(join(ROOT, 'archive'), join(PUB, 'archive'), { recursive: true });
}

// 3. Sanity check output
const html = readFileSync(join(PUB, 'index.html'), 'utf8');
for (const needle of ['DON', 'main-nav', 'search-input', 'app.js']) {
  if (!html.includes(needle)) {
    console.error(`build sanity check failed: index.html missing "${needle}"`);
    process.exit(1);
  }
}
if (!existsSync(join(PUB, 'data', 'repositories.json'))) {
  console.error('build sanity check failed: public/data/repositories.json missing — run npm run update-repositories');
  process.exit(1);
}

console.log('build complete -> public/');
