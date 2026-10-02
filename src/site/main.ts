/* ==========================================================================
   DON — GitHub Project Index :: catalog application (TypeScript)
   Hash-routed, client-side filtering/sorting over a build-time generated
   repositories.json. No framework; DOM only.
   ========================================================================== */

interface Repo {
  name: string;
  displayName: string;
  category: string;
  status: string;
  featured: boolean;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
  createdAt: string;
  url: string;
  homepage: string | null;
  topics: string[];
  image: string | null;
  notes: string | null;
  related: string[];
  order: number | null;
  fork: boolean;
  archived: boolean;
}

interface CatalogData {
  generatedAt: string;
  owner: string;
  count: number;
  repositories: Repo[];
}

interface CategoryDef {
  id: string;          // route segment / category key
  label: string;       // nav label
  title: string;       // landing heading
  desc: string;        // landing description
  sigil: string;       // fallback thumbnail text
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'mods', label: 'Universal Mods', title: 'UNIVERSAL MODS',
    desc: 'Minecraft modding under the Universal umbrella — NeoForge / Forge / Fabric mods, libraries, utilities, compatibility projects, ports, restorations and revivals.',
    sigil: 'MC',
  },
  {
    id: 'hoi4', label: 'HOI4 Tooling', title: 'HOI4 MOD TOOLING',
    desc: 'Hearts of Iron IV development tools — GUI tooling, modding utilities, localization, data parsers, editors, generators and automation.',
    sigil: 'H4',
  },
  {
    id: 'fallout4', label: 'Fallout 4 Tooling', title: 'FALLOUT 4 TOOLING',
    desc: 'Tools and experiments for Fallout 4 mod development, asset processing, worldspace editing, NIF/ESP workflows and related technical pipelines.',
    sigil: 'F4',
  },
  {
    id: 'python', label: 'Python', title: 'PYTHON',
    desc: 'General Python work that does not belong to a more specific domain — libraries, utilities, desktop applications, procedural generation and developer tooling.',
    sigil: 'PY',
  },
  {
    id: 'random', label: 'Random', title: 'RANDOM PROJECTS',
    desc: 'Everything that does not cleanly belong elsewhere — experiments, prototypes, one-off tools, research and miscellaneous builds.',
    sigil: 'RK',
  },
  {
    id: 'unsorted', label: 'Unsorted', title: 'UNSORTED',
    desc: 'Repositories discovered on GitHub that have not been categorized yet. Explicit holding state — nothing is silently dropped.',
    sigil: '??',
  },
];

const STATUSES = ['active', 'development', 'experimental', 'maintenance', 'archived', 'abandoned', 'unknown'];

let DATA: CatalogData;
let REPOS: Repo[] = [];

/* ---------------------------------------------------------------- routing */

interface RouteState {
  view: string;            // 'all' or category id
  q: string;
  lang: string;
  status: string;
  topic: string;
  sort: string;
}

function defaultState(): RouteState {
  return { view: 'all', q: '', lang: '*', status: '*', topic: '*', sort: 'updated' };
}

function parseHash(): RouteState {
  const st = defaultState();
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return st;
  const [pathPart, queryPart] = hash.split('?');
  const seg = pathPart.replace(/^\/+|\/+$/g, '');
  if (seg && seg !== 'all') {
    if (CATEGORIES.some((c) => c.id === seg)) st.view = seg;
  }
  if (queryPart) {
    const p = new URLSearchParams(queryPart);
    if (p.get('q')) st.q = p.get('q') as string;
    if (p.get('lang')) st.lang = p.get('lang') as string;
    if (p.get('status')) st.status = p.get('status') as string;
    if (p.get('topic')) st.topic = p.get('topic') as string;
    if (p.get('sort')) st.sort = p.get('sort') as string;
  }
  return st;
}

function writeHash(st: RouteState): void {
  const p = new URLSearchParams();
  if (st.q) p.set('q', st.q);
  if (st.lang !== '*') p.set('lang', st.lang);
  if (st.status !== '*') p.set('status', st.status);
  if (st.topic !== '*') p.set('topic', st.topic);
  if (st.sort !== 'updated') p.set('sort', st.sort);
  const base = '#/' + (st.view === 'all' ? '' : st.view);
  const qs = p.toString();
  const next = qs ? `${base}?${qs}` : base;
  if (location.hash !== next) history.replaceState(null, '', next || '#/');
}

