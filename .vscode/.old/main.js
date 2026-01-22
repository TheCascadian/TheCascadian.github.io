/*
 * Clean Commonwealth Cartographer
 * Copyright (c) 2025 TheCascadian
 *
 * Licensed under the MIT License.
 * See LICENSE.md for details.
 */
'use strict';

// Correct ES module import for GitHub Pages
import TileLockManager from './tileLockManager.js';

const CONFIG = {
    IMAGE_WIDTH: 4096,
    IMAGE_HEIGHT: 4096,
    TILE_SIZE: 24,
    COORD_MIN_X: undefined,
    COORD_MIN_Y: undefined,
    PAN_PADDING: 192,
    CENTER_THRESHOLD: 32,
    MIN_SCALE: 0.215,
    MAX_SCALE: 16.0,
    ZOOM_STEP: 1.025,
    HOVER_ANCHOR: 0.5,
    FPS_SAMPLE_SIZE: 30,
    TARGET_FPS: 60,
    FPS_THRESHOLD: 5,
    INITIAL_RENDER_MARGIN: 2,
    RENDER_MARGIN_MIN: 1,
    RENDER_MARGIN_MAX: 5
};

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(() => console.log('SW registered with root scope'))
        .catch(console.error);
}

const tileLockManager = new TileLockManager();

class MapViewer {
    constructor(opts) {
        const c = Object.assign({}, CONFIG, opts || {});
        this.CONFIG = {};
        this.configureGrid(
            c.IMAGE_WIDTH, c.IMAGE_HEIGHT, c.TILE_SIZE,
            c.COORD_MIN_X, c.COORD_MIN_Y
        );
        this.OFFSET = {
            X: (this.CONFIG.CANVAS_SIZE - this.CONFIG.IMAGE_WIDTH) / 2,
            Y: (this.CONFIG.CANVAS_SIZE - this.CONFIG.IMAGE_HEIGHT) / 2
        };
        this.MAP_HASH = window.MAP_HASH || 'default';
        this.selected = new Set();
        this.groupStart = null;
        this.groupCurrent = null;
        this.groupActive = false;
        this.tileMask = null;
        this.maskReady = false;
        this.imageReady = false;
        this.needsRedraw = true;
        this.cachedGridPath = null;
        this.PAN_PADDING = c.PAN_PADDING;
        this.CENTER_THRESHOLD = c.CENTER_THRESHOLD;
        this.CENTER_LOCK_SCALE = this.CONFIG.MIN_SCALE;
        this.MASK_KEY = `mask-stable-v2:${this.CONFIG.GRID_COLS}x${this.CONFIG.GRID_ROWS}@${this.CONFIG.TILE_SIZE}`;
        this.db = null;
        this.hoveredTile = null;
        this.fpsSamples = [];
        this.fpsSampleSize = c.FPS_SAMPLE_SIZE;
        this.lastFrameTime = performance.now();
        this.renderMargin = c.INITIAL_RENDER_MARGIN;
        this.minMargin = c.RENDER_MARGIN_MIN;
        this.maxMargin = c.RENDER_MARGIN_MAX;
        this.targetFPS = c.TARGET_FPS;
        this.fpsThreshold = c.FPS_THRESHOLD;
        this.init();
    }

    configureGrid(imageWidth, imageHeight, tileSize, coordMinX, coordMinY) {
        if (!imageWidth || !imageHeight || !tileSize) throw new Error('Image width, height, and tile size are required.');
        const cols = Math.floor(imageWidth / tileSize);
        const rows = Math.floor(imageHeight / tileSize);
        if (coordMinX === undefined) coordMinX = -Math.floor(cols / 2);
        if (coordMinY === undefined) coordMinY = -Math.floor(rows / 2);
        this.CONFIG = {
            CANVAS_SIZE: Math.max(imageWidth, imageHeight),
            IMAGE_WIDTH: imageWidth,
            IMAGE_HEIGHT: imageHeight,
            TILE_SIZE: tileSize,
            GRID_COLS: cols,
            GRID_ROWS: rows,
            COORD_MIN_X: coordMinX,
            COORD_MAX_X: coordMinX + cols - 1,
            COORD_MIN_Y: coordMinY,
            COORD_MAX_Y: coordMinY + rows - 1,
            MIN_SCALE: CONFIG.MIN_SCALE,
            MAX_SCALE: CONFIG.MAX_SCALE,
            ZOOM_STEP: CONFIG.ZOOM_STEP,
            HOVER_ANCHOR: CONFIG.HOVER_ANCHOR
        };
    }

