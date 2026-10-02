// Minimal DOM smoke test for public/app.js using a fake DOM.
import { readFileSync } from 'node:fs';

const listeners = {};
function makeEl(id) {
  return {
    id, innerHTML: '', value: '', textContent: '', style: {}, classList: { add(){}, remove(){} },
    addEventListener(type, fn) { (listeners[id + ':' + type] ||= []).push(fn); },
    getAttribute: () => null, closest: () => null, querySelectorAll: () => [], focus(){}, scrollIntoView(){},
  };
}
const els = {};
for (const id of ['main-nav','sidebar','mobile-filterbar','main','search-input','generated-at']) els[id] = makeEl(id);

global.document = {
  getElementById: (id) => els[id] || null,
  addEventListener: (t, f) => { (listeners['doc:' + t] ||= []).push(f); },
  querySelectorAll: () => [],
  title: '',
};
global.location = { hash: '' };
global.history = { replaceState(_s,_t,url){ global.location.hash = url.startsWith('#') ? url : ''; } };
global.window = { addEventListener(){}, setTimeout: (...a)=>setTimeout(...a), clearTimeout };
global.CSS = { escape: (s)=>s };
global.fetch = async (u) => ({ ok: true, json: async () => JSON.parse(readFileSync('public/data/repositories.json','utf8')) });

await import(new URL('../public/app.js', import.meta.url).href);
await new Promise(r => setTimeout(r, 100));

const mainHtml = els.main.innerHTML;
const checks = [
  ['renders repo cards', mainHtml.includes('repo-card')],
  ['all 14 repos', (mainHtml.match(/class="repo-card"/g)||[]).length === 14],
  ['featured section', mainHtml.includes('Featured — manually selected')],
  ['HOI4FocusGUI featured', /data-repo="HOI4FocusGUI"[\s\S]*featured-flag/.test(mainHtml)],
  ['distribution bar', mainHtml.includes('dist-bar')],
  ['nav rendered', els['main-nav'].innerHTML.includes('Universal Mods')],
  ['sidebar counts', els.sidebar.innerHTML.includes('Fallout 4')],
  ['status badges', mainHtml.includes('st-development')],
  ['related links', mainHtml.includes('data-jump="Universal-Pipes"')],
  ['external related link', mainHtml.includes('github.com/TheCascadian/')],
  ['source links', mainHtml.includes('SOURCE ↗')],
  ['lazy thumb fallback', mainHtml.includes('thumb-fallback')],
  ['no image tags invented', !mainHtml.includes('<img ')],
];
let fail = 0;
for (const [name, ok] of checks) { console.log((ok?'PASS':'FAIL')+' - '+name); if(!ok) fail++; }

// simulate search input
els.searchInput = els['search-input'];
els['search-input'].value = 'fallout';
for (const f of listeners['search-input:input']||[]) f();
await new Promise(r=>setTimeout(r,200));
console.log('search "fallout" ->', els.main.innerHTML.includes('No repositories match') ? 'empty state OK' : (els.main.innerHTML.includes('repo-card') ? 'has cards' : '?'));
els['search-input'].value = 'hoi4';
for (const f of listeners['search-input:input']||[]) f();
await new Promise(r=>setTimeout(r,200));
const h = els.main.innerHTML;
console.log('search "hoi4" cards:', (h.match(/class="repo-card"/g)||[]).length);
process.exit(fail ? 1 : 0);