/* ---------------------------------------------------------------- helpers */

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function catById(id: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

function relTime(iso: string): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function repoByName(name: string): Repo | undefined {
  return REPOS.find((r) => r.name === name);
}

/* ---------------------------------------------------------------- filtering */

function applyFilters(st: RouteState): Repo[] {
  let list = REPOS;
  if (st.view !== 'all') list = list.filter((r) => r.category === st.view);
  if (st.lang !== '*') list = list.filter((r) => (r.language || 'None') === st.lang);
  if (st.status !== '*') list = list.filter((r) => r.status === st.status);
  if (st.topic !== '*') list = list.filter((r) => r.topics.includes(st.topic));

  if (st.q.trim()) {
    const terms = st.q.trim().toLowerCase().split(/\s+/);
    list = list.filter((r) => {
      const hay = [r.name, r.displayName, r.description, r.category, r.language || '', r.status, ...r.topics]
        .join(' ').toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }

  const sorted = [...list];
  switch (st.sort) {
    case 'created': sorted.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); break;
    case 'name':    sorted.sort((a, b) => a.displayName.localeCompare(b.displayName)); break;
    case 'stars':   sorted.sort((a, b) => b.stars - a.stars || a.displayName.localeCompare(b.displayName)); break;
    case 'forks':   sorted.sort((a, b) => b.forks - a.forks || a.displayName.localeCompare(b.displayName)); break;
    default:        sorted.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }
  return sorted;
}

/* ---------------------------------------------------------------- card html */

function cardHtml(r: Repo): string {
  const cat = catById(r.category);
  const thumb = r.image
    ? `<div class="card-thumb"><img src="${esc(r.image)}" alt="" loading="lazy" width="400" height="120"></div>`
    : `<div class="thumb-fallback" role="img" aria-label="No screenshot — ${esc(cat ? cat.label : r.category)} placeholder">${esc(cat ? cat.sigil : '??')}</div>`;

  const desc = r.description
    ? `<p class="card-desc">${esc(r.description)}</p>`
    : `<p class="card-desc empty">No description provided.</p>`;

  const topics = r.topics.length
    ? `<div class="card-topics">${r.topics.slice(0, 6).map((t) =>
        `<a class="topic-tag" href="#" data-topic="${esc(t)}" role="button">#${esc(t)}</a>`).join('')}</div>`
    : '';

  const related = r.related.length
    ? `<div class="card-related"><span>related:</span>${r.related.map((n) => {
        const target = repoByName(n);
        if (target) {
          return `<a href="#/${esc(target.category)}" data-jump="${esc(n)}">${esc(n)}</a>`;
        }
        return `<a href="https://github.com/${esc(DATA.owner)}/${encodeURIComponent(n)}" target="_blank" rel="noopener">${esc(n)} ↗</a>`;
      }).join('')}</div>`
    : '';

  const notes = r.notes ? `<p class="card-notes">${esc(r.notes)}</p>` : '';
  const featured = r.featured ? `<span class="featured-flag">Featured</span>` : '';
  const langClass = 'lang-' + (r.language ? r.language.replace(/[^A-Za-z]/g, '') : 'None');

  return `<article class="repo-card" data-cat="${esc(r.category)}" data-repo="${esc(r.name)}">
  <div class="card-body">
    <div class="card-top">
      <div>
        <a class="repo-name" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.displayName)}</a>${featured ? ' ' + featured : ''}
      </div>
      <span class="status-badge st-${esc(r.status)}" title="Project status (manually configured)">${esc(r.status)}</span>
    </div>
    ${thumb}
    ${desc}
    ${notes}
    ${topics}
    ${related}
    <div class="card-meta">
      <span><span class="lang-dot ${langClass}" aria-hidden="true"></span>${esc(r.language || 'No language')}</span>
      <span class="stat" title="Stars">★ <b>${r.stars}</b></span>
      <span class="stat" title="Forks">⑂ <b>${r.forks}</b></span>
      <span title="Last push">${esc(fmtDate(r.updatedAt))} <span style="opacity:.7">(${esc(relTime(r.updatedAt))})</span></span>
      ${r.fork ? '<span>fork</span>' : ''}
    </div>
  </div>
  <div class="card-foot">
    <a href="${esc(r.url)}" target="_blank" rel="noopener">SOURCE ↗</a>
    ${r.homepage ? `<a href="${esc(r.homepage)}" target="_blank" rel="noopener">HOMEPAGE ↗</a>` : ''}
  </div>
</article>`;
}

/* ---------------------------------------------------------------- rendering */

function countsByCategory(): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of CATEGORIES) m.set(c.id, 0);
  for (const r of REPOS) m.set(r.category, (m.get(r.category) || 0) + 1);
  return m;
}