    indexToCoord(ix, iy) {
        return {
            x: this.CONFIG.COORD_MIN_X + ix,
            y: this.CONFIG.COORD_MIN_Y + iy
        };
    }

    coordToIndex(tx, ty) {
        return {
            ix: tx - this.CONFIG.COORD_MIN_X,
            iy: ty - this.CONFIG.COORD_MIN_Y
        };
    }

    updateFPS() {
        const now = performance.now();
        const delta = now - this.lastFrameTime;
        this.lastFrameTime = now;
        const fps = 1000 / delta;
        this.fpsSamples.push(fps);
        if (this.fpsSamples.length > this.fpsSampleSize) {
            this.fpsSamples.shift();
        }
        const avgFPS = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
        return avgFPS;
    }

    adjustRenderMargin(avgFPS) {
        if (avgFPS > this.targetFPS + this.fpsThreshold && this.renderMargin < this.maxMargin) {
            this.renderMargin++;
        } else if (avgFPS < this.targetFPS - this.fpsThreshold && this.renderMargin > this.minMargin) {
            this.renderMargin--;
        }
    }

    getVisibleTileBounds() {
        const s = this.state.scale;
        const dpr = this.dpr;
        const T = this.CONFIG.TILE_SIZE;
        const vw = this.canvas.width / dpr / s;
        const vh = this.canvas.height / dpr / s;
        const vx = this.state.panX;
        const vy = this.state.panY;
        const ixMinF = (vx - this.OFFSET.X) / T;
        const iyMinF = (vy - this.OFFSET.Y) / T;
        const ixMaxF = (vx + vw - this.OFFSET.X) / T;
        const iyMaxF = (vy + vh - this.OFFSET.Y) / T;
        const margin = this.renderMargin;
        const ixMin = Math.max(0, Math.floor(ixMinF) - margin);
        const iyMin = Math.max(0, Math.floor(iyMinF) - margin);
        const ixMax = Math.min(this.CONFIG.GRID_COLS - 1, Math.ceil(ixMaxF) + margin);
        const iyMax = Math.min(this.CONFIG.GRID_ROWS - 1, Math.ceil(iyMaxF) + margin);
        return { ixMin, iyMin, ixMax, iyMax };
    }

