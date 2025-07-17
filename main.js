// main.js
'use strict';

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}

class MapViewer {
    constructor() {
        this.CONFIG = {
            CANVAS_SIZE: 4096,
            IMAGE_WIDTH: 2304,
            IMAGE_HEIGHT: 2688,
            TILE_SIZE: 12,
            GRID_COLS: 192,
            GRID_ROWS: 224,
            MIN_SCALE: 0.5,
            MAX_SCALE: 16.0,
            ZOOM_STEP: 1.15,
            HOVER_ANCHOR: 0.5,
        };
        this.OFFSET = {
            X: (this.CONFIG.CANVAS_SIZE - this.CONFIG.IMAGE_WIDTH) / 2,
            Y: (this.CONFIG.CANVAS_SIZE - this.CONFIG.IMAGE_HEIGHT) / 2,
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

        // Create a stable mask key that's independent of MAP_HASH
        // This ensures mask data can be consistently stored and retrieved
        // even when cache-busting parameters change
        this.MASK_KEY = `mask-stable-v2:${this.CONFIG.GRID_COLS}x${this.CONFIG.GRID_ROWS}@${this.CONFIG.TILE_SIZE}`;
        this.db = null;
        this.hoveredTile = null;
        this.init();
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
        // FIX: The image loading still uses MAP_HASH for cache-busting
        // This is correct - we want fresh images but stable mask data
        img.src = "./assets/map.png";

        // add purge cache button handler
        const btn = document.getElementById('purgeCacheButton');
        btn.addEventListener('click', () => this.purgeCache());
    }

    purgeCache() {
        // clear service-worker cache
        if ('caches' in window) {
            caches.keys().then(keys =>
                Promise.all(keys.map(key => caches.delete(key)))
            );
        }
        // delete IndexedDB
        const DB_NAME = 'TileMaskDB';
        if (this.db) {
            this.db.close();
            indexedDB.deleteDatabase(DB_NAME);
        }
        // Generate new MAP_HASH to force fresh assets
        window.MAP_HASH = crypto.randomUUID();
        // reset state and reload
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
        this.canvas.addEventListener("pointerdown", (e) => {
            if (!this.imageReady || !this.maskReady) return;
            const t = this.screenToTile(e);
            if (e.shiftKey || e.ctrlKey) {
                this.groupActive = true;
                this.groupStart = t;
                this.groupCurrent = t;
                this.needsRedraw = true;
                this.requestDraw();
            } else {
                this.selected.clear();
                if (this.validTile(t) && this.cellAllowed(t))
                    this.selected.add(`${t.x},${t.y}`);
                this.updateInfo();
                this.needsRedraw = true;
                this.requestDraw();
                this.state.dragging = true;
                this.state.dragStart = { x: e.clientX, y: e.clientY };
                this.state.panStart = { x: this.state.panX, y: this.state.panY };
            }
            e.preventDefault();
        });

        window.addEventListener("pointermove", (e) => {
            if (!this.imageReady || !this.maskReady) return;
            const hover = this.screenToTile(e);
            let changed = false;
            if (!this.hoveredTile || this.hoveredTile.x !== hover.x || this.hoveredTile.y !== hover.y) {
                this.hoveredTile = hover;
                changed = true;
            }
            document.getElementById("tileDisplay").textContent =
                this.validTile(hover) ? `${hover.x},${hover.y}` : "-";
            if (this.groupActive) {
                this.groupCurrent = hover;
                changed = true;
            } else if (this.state.dragging) {
                const dx = (e.clientX - this.state.dragStart.x) / this.state.scale;
                const dy = (e.clientY - this.state.dragStart.y) / this.state.scale;
                this.state.panX = this.state.panStart.x - dx;
                this.state.panY = this.state.panStart.y - dy;
                this.clampPan();
                changed = true;
            }
            if (changed) {
                this.needsRedraw = true;
                this.requestDraw();
            }
        });

        window.addEventListener("pointerup", (e) => {
            if (!this.imageReady || !this.maskReady) return;
            if (this.groupActive && this.groupStart && this.groupCurrent) {
                const a = this.groupStart, b = this.groupCurrent;
                const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
                const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
                for (let x = x0; x <= x1; x++)
                    for (let y = y0; y <= y1; y++)
                        if (this.validTile({ x, y }) && this.cellAllowed({ x, y }))
                            this.selected.add(`${x},${y}`);
                this.groupActive = false;
                this.groupStart = null;
                this.groupCurrent = null;
                this.needsRedraw = true;
                this.requestDraw();
                this.updateInfo();
            }
            this.state.dragging = false;
        });

        this.canvas.addEventListener("wheel", (e) => {
            if (!this.imageReady || !this.maskReady) return;
            e.preventDefault();
            const factor = e.deltaY < 0 ? this.CONFIG.ZOOM_STEP : 1 / this.CONFIG.ZOOM_STEP;
            const ns = Math.max(this.CONFIG.MIN_SCALE, Math.min(this.CONFIG.MAX_SCALE, this.state.scale * factor));
            const rect = this.canvas.getBoundingClientRect();
            const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
            const worldBeforeX = cx / this.state.scale + this.state.panX;
            const worldBeforeY = cy / this.state.scale + this.state.panY;
            this.state.scale = ns;
            this.state.panX = worldBeforeX - cx / ns;
            this.state.panY = worldBeforeY - cy / ns;
            this.clampPan();
            this.updateUI();
            this.needsRedraw = true;
            this.requestDraw();
        }, { passive: false });

        window.addEventListener("resize", () => {
            this.resizeCanvas();
            this.needsRedraw = true;
            this.requestDraw();
        });
    }

    screenToTile(e) {
        const rect = this.canvas.getBoundingClientRect();
        const cssX = e.clientX - rect.left;
        const cssY = e.clientY - rect.top;
        const worldX = (cssX * this.dpr) / this.state.scale + this.state.panX;
        const worldY = (cssY * this.dpr) / this.state.scale + this.state.panY;
        const tx = Math.floor((worldX - this.OFFSET.X) / this.CONFIG.TILE_SIZE);
        const ty = Math.floor((worldY - this.OFFSET.Y) / this.CONFIG.TILE_SIZE);
        return { x: tx, y: ty };
    }

    validTile(t) {
        return t.x >= 0 && t.x < this.CONFIG.GRID_COLS && t.y >= 0 && t.y < this.CONFIG.GRID_ROWS;
    }

    cellAllowed(t) {
        if (!this.tileMask) return true;
        const idx = t.y * this.CONFIG.GRID_COLS + t.x;
        return this.tileMask[idx] === 1;
    }

    clampPan() {
        const vw = this.canvas.width / this.dpr / this.state.scale;
        const vh = this.canvas.height / this.dpr / this.state.scale;
        this.state.panX = Math.max(-this.OFFSET.X, Math.min(this.state.panX, this.CONFIG.CANVAS_SIZE - vw + this.OFFSET.X));
        this.state.panY = Math.max(-this.OFFSET.Y, Math.min(this.state.panY, this.CONFIG.CANVAS_SIZE - vh + this.OFFSET.Y));
    }

    centerView() {
        const vw = this.canvas.width / this.dpr / this.state.scale;
        const vh = this.canvas.height / this.dpr / this.state.scale;
        this.state.panX = this.OFFSET.X + (this.CONFIG.IMAGE_WIDTH - vw) / 2;
        this.state.panY = this.OFFSET.Y + (this.CONFIG.IMAGE_HEIGHT - vh) / 2;
    }

    resetView() {
        this.state.scale = 1;
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
        const w = window.innerWidth, h = window.innerHeight;
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
                // pick whichever SW instance is active, waiting or installing
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
        for (let y = 0; y < this.CONFIG.GRID_ROWS; y++) {
            for (let x = 0; x < this.CONFIG.GRID_COLS; x++) {
                if (!this.cellAllowed({ x, y })) continue;
                path.rect(offX + x * T, offY + y * T, T, T);
            }
        }
        this.cachedGridPath = path;
    }

    draw() {
        if (!this.image || !this.tileMask) return;
        const ctx = this.ctx, s = this.state.scale, dpr = this.dpr;
        const T = this.CONFIG.TILE_SIZE, offX = this.OFFSET.X, offY = this.OFFSET.Y;
        const cols = this.CONFIG.GRID_COLS, rows = this.CONFIG.GRID_ROWS, mask = this.tileMask;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.translate(-this.state.panX * s, -this.state.panY * s);
        ctx.scale(s, s);
        ctx.imageSmoothingEnabled = s < 1;

        ctx.drawImage(this.image, offX, offY, this.CONFIG.IMAGE_WIDTH, this.CONFIG.IMAGE_HEIGHT);

        // Phase 1: Grid
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1 / (s * dpr);
        ctx.stroke(this.cachedGridPath);
        ctx.restore();

        // Phase 2: Mask boundary
        ctx.save();
        ctx.strokeStyle = '#47ff55';
        ctx.lineWidth = 3 / (s * dpr);
        ctx.beginPath();
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (mask[y * cols + x] !== 1) continue;
                const px = offX + x * T, py = offY + y * T;
                if (y === 0 || mask[(y - 1) * cols + x] !== 1) { ctx.moveTo(px, py); ctx.lineTo(px + T, py); }
                if (x === cols - 1 || mask[y * cols + (x + 1)] !== 1) { ctx.moveTo(px + T, py); ctx.lineTo(px + T, py + T); }
                if (y === rows - 1 || mask[(y + 1) * cols + x] !== 1) { ctx.moveTo(px + T, py + T); ctx.lineTo(px, py + T); }
                if (x === 0 || mask[y * cols + (x - 1)] !== 1) { ctx.moveTo(px, py + T); ctx.lineTo(px, py); }
            }
        }
        ctx.stroke();
        ctx.restore();