function renderNavAndSidebar(st: RouteState): void {
  const counts = countsByCategory();

  const nav = document.getElementById('main-nav') as HTMLElement;
  const navItems = [`<a class="nav-link" data-cat="all" href="#/" ${st.view === 'all' ? 'aria-current="page"' : ''}>All<span class="nav-count">${REPOS.length}</span></a>`]
    .concat(CATEGORIES.map((c) =>
      `<a class="nav-link" data-cat="${c.id}" href="#/${c.id}" ${st.view === c.id ? 'aria-current="page"' : ''}>${esc(c.label)}<span class="nav-count">${counts.get(c.id) || 0}</span></a>`));
  nav.innerHTML = navItems.join('');

  const sidebar = document.getElementById('sidebar') as HTMLElement;
  sidebar.innerHTML = `
    <h2 class="side-title">Categories</h2>
    <ul class="cat-list">
      ${CATEGORIES.map((c) => `
        <li class="cat-item" data-cat="${c.id}">
          <a href="#/${c.id}" ${st.view === c.id ? 'aria-current="page"' : ''}>
            <span class="cat-name">${esc(c.label)} <span class="count">${String(counts.get(c.id) || 0).padStart(2, '0')}</span></span>
            <span class="cat-desc">${esc(shortDesc(c))}</span>
          </a>
        </li>`).join('')}
    </ul>
    <h2 class="side-title">Filter · Language</h2>
    <div class="filter-group">${langSelectHtml(st, 'lang-desktop')}</div>
    <h2 class="side-title">Filter · Status</h2>
    <div class="filter-group">${statusSelectHtml(st, 'status-desktop')}</div>
    <h2 class="side-title">Filter · Topic</h2>
    <div class="filter-group">${topicSelectHtml(st, 'topic-desktop')}</div>
    <h2 class="side-title">&nbsp;</h2>
    <button type="button" class="reset-btn" id="reset-desktop">Reset filters</button>`;

  const mobile = document.getElementById('mobile-filterbar') as HTMLElement;
  mobile.innerHTML = `
    ${viewSelectHtml(st, 'view-mobile')}
    ${langSelectHtml(st, 'lang-mobile')}
    ${statusSelectHtml(st, 'status-mobile')}
    ${topicSelectHtml(st, 'topic-mobile')}`;
}

function shortDesc(c: CategoryDef): string {
  const map: Record<string, string> = {
    mods: 'Minecraft mods, libraries & compatibility work',
    hoi4: 'Hearts of Iron IV development tooling',
    fallout4: 'Fallout 4 mod & asset tooling',
    python: 'General Python projects & utilities',
    random: 'Experiments, prototypes & miscellany',
    unsorted: 'Not yet categorized — needs review',
  };
  return map[c.id] || '';
}

function allLanguages(): string[] {
  return [...new Set(REPOS.map((r) => r.language || 'None'))].sort();
}
function allTopics(): string[] {
  return [...new Set(REPOS.flatMap((r) => r.topics))].sort();
}