    init() {
        this.canvas = document.getElementById("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.dpr = window.devicePixelRatio || 1;
        this.state = { panX: 0, panY: 0, scale: 1, dragging: false };
        this.setupEvents();
        this.setupServiceWorkerChannel();
        this.tryRevealUI();
        this.openIndexedDB(() => {
            this.tryLoadMaskFromCache(
                () => this.tryRequestMask(),
                () => { }
            );
        });
        const img = new Image();
        img.onload = () => {
            if (img.width !== this.CONFIG.IMAGE_WIDTH || img.height !== this.CONFIG.IMAGE_HEIGHT) {
                this.configureGrid(img.width, img.height, this.CONFIG.TILE_SIZE, this.CONFIG.COORD_MIN_X, this.CONFIG.COORD_MIN_Y);
                this.OFFSET = {
                    X: (this.CONFIG.CANVAS_SIZE - this.CONFIG.IMAGE_WIDTH) / 2,
                    Y: (this.CONFIG.CANVAS_SIZE - this.CONFIG.IMAGE_HEIGHT) / 2
                };
                this.MASK_KEY = `mask-stable-v2:${this.CONFIG.GRID_COLS}x${this.CONFIG.GRID_ROWS}@${this.CONFIG.TILE_SIZE}`;
            }
            createImageBitmap(img).then((bitmap) => {
                this.image = bitmap;
                this.imageReady = true;
                if (this.maskReady) {
                    this.centerView();
                    this.resizeCanvas();
                    this.needsRedraw = true;
                    this.requestDraw();
                }
                this.tryRevealUI();
            });
        };
        img.src = "./assets/mainmap.png";
        const btn = document.getElementById('purgeCacheButton');
        btn.addEventListener('click', () => this.purgeCache());
    }

    purgeCache() {
        if ('caches' in window) {
            caches.keys().then(keys =>
                Promise.all(keys.map(key => caches.delete(key)))
            );
        }
        const DB_NAME = 'TileMaskDB';
        if (this.db) {
            this.db.close();
            indexedDB.deleteDatabase(DB_NAME);
        }
        window.MAP_HASH = crypto.randomUUID();
        this.tileMask = null;
        this.maskReady = false;
        location.reload();
    }

    openIndexedDB(cb) {
        const req = indexedDB.open("TileMaskDB", 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("masks")) db.createObjectStore("masks");
        };
        req.onsuccess = (e) => {
            this.db = e.target.result;
            cb();
        };
        req.onerror = () => { this.db = null; cb(); };
    }

    tryLoadMaskFromCache(onMiss, onHit) {
        if (!this.db) { onMiss(); return; }
        const tx = this.db.transaction("masks", "readonly");
        const store = tx.objectStore("masks");
        const req = store.get(this.MASK_KEY);
        req.onsuccess = () => {
            const buffer = req.result;
            if (buffer) {
                this.tileMask = new Uint8Array(buffer);
                this.maskReady = true;
                this.centerView();
                this.resizeCanvas();
                this.buildGridPath();
                this.needsRedraw = true;
                this.requestDraw();
                this.tryRevealUI();
                onHit();
            } else {
                onMiss();
            }
        };
        req.onerror = () => { onMiss(); };
    }

    cacheMask(buffer) {
        if (!this.db) return;
        const tx = this.db.transaction("masks", "readwrite");
        const store = tx.objectStore("masks");
        store.put(buffer, this.MASK_KEY);
    }

    setupEvents() {
        const canvas = this.canvas;
        canvas.addEventListener("pointerdown", (e) => {
            if (!this.imageReady || !this.maskReady) return;
            if (e.button === 1) {
                if (this.state.scale > this.CENTER_LOCK_SCALE && !this.state.panLocked) {
                    this.state.dragging = true;
                    this.state.dragStart = { x: e.clientX, y: e.clientY };
                    this.state.panStart = { x: this.state.panX, y: this.state.panY };
                }
                e.preventDefault();
            } else if (e.button === 0) {
                const t = this.screenToTile(e);
                if (tileLockManager.isTileLocked(t.x, t.y)) {
                    alert('Tile is locked by ' + tileLockManager.isTileLocked(t.x, t.y).user);
                    return;
                }
                if (e.shiftKey || e.ctrlKey) {
                    if (!this.groupActive) {
                        this.groupActive = true;
                        this.groupStart = t;
                    }
                    this.groupCurrent = t;
                    this.needsRedraw = true;
                    this.requestDraw();
                } else {
                    if (!this.groupActive) this.selected.clear();
                    if (this.validTile(t) && this.cellAllowed(t))
                        this.selected.add(`${t.x},${t.y}`);
                    if (this.state.scale <= this.CENTER_LOCK_SCALE) {
                        this.centerView();
                    }
                    this.updateInfo();
                    this.needsRedraw = true;
                    this.requestDraw();
                }
                e.preventDefault();
            } else if (e.button === 2) {
            }
        });

        canvas.addEventListener("pointermove", (e) => {
            if (!this.imageReady || !this.maskReady) return;
            if (this.state.dragging && e.buttons === 4) {
                const dx = (e.clientX - this.state.dragStart.x) / this.state.scale;
                const dy = (e.clientY - this.state.dragStart.y) / this.state.scale;
                this.state.panX = this.state.panStart.x - dx;
                this.state.panY = this.state.panStart.y - dy;
                this.clampPan();
                this.needsRedraw = true;
                this.requestDraw();
            } else {
                const hover = this.screenToTile(e);
                if (!this.hoveredTile || this.hoveredTile.x !== hover.x || this.hoveredTile.y !== hover.y) {
                    this.hoveredTile = hover;
                    document.getElementById("tileDisplay").textContent =
                        this.validTile(hover) ? `${hover.x},${hover.y}` : "-";
                    this.needsRedraw = true;
                    this.requestDraw();
                }
                if (this.groupActive && (e.buttons & 1)) {
                    this.groupCurrent = this.screenToTile(e);
                    this.needsRedraw = true;
                    this.requestDraw();
                }
            }
        });

        window.addEventListener("pointerup", (e) => {
            if (!this.imageReady || !this.maskReady) return;
            if (e.button === 1) {
                this.state.dragging = false;
            }
            if (e.button === 0 && this.groupActive && this.groupStart && this.groupCurrent) {
                const a = this.groupStart, b = this.groupCurrent;
                const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
                const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
                for (let x = x0; x <= x1; x++)
                    for (let y = y0; y <= y1; y++)
                        if (this.validTile({ x, y }) && this.cellAllowed({ x, y }))
                            this.selected.add(`${x},${y}`);
                this.needsRedraw = true;
                this.requestDraw();
                this.updateInfo();
            }
        });

        window.addEventListener("resize", () => {
            this.resizeCanvas();
            this.needsRedraw = true;
            this.requestDraw();
        });
    }