        // Phase 3: Selected tiles
        ctx.save();
        ctx.fillStyle = 'rgba(54,162,235,0.4)';
        this.selected.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            if (!this.cellAllowed({ x, y })) return;
            ctx.fillRect(offX + x * T, offY + y * T, T, T);
        });
        ctx.restore();

        // Phase 4: Group selection
        if (this.groupActive && this.groupStart && this.groupCurrent) {
            const a = this.groupStart, b = this.groupCurrent;
            const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
            const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
            let any = false;
            for (let x = x0; x <= x1 && !any; x++)
                for (let y = y0; y <= y1; y++)
                    if (this.cellAllowed({ x, y })) { any = true; break; }
            if (any) {
                ctx.save();
                ctx.strokeStyle = 'rgba(255,159,64,0.6)';
                ctx.lineWidth = 2 / (s * dpr);
                ctx.strokeRect(offX + x0 * T, offY + y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
                ctx.restore();
            }
        }

        // Phase 5: Hover highlight
        if (this.hoveredTile && this.validTile(this.hoveredTile) && this.cellAllowed(this.hoveredTile)) {
            const px = offX + this.hoveredTile.x * T, py = offY + this.hoveredTile.y * T;
            ctx.save();
            ctx.strokeStyle = 'rgba(255,205,86,0.8)';
            ctx.lineWidth = 2 / (s * dpr);
            ctx.setLineDash([2 / (s * dpr), 2 / (s * dpr)]);
            ctx.strokeRect(px, py, T, T);
            ctx.restore();
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

const viewer = new MapViewer();
window.viewer = viewer;