// sw.js
'use strict';

const CACHE_NAME = 'map-viewer-cache-v3';
const URLS = [
    './',
    './index.html',
    './main.js',
    './style.css',
    './assets/map.png',
    './assets/mask.png',
    './sw.js',
    './contextMenu.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith((async () => {
        const req = event.request;
        const cached = await caches.match(req);
        if (cached) return cached;
        const response = await fetch(req);
        if (req.method === 'GET') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, response.clone());
        }
        return response;
    })());
});

self.addEventListener('message', async event => {
    if (!event.data || event.data.type !== 'generateMask') return;

    const { tileSize, cols, rows, offsetX, offsetY } = event.data;

    // FIX: Always fetch mask.png with a stable URL (no cache-busting)
    // for consistent mask generation, regardless of debug.js hash changes
    const resp = await fetch('./mask.png', {
        cache: 'no-store' // Force fresh fetch but without hash parameter
    });
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);

    const CANVAS_SIZE = 4096;
    const oc = new OffscreenCanvas(CANVAS_SIZE, CANVAS_SIZE);
    const ctx = oc.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.drawImage(bitmap, offsetX, offsetY, cols * tileSize, rows * tileSize);

    const total = cols * rows;
    const mask = new Uint8Array(total);
    const interval = Math.max(1, Math.floor(total / 100));
    let processed = 0;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const x0 = offsetX + x * tileSize;
            const y0 = offsetY + y * tileSize;
            const rx = Math.max(0, Math.min(x0, CANVAS_SIZE - tileSize));
            const ry = Math.max(0, Math.min(y0, CANVAS_SIZE - tileSize));
            const data = ctx.getImageData(rx, ry, tileSize, tileSize).data;

            let keep = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] < 16 && data[i + 1] < 16 && data[i + 2] < 16) {
                    keep = 1;
                    break;
                }
            }
            mask[y * cols + x] = keep;
            processed++;
            if (processed % interval === 0 || processed === total) {
                const percent = Math.round(processed / total * 100);
                const clients = await self.clients.matchAll();
                clients.forEach(c => c.postMessage({
                    type: 'maskProgress',
                    done: processed,
                    total,
                    percent
                }));
            }
        }
    }

    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({
        type: 'maskGenerated',
        maskBuffer: mask.buffer,
        cols,
        rows
    }, [mask.buffer]));
});