    getFocusWorld() {
        if (this.selected && this.selected.size) {
            const [tx, ty] = this.selected.values().next().value.split(',').map(Number);
            const { ix, iy } = this.coordToIndex(tx, ty);
            const T = this.CONFIG.TILE_SIZE;
            return {
                x: this.OFFSET.X + (ix + 0.5) * T,
                y: this.OFFSET.Y + (iy + 0.5) * T
            };
        }
        return {
            x: this.OFFSET.X + this.CONFIG.IMAGE_WIDTH * 0.5,
            y: this.OFFSET.Y + this.CONFIG.IMAGE_HEIGHT * 0.5
        };
    }

    screenToTile(e) {
        const rect = this.canvas.getBoundingClientRect();
        const cssX = e.clientX - rect.left;
        const cssY = e.clientY - rect.top;
        const worldX = (cssX * this.dpr) / this.state.scale + this.state.panX;
        const worldY = (cssY * this.dpr) / this.state.scale + this.state.panY;
        const ix = Math.floor((worldX - this.OFFSET.X) / this.CONFIG.TILE_SIZE);
        const iy = Math.floor((worldY - this.OFFSET.Y) / this.CONFIG.TILE_SIZE);
        const tx = this.CONFIG.COORD_MIN_X + ix;
        const ty = this.CONFIG.COORD_MIN_Y + iy;
        return { x: tx, y: ty };
    }

    validTile(t) {
        return t.x >= this.CONFIG.COORD_MIN_X && t.x <= this.CONFIG.COORD_MAX_X &&
            t.y >= this.CONFIG.COORD_MIN_Y && t.y <= this.CONFIG.COORD_MAX_Y;
    }

    cellAllowed(t) {
        if (!this.tileMask) return true;
        const { ix, iy } = this.coordToIndex(t.x, t.y);
        if (ix < 0 || ix >= this.CONFIG.GRID_COLS || iy < 0 || iy >= this.CONFIG.GRID_ROWS) return false;
        const idx = iy * this.CONFIG.GRID_COLS + ix;
        if (tileLockManager.isTileLocked(t.x, t.y)) return false;
        return this.tileMask[idx] === 1;
    }

