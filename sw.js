/*
 * Clean Commonwealth Cartographer
 * Copyright (c) 2025 TheCascadian
 *
 * Licensed under the MIT License.
 * See LICENSE.md for details.
 */

'use strict';

const CACHE = 'map-viewer-v3';
const ASSETS = [
    './index.html',
    './styles/style.css',
    './assets/mainmap.png',
    './assets/mainmask.png',
    './contextMenu.js',
    './debug.js',
    './main.js',
    './sw.js',
    './tileLockManager.js',
    './.version'
];

// Install: precache core assets
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

// Activate: cleanup old caches
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Network-first fetch, skip caching for cache-busted URLs
self.addEventListener('fetch', e => {
    const url = typeof e.request.url === 'string' ? e.request.url : '';
    const isCacheBusted = url.includes('cb=');
    e.respondWith(
        (async () => {
            try {
                // Always try network first
                const netRes = await fetch(e.request);
                if (new URL(e.request.url).origin !== location.origin) return;
                // Only cache non-cache-busted GET requests
                if (e.request.method === 'GET' && !isCacheBusted) {
                    const cache = await caches.open(CACHE);
                    cache.put(e.request, netRes.clone());
                }
                return netRes;
            } catch (err) {
                // On network error, fallback to cache
                const cacheRes = await caches.match(e.request);
                if (cacheRes) return cacheRes;
                throw err;
            }
        })()
    );
});

// Mask generation logic (unchanged, except more robust)
self.addEventListener('message', async e => {
    if (!e.data || e.data.type !== 'generateMask') return;
    const { cols, rows, tileSize } = e.data;
    const resp = await fetch('./assets/mainmask.png', { cache: 'no-cache' });
    const bmp = await createImageBitmap(await resp.blob());

    const oc = new OffscreenCanvas(4096, 4096);
    const ctx = oc.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, 4096, 4096);

    const mask = new Uint8Array(cols * rows);
    const step = Math.max(1, Math.floor(mask.length / 100));
    let done = 0;
    const clients = await self.clients.matchAll();

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const x0 = Math.floor(x * tileSize);
            const y0 = Math.floor(y * tileSize);
            const x1 = Math.min(Math.ceil((x + 1) * tileSize), 4096);
            const y1 = Math.min(Math.ceil((y + 1) * tileSize), 4096);
            const w = x1 - x0, h = y1 - y0;
            if (w <= 0 || h <= 0) {
                mask[y * cols + x] = 0;
                continue;
            }
            const data = ctx.getImageData(x0, y0, w, h).data;
            let keep = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] < 16 && data[i + 1] < 16 && data[i + 2] < 16) {
                    keep = 1;
                    break;
                }
            }
            mask[y * cols + x] = keep;
            if (++done % step === 0 || done === mask.length) {
                const p = Math.round(done / mask.length * 100);
                clients.forEach(c => c.postMessage({ type: 'maskProgress', percent: p }));
            }
        }
    }
    // Copy buffer before transferring
    const bufferCopy = mask.buffer.slice();
    clients.forEach(c => c.postMessage(
        { type: 'maskGenerated', maskBuffer: bufferCopy }
    ));
});