function langSelectHtml(st: RouteState, id: string): string {
  const opts = ['*', ...allLanguages()].map((l) =>
    `<option value="${esc(l)}" ${st.lang === l ? 'selected' : ''}>${l === '*' ? 'All languages' : esc(l)}</option>`).join('');
  return `<select class="filter-select" id="${id}" data-filter="lang" aria-label="Filter by language"><optgroup label="Language">${opts}</optgroup></select>`;
}
function statusSelectHtml(st: RouteState, id: string): string {
  const opts = ['*', ...STATUSES].map((s) =>
    `<option value="${esc(s)}" ${st.status === s ? 'selected' : ''}>${s === '*' ? 'All statuses' : s.toUpperCase()}</option>`).join('');
  return `<select class="filter-select" id="${id}" data-filter="status" aria-label="Filter by project status"><optgroup label="Status">${opts}</optgroup></select>`;
}
function topicSelectHtml(st: RouteState, id: string): string {
  const opts = ['*', ...allTopics()].map((t) =>
    `<option value="${esc(t)}" ${st.topic === t ? 'selected' : ''}>${t === '*' ? 'All topics' : '#' + esc(t)}</option>`).join('');
  return `<select class="filter-select" id="${id}" data-filter="topic" aria-label="Filter by topic"><optgroup label="Topic">${opts}</optgroup></select>`;
}
function viewSelectHtml(st: RouteState, id: string): string {
  const opts = [{ id: 'all', label: 'All projects' }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))]
    .map((v) => `<option value="${v.id}" ${st.view === v.id ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
  return `<select class="filter-select" id="${id}" data-filter="view" aria-label="Select category view"><optgroup label="Category">${opts}</optgroup></select>`;
}

function renderMain(st: RouteState): void {
  const main = document.getElementById('main') as HTMLElement;
  const filtered = applyFilters(st);
  const cat = st.view === 'all' ? undefined : catById(st.view);

  let headHtml: string;
  if (cat) {
    document.title = `${cat.title.toLowerCase()} · DON — GitHub Project Index`;
    headHtml = `
      <header class="view-head">
        <div class="view-title-row">
          <h1 class="view-title">${esc(cat.title)}</h1>
          <span class="view-rule" aria-hidden="true"></span>
          <span class="view-count">${filtered.length} / ${countsByCategory().get(cat.id) || 0} repos</span>
        </div>
        <p class="view-desc">${esc(cat.desc)}</p>
      </header>`;
  } else {
    document.title = 'DON — GitHub Project Index';
    const counts = countsByCategory();
    const total = REPOS.length || 1;
    headHtml = `
      <header class="view-head">
        <div class="view-title-row">
          <h1 class="view-title">ALL PROJECTS</h1>
          <span class="view-rule" aria-hidden="true"></span>
          <span class="view-count">${REPOS.length} repositories indexed</span>
        </div>
        <p class="view-desc">Complete repository catalog — categorized, searchable, filterable. Every entry links to its source on GitHub.</p>
        <div class="dist-bar" role="img" aria-label="Category distribution: ${CATEGORIES.map((c) => `${c.label}: ${counts.get(c.id) || 0}`).join(', ')}">
          ${CATEGORIES.filter((c) => (counts.get(c.id) || 0) > 0).map((c) =>
            `<span class="dist-seg" style="flex:${counts.get(c.id)};background:var(--cat-${c.id})" title="${esc(c.label)}: ${counts.get(c.id)}"></span>`).join('')}
        </div>
        <div class="dist-legend">
          ${CATEGORIES.filter((c) => (counts.get(c.id) || 0) > 0).map((c) =>
            `<span><span class="sw" style="background:var(--cat-${c.id})"></span>${esc(c.label.toUpperCase())} ${counts.get(c.id)}</span>`).join('')}
        </div>
      </header>`;
  }

  const toolbarHtml = `
    <div class="toolbar">
      <label for="sort-select">Sort</label>
      <select id="sort-select" data-filter="sort" aria-label="Sort repositories">
        ${[['updated', 'Recently updated'], ['created', 'Recently created'], ['name', 'Name A–Z'], ['stars', 'Stars'], ['forks', 'Forks']]
          .map(([v, l]) => `<option value="${v}" ${st.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <span class="result-info" aria-live="polite">${filtered.length} shown${st.q ? ` · query "${esc(st.q)}"` : ''}${st.status !== '*' ? ` · status:${st.status}` : ''}${st.lang !== '*' ? ` · lang:${st.lang}` : ''}${st.topic !== '*' ? ` · #${st.topic}` : ''}</span>
    </div>`;

  let gridHtml: string;
  if (filtered.length === 0) {
    gridHtml = `<div class="empty-state">No repositories match the current filters.<br>Try clearing the search or resetting filters.</div>`;
  } else if (st.view === 'all' && !st.q && st.lang === '*' && st.status === '*' && st.topic === '*') {
    // Featured section only in the unfiltered All view
    const featured = filtered.filter((r) => r.featured);
    const rest = filtered.filter((r) => !r.featured);
    gridHtml =
      (featured.length
        ? `<section class="featured-section" aria-labelledby="featured-label">
             <h2 class="section-label" id="featured-label">Featured — manually selected for attention</h2>
             <div class="repo-grid">${featured.map(cardHtml).join('')}</div>
           </section>`
        : '') +
      `<section aria-label="All repositories"><h2 class="section-label">Full catalog</h2><div class="repo-grid">${rest.map(cardHtml).join('')}</div></section>`;
  } else {
    gridHtml = `<div class="repo-grid">${filtered.map(cardHtml).join('')}</div>`;
  }

  main.innerHTML = headHtml + toolbarHtml + gridHtml;
}

/* ---------------------------------------------------------------- events */

let currentState: RouteState = defaultState();

function setState(patch: Partial<RouteState>, pushTitle?: boolean): void {
  currentState = { ...currentState, ...patch };
  writeHash(currentState);
  renderNavAndSidebar(currentState);
  renderMain(currentState);
  if (pushTitle) { /* titles handled in renderMain */ }
}

function syncSearchInput(): void {
  const el = document.getElementById('search-input') as HTMLInputElement | null;
  if (el && el.value !== currentState.q) el.value = currentState.q;
}

function wireEvents(): void {
  // delegated change events for selects
  document.addEventListener('change', (ev) => {
    const t = ev.target as HTMLElement;
    const filter = t.getAttribute && t.getAttribute('data-filter');
    if (!filter) return;
    const sel = t as HTMLSelectElement;
    if (filter === 'view') {
      setState({ view: sel.value === 'all' ? 'all' : sel.value });
    } else {
      setState({ [filter]: sel.value } as Partial<RouteState>);
      // mirror same-filter selects elsewhere
      document.querySelectorAll(`[data-filter="${filter}"]`).forEach((other) => {
        if (other !== sel) (other as HTMLSelectElement).value = sel.value;
      });
    }
  });

  // click delegation: topic chips, reset, related jumps
  document.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement;
    if (!target.closest) return;

    const chip = target.closest('[data-topic]') as HTMLElement | null;
    if (chip) {
      ev.preventDefault();
      const t = chip.getAttribute('data-topic') || '*';
      setState({ topic: currentState.topic === t ? '*' : t });
      return;
    }
    const jump = target.closest('[data-jump]') as HTMLElement | null;
    if (jump) {
      ev.preventDefault();
      const name = jump.getAttribute('data-jump') || '';
      const r = repoByName(name);
      if (r) {
        setState({ view: r.category, q: '', lang: '*', status: '*', topic: '*', sort: 'updated' });
        setTimeout(() => {
          const card = document.querySelector(`[data-repo="${CSS.escape(name)}"]`);
          if (card) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 30);
      }
      return;
    }
    if (target.closest('.reset-btn')) {
      setState({ q: '', lang: '*', status: '*', topic: '*', sort: 'updated' });
      syncSearchInput();
      return;
    }
  });

  // search input (debounced)
  const search = document.getElementById('search-input') as HTMLInputElement;
  let timer = 0;
  search.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => setState({ q: search.value }), 120);
  });

  // "/" focuses search
  document.addEventListener('keydown', (ev) => {
    if (ev.key === '/' && !(ev.target instanceof HTMLInputElement) && !(ev.target instanceof HTMLSelectElement)) {
      ev.preventDefault();
      search.focus();
    }
    if (ev.key === 'Escape' && ev.target === search) {
      search.value = '';
      setState({ q: '' });
    }
  });

  window.addEventListener('hashchange', () => {
    currentState = parseHash();
    renderNavAndSidebar(currentState);
    renderMain(currentState);
    syncSearchInput();
  });
}

/* ---------------------------------------------------------------- boot */

async function boot(): Promise<void> {
  const res = await fetch('data/repositories.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Failed to load repository catalog.');
  DATA = (await res.json()) as CatalogData;
  REPOS = DATA.repositories;

  const gen = document.getElementById('generated-at');
  if (gen && DATA.generatedAt) gen.textContent = DATA.generatedAt.slice(0, 10);

  currentState = parseHash();
  renderNavAndSidebar(currentState);
  renderMain(currentState);
  syncSearchInput();
  wireEvents();
}

boot().catch((err) => {
  const main = document.getElementById('main');
  if (main) main.innerHTML = `<div class="empty-state">Catalog failed to load.<br>${esc(String(err.message || err))}</div>`;
  console.error(err);
});