    getCenteredPanX(vw) {
        return this.OFFSET.X + (this.CONFIG.IMAGE_WIDTH - vw) / 2;
    }
    getCenteredPanY(vh) {
        return this.OFFSET.Y + (this.CONFIG.IMAGE_HEIGHT - vh) / 2;
    }

    checkPanLock() {
        const wasLocked = this.state.panLocked;
        const shouldLock = this.state.scale <= this.CENTER_LOCK_SCALE;
        if (shouldLock && !wasLocked) {
            this.state.panLocked = true;
            this.centerView();
            this.state.dragging = false;
        } else if (!shouldLock && wasLocked) {
            this.state.panLocked = false;
        }
    }

    clampPan() {
        const vw = this.canvas.width / this.dpr / this.state.scale;
        const vh = this.canvas.height / this.dpr / this.state.scale;
        if (this.state.scale <= this.CENTER_LOCK_SCALE) {
            this.centerView();
            return;
        }
        const pad = this.PAN_PADDING;
        const left = -pad + this.OFFSET.X;
        const right = this.CONFIG.IMAGE_WIDTH - vw + pad + this.OFFSET.X;
        const top = -pad + this.OFFSET.Y;
        const bottom = this.CONFIG.IMAGE_HEIGHT - vh + pad + this.OFFSET.Y;
        this.state.panX = Math.max(left, Math.min(this.state.panX, right));
        this.state.panY = Math.max(top, Math.min(this.state.panY, bottom));
    }

    centerView() {
        const vw = this.canvas.width / this.dpr / this.state.scale;
        const vh = this.canvas.height / this.dpr / this.state.scale;
        const f = this.getFocusWorld();
        this.state.panX = f.x - vw * 0.5;
        this.state.panY = f.y - vh * 0.5;
    }

    resetView() {
        this.state.scale = 1;
        this.checkPanLock();
        this.centerView();
        this.updateUI();
        this.needsRedraw = true;
        this.requestDraw();
    }

    clearSelection() {
        this.selected.clear();
        this.updateInfo();
        this.needsRedraw = true;
        this.requestDraw();
    }

    updateUI() {
        document.getElementById("scaleDisplay").textContent = this.state.scale.toFixed(2);
    }

    updateInfo() {
        document.getElementById("selectedCount").textContent = this.selected.size;
    }

