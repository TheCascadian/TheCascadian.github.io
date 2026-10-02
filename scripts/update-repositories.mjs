#!/usr/bin/env node
/**
 * update-repositories.mjs
 * ------------------------
 * Build-time data generation for the DON — GitHub Project Index.
 *
 * 1. Fetches all owner repositories from the GitHub REST API (paginated).
 * 2. Parses repository-metadata.yml (the local override layer).
 * 3. Merges both into public/data/repositories.json (+ a copy in src/site/data).
 *
 * Usage:
 *   npm run update-repositories
 *   GITHUB_TOKEN=ghp_... npm run update-repositories   # higher rate limits
 *
 * No dependencies: uses Node 18+ built-ins only (fetch, fs).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const METADATA_FILE = join(ROOT, 'repository-metadata.yml');
const OUT_FILES = [
  join(ROOT, 'public', 'data', 'repositories.json'),
  join(ROOT, 'src', 'site', 'data', 'repositories.json'),
];

// ---------------------------------------------------------------------------
// Minimal YAML subset parser (sufficient for repository-metadata.yml):
// supports two nesting levels, inline lists, block lists, folded scalars.
// ---------------------------------------------------------------------------
function parseYaml(text) {
  const lines = text
    .split(/\r?\n/)
    .map((raw) => raw.replace(/\t/g, '  '))
    .filter((l) => l.trim() !== '' && !/^\s*#/.test(l));

  const root = {};
  let i = 0;

  const indentOf = (l) => l.match(/^ */)[0].length;

  function stripScalar(s) {
    s = s.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }
    return s;
  }

  function parseInlineList(s) {
    // [a, b, c]
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(stripScalar);
  }

  function coerceScalar(s) {
    s = stripScalar(s);
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null' || s === '') return s === '' ? null : null;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  }

  function parseBlock(parent, baseIndent) {
    while (i < lines.length) {
      const line = lines[i];
      const ind = indentOf(line);
      if (ind < baseIndent) return;
      const content = line.trim();

      const keyMatch = content.match(/^([A-Za-z0-9_.\- ]+?):(?:\s+(.*))?$/);
      if (!keyMatch) {
        throw new Error(`YAML parse error at line: "${line}"`);
      }
      const key = keyMatch[1].trim();
      const rest = (keyMatch[2] ?? '').trim();
      i++;

      if (rest === '' ) {
        // nested map, block list, or folded scalar
        if (i < lines.length && indentOf(lines[i]) > ind) {
          const next = lines[i].trim();
          if (next.startsWith('- ')) {
            parent[key] = parseList(ind);
          } else {
            const child = {};
            parent[key] = child;
            parseBlock(child, indentOf(lines[i]));
          }
        } else if (i < lines.length && indentOf(lines[i]) === ind && lines[i].trim().startsWith('- ')) {
          parent[key] = parseList(ind);
        } else {
          parent[key] = null;
        }
      } else if (rest.startsWith('>-') || rest.startsWith('>')) {
        // folded scalar: join following more-indented lines
        const parts = [rest.replace(/^>-?/, '').trim()];
        while (i < lines.length && indentOf(lines[i]) > ind) {
          parts.push(lines[i].trim());
          i++;
        }
        parent[key] = parts.filter(Boolean).join(' ');
      } else if (rest.startsWith('[')) {
        parent[key] = parseInlineList(rest);
      } else {
        parent[key] = coerceScalar(rest);
      }
    }
    return parent;
  }

  function parseList(baseIndent) {
    const out = [];
    while (i < lines.length && indentOf(lines[i]) === baseIndent && lines[i].trim().startsWith('- ')) {
      out.push(stripScalar(lines[i].trim().slice(2)));
      i++;
    }
    return out;
  }

  parseBlock(root, 0);
  return root;
}

// ---------------------------------------------------------------------------
// GitHub API
// ---------------------------------------------------------------------------
const metadata = parseYaml(readFileSync(METADATA_FILE, 'utf8'));
const owner = (metadata.site && metadata.site.owner) || process.env.GITHUB_OWNER || 'TheCascadian';
const token = process.env.GITHUB_TOKEN || '';

async function ghFetch(url) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'don-repo-index-builder',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

async function fetchRepos() {
  const repos = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await ghFetch(
      `https://api.github.com/users/${owner}/repos?per_page=100&page=${page}&type=owner&sort=pushed`
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos;
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------
const VALID_CATEGORIES = ['mods', 'hoi4', 'fallout4', 'python', 'random', 'unsorted'];
const VALID_STATUSES = ['active', 'development', 'experimental', 'maintenance', 'archived', 'abandoned', 'unknown'];

function merge(one) {
  const local = (metadata.repositories && metadata.repositories[one.name]) || {};
  if (local.exclude) return null;

  const category = VALID_CATEGORIES.includes(local.category) ? local.category : 'unsorted';
  let status = VALID_STATUSES.includes(local.status) ? local.status : 'unknown';
  // GitHub's archived flag is a hard fact; it upgrades "unknown" but never
  // overrides an explicitly configured status.
  if (one.archived && status === 'unknown') status = 'archived';

  const topics = [...new Set([...(one.topics || []), ...(Array.isArray(local.tags) ? local.tags : [])])];

  return {
    name: one.name,
    displayName: local.displayName || one.name,
    category,
    status,
    featured: local.featured === true,
    description: local.description || one.description || '',
    language: one.language || null,
    stars: one.stargazers_count ?? 0,
    forks: one.forks_count ?? 0,
    updatedAt: one.pushed_at || one.updated_at,
    createdAt: one.created_at,
    url: one.html_url,
    homepage: local.homepage || one.homepage || null,
    topics,
    image: local.image || null,
    notes: local.notes || null,
    related: Array.isArray(local.related) ? local.related : [],
    order: typeof local.order === 'number' ? local.order : null,
    fork: !!one.fork,
    archived: !!one.archived,
  };
}

console.log(`Fetching repositories for ${owner} ...`);
const apiRepos = await fetchRepos();
console.log(`  got ${apiRepos.length} repositories from GitHub API`);

const catalog = apiRepos.map(merge).filter(Boolean);

// Manual ordering first, then most recently pushed.
catalog.sort((a, b) => {
  if (a.order !== null || b.order !== null) {
    if (a.order === null) return 1;
    if (b.order === null) return -1;
    return a.order - b.order;
  }
  return (b.updatedAt || '').localeCompare(a.updatedAt || '');
});

const unsorted = catalog.filter((r) => r.category === 'unsorted');
if (unsorted.length) {
  console.log(`  ${unsorted.length} uncategorized repo(s) placed in UNSORTED: ${unsorted.map((r) => r.name).join(', ')}`);
}

const payload = {
  generatedAt: new Date().toISOString(),
  owner,
  count: catalog.length,
  repositories: catalog,
};

for (const out of OUT_FILES) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Wrote ${out.replace(ROOT + '/', '')} (${catalog.length} entries)`);
}