    resizeCanvas() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.canvas.width = w * this.dpr;
        this.canvas.height = h * this.dpr;
        this.canvas.style.width = w + "px";
        this.canvas.style.height = h + "px";
    }

    requestDraw() {
        if (!this.imageReady || !this.maskReady) return;
        if (this._pending || !this.needsRedraw) return;
        this._pending = true;
        requestAnimationFrame(() => {
            this._pending = false;
            this.needsRedraw = false;
            this.draw();
        });
    }

    showProgress(show, percent, text) {
        const li = document.getElementById("loadingIndicator");
        if (li) {
            if (show) {
                li.style.display = "block";
                document.getElementById("progressFill").style.width = percent + "%";
                document.getElementById("progressText").textContent = text || "";
            } else {
                li.style.display = "none";
            }
        }
    }

    tryRequestMask() {
        this.showProgress(true, 0, 'Initializing worker…');
        navigator.serviceWorker.ready
            .then(registration => {
                this.showProgress(true, 0, 'Generating mask…');
                const worker =
                    registration.active ||
                    registration.waiting ||
                    registration.installing;
                if (worker) {
                    worker.postMessage({
                        type: 'generateMask',
                        tileSize: this.CONFIG.TILE_SIZE,
                        cols: this.CONFIG.GRID_COLS,
                        rows: this.CONFIG.GRID_ROWS,
                        offsetX: this.OFFSET.X,
                        offsetY: this.OFFSET.Y
                    });
                } else {
                    console.error('No service worker instance available to receive messages');
                    this.showProgress(true, 100, 'Error: worker init failed.');
                }
            })
            .catch(error => {
                console.error('SW ready failed:', error);
                this.showProgress(true, 100, 'Error: worker init failed.');
            });
    }

    setupServiceWorkerChannel() {
        navigator.serviceWorker.ready.then(() => {
            navigator.serviceWorker.addEventListener("message", (e) => {
                if (e.data.type === "maskProgress") {
                    this.showProgress(true, e.data.percent, `Generating mask: ${e.data.percent}%`);
                }
                if (e.data.type === "maskGenerated") {
                    this.tileMask = new Uint8Array(e.data.maskBuffer);
                    this.maskReady = true;
                    this.cacheMask(e.data.maskBuffer);
                    this.showProgress(false, 100, "Done");
                    if (this.imageReady) {
                        this.centerView();
                        this.resizeCanvas();
                        this.buildGridPath();
                        this.needsRedraw = true;
                        this.requestDraw();
                        this.tryRevealUI();
                    }
                }
            });
        });
    }

    buildGridPath() {
        const path = new Path2D();
        const T = this.CONFIG.TILE_SIZE;
        const offX = this.OFFSET.X, offY = this.OFFSET.Y;
        for (let iy = 0; iy < this.CONFIG.GRID_ROWS; iy++) {
            for (let ix = 0; ix < this.CONFIG.GRID_COLS; ix++) {
                const tx = this.CONFIG.COORD_MIN_X + ix;
                const ty = this.CONFIG.COORD_MIN_Y + iy;
                if (!this.cellAllowed({ x: tx, y: ty })) continue;
                path.rect(offX + ix * T, offY + iy * T, T, T);
            }
        }
        this.cachedGridPath = path;
    }

    draw() {
        if (!this.image || !this.tileMask) return;
        const ctx = this.ctx, s = this.state.scale, dpr = this.dpr;
        const T = this.CONFIG.TILE_SIZE, offX = this.OFFSET.X, offY = this.OFFSET.Y;
        const cols = this.CONFIG.GRID_COLS, rows = this.CONFIG.GRID_ROWS, mask = this.tileMask;
        const avgFPS = this.updateFPS();
        this.adjustRenderMargin(avgFPS);
        const { ixMin, iyMin, ixMax, iyMax } = this.getVisibleTileBounds();

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.translate(-this.state.panX * s, -this.state.panY * s);
        ctx.scale(s, s);
        ctx.imageSmoothingEnabled = s < 1;

        ctx.drawImage(this.image, offX, offY, this.CONFIG.IMAGE_WIDTH, this.CONFIG.IMAGE_HEIGHT);

        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1 / (s * dpr);

        const gridPath = new Path2D();
        for (let iy = iyMin; iy <= iyMax; iy++) {
            for (let ix = ixMin; ix <= ixMax; ix++) {
                if (!this.cellAllowed({ x: this.CONFIG.COORD_MIN_X + ix, y: this.CONFIG.COORD_MIN_Y + iy })) continue;
                gridPath.rect(offX + ix * T, offY + iy * T, T, T);
            }
        }
        ctx.stroke(gridPath);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = '#47ff55';
        ctx.lineWidth = 3 / (s * dpr);
        ctx.beginPath();

        for (let iy = iyMin; iy <= iyMax; iy++) {
            for (let ix = ixMin; ix <= ixMax; ix++) {
                if (mask[iy * cols + ix] !== 1) continue;
                const px = offX + ix * T, py = offY + iy * T;
                const up = iy === 0 || mask[(iy - 1) * cols + ix] !== 1;
                const right = ix === cols - 1 || mask[iy * cols + (ix + 1)] !== 1;
                const down = iy === rows - 1 || mask[(iy + 1) * cols + ix] !== 1;
                const left = ix === 0 || mask[iy * cols + (ix - 1)] !== 1;
                if (up) { ctx.moveTo(px, py); ctx.lineTo(px + T, py); }
                if (right) { ctx.moveTo(px + T, py); ctx.lineTo(px + T, py + T); }
                if (down) { ctx.moveTo(px + T, py + T); ctx.lineTo(px, py + T); }
                if (left) { ctx.moveTo(px, py + T); ctx.lineTo(px, py); }
            }
        }
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.fillStyle = 'rgba(54,162,235,0.4)';
        this.selected.forEach(key => {
            const [tx, ty] = key.split(',').map(Number);
            const { ix, iy } = this.coordToIndex(tx, ty);
            if (ix < ixMin || ix > ixMax || iy < iyMin || iy > iyMax) return;
            if (!this.cellAllowed({ x: tx, y: ty })) return;
            ctx.fillRect(offX + ix * T, offY + iy * T, T, T);
        });
        ctx.restore();

        if (this.groupActive && this.groupStart && this.groupCurrent) {
            const a = this.groupStart, b = this.groupCurrent;
            const x0 = Math.max(Math.min(a.x, b.x), this.CONFIG.COORD_MIN_X), x1 = Math.min(Math.max(a.x, b.x), this.CONFIG.COORD_MAX_X);
            const y0 = Math.max(Math.min(a.y, b.y), this.CONFIG.COORD_MIN_Y), y1 = Math.min(Math.max(a.y, b.y), this.CONFIG.COORD_MAX_Y);
            let any = false;
            for (let x = x0; x <= x1 && !any; x++)
                for (let y = y0; y <= y1; y++)
                    if (this.cellAllowed({ x, y })) { any = true; break; }
            if (any) {
                ctx.save();
                const { ix, iy } = this.coordToIndex(x0, y0);
                ctx.strokeStyle = 'rgba(255,159,64,0.6)';
                ctx.lineWidth = 2 / (s * dpr);
                ctx.strokeRect(offX + ix * T, offY + iy * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
                ctx.restore();
            }
        }

        if (this.hoveredTile && this.validTile(this.hoveredTile) && this.cellAllowed(this.hoveredTile)) {
            const { ix, iy } = this.coordToIndex(this.hoveredTile.x, this.hoveredTile.y);
            if (ix >= ixMin && ix <= ixMax && iy >= iyMin && iy <= iyMax) {
                const px = offX + ix * T, py = offY + iy * T;
                ctx.save();
                ctx.strokeStyle = 'rgba(255,205,86,0.8)';
                ctx.lineWidth = 2 / (s * dpr);
                ctx.setLineDash([2 / (s * dpr), 2 / (s * dpr)]);
                ctx.strokeRect(px, py, T, T);
                ctx.restore();
            }
        }

        ctx.restore();
    }

    tryRevealUI() {
        if ((this.imageReady && this.maskReady) || (this.imageReady && this.tileMask) || (this.maskReady && this.image)) {
            ["controls", "tileInfo", "footer"].forEach(id => {
                const el = document.getElementById(id);
                if (el && el.classList.contains("hidden")) {
                    el.classList.remove("hidden");
                    el.classList.add("fade-in");
                }
            });
        }
    }
}

const viewer = new MapViewer({});
window.viewer = viewer;

// Group claim action for context menu (example)
function claimGroupSelectedTiles() {
    if (!viewer.selected.size) return;
    const user = prompt('Enter your name to claim selected tiles:');
    if (!user) return;
    const tiles = Array.from(viewer.selected).map(k => {
        const [x, y] = k.split(',').map(Number);
        return { x, y };
    });
    tileLockManager.lockTiles(tiles, user);
    viewer.needsRedraw = true;
    viewer.requestDraw();
}

// Export locks as JSON for sharing
function exportTileLocks() {
    const json = tileLockManager.exportLocksJSON();
    navigator.clipboard.writeText(json);
    alert('Tile locks exported to clipboard.');
}

// Import locks from JSON
function importTileLocks() {
    const json = prompt('Paste tile lock JSON:');
    if (!json) return;
    try {
        tileLockManager.importLocksJSON(json);
        viewer.needsRedraw = true;
        viewer.requestDraw();
        alert('Locks imported.');
    } catch (e) {
        alert('Failed to import: ' + e.message);
    }
}

window.claimGroupSelectedTiles = claimGroupSelectedTiles;
window.exportTileLocks = exportTileLocks;
window.importTileLocks = importTileLocks;
