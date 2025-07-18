
'use strict';

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(() => console.log('SW registered with root scope'))
        .catch(console.error);
}

class MapViewer {
    /**
     * @param {Object} opts
     *   imageWidth: integer (pixels, required)
     *   imageHeight: integer (pixels, required)
     *   tileSize: integer (pixels per tile, required)
     *   coordMinX: integer (lowest grid X, default: -floor(cols/2))
     *   coordMinY: integer (lowest grid Y, default: -floor(rows/2))
     */
    constructor(opts) {
        if (!opts) throw new Error('MapViewer requires options: {imageWidth, imageHeight, tileSize, ...}');
        this._opts = opts;

        this.CONFIG = {};
        this.configureGrid(
            opts.imageWidth, opts.imageHeight, opts.tileSize,
            opts.coordMinX, opts.coordMinY
        );

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

        this.PAN_PADDING = 192;        // panning area around edges, in pixels
        this.CENTER_THRESHOLD = 32;    // px: when > this from center, snap to center
        this.CENTER_LOCK_SCALE = this.CONFIG.MIN_SCALE; // pan lock at/below this scale

        this.MASK_KEY = `mask-stable-v2:${this.CONFIG.GRID_COLS}x${this.CONFIG.GRID_ROWS}@${this.CONFIG.TILE_SIZE}`;
        this.db = null;
        this.hoveredTile = null;
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
            MIN_SCALE: 0.215, // measured to allow a full view of a standard 4096x4096 map image
            MAX_SCALE: 16.0,
            ZOOM_STEP: 1.025,
            HOVER_ANCHOR: 0.5
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
                    Y: (this.CONFIG.CANVAS_SIZE - this.CONFIG.IMAGE_HEIGHT) / 2,
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
        // --- Disable pan at/below lock scale ---
        this.canvas.addEventListener("pointerdown", (e) => {
            if (!this.imageReady || !this.maskReady) return;
            if (this.state.panLocked) return; // Disallow drag if pan is locked
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
                if (this.state.scale <= this.CENTER_LOCK_SCALE) {
                    this.centerView();
                }
                this.updateInfo();
                this.needsRedraw = true;
                this.requestDraw();
                // Only enable drag/pan if zoomed in above lock threshold
                if (this.state.scale > this.CENTER_LOCK_SCALE && !this.state.panLocked) {
                    this.state.dragging = true;
                    this.state.dragStart = { x: e.clientX, y: e.clientY };
                    this.state.panStart = { x: this.state.panX, y: this.state.panY };
                } else {
                    this.state.dragging = false;
                }
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
            } else if (this.state.dragging && this.state.scale > this.CENTER_LOCK_SCALE) {
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

        // --- Clamp scale, block zoom out, instantly enable/disable pan as needed ---
        this.canvas.addEventListener("wheel", (e) => {
            if (!this.imageReady || !this.maskReady) return;

            // Zoom factor
            const factor = e.deltaY < 0 ? this.CONFIG.ZOOM_STEP : 1 / this.CONFIG.ZOOM_STEP;
            let newScale = Math.max(this.CONFIG.MIN_SCALE, Math.min(this.state.scale * factor, this.CONFIG.MAX_SCALE));
            if (newScale === this.state.scale) {
                e.preventDefault();
                return;
            }

            // Cursor-anchored zoom: compute world coordinates under mouse before/after
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const oldScale = this.state.scale;
            const wx = (mx * this.dpr) / oldScale + this.state.panX;
            const wy = (my * this.dpr) / oldScale + this.state.panY;

            this.state.scale = newScale;

            // Calculate new pan to keep mouse position fixed
            this.state.panX = wx - (mx * this.dpr) / newScale;
            this.state.panY = wy - (my * this.dpr) / newScale;

            // If at or below lock scale, focus-center (selected tile if any)
            if (this.state.scale <= this.CENTER_LOCK_SCALE) {
                this.centerView();
            } else {
                this.clampPan();
            }

            this.checkPanLock();
            this.updateUI();
            this.needsRedraw = true;
            this.requestDraw();
            e.preventDefault();
        }, { passive: false });

        window.addEventListener("resize", () => {
            this.resizeCanvas();
            this.needsRedraw = true;
            this.requestDraw();
        });
    }

    getFocusWorld() {
        // If at least one tile is selected use its centre…
        if (this.selected && this.selected.size) {
            const [tx, ty] = this.selected.values().next().value.split(',').map(Number);
            const { ix, iy } = this.coordToIndex(tx, ty);
            const T = this.CONFIG.TILE_SIZE;
            return {
                x: this.OFFSET.X + (ix + 0.5) * T,
                y: this.OFFSET.Y + (iy + 0.5) * T
            };
        }
        // …otherwise default to the image’s geometric centre
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
            // Don't center when unlocking - maintain current view
        }
    }

    clampPan() {
        const vw = this.canvas.width / this.dpr / this.state.scale;
        const vh = this.canvas.height / this.dpr / this.state.scale;

        // Force center when at/below lock scale
        if (this.state.scale <= this.CENTER_LOCK_SCALE) {
            this.centerView();
            return;
        }
        
        // Normal clamping for higher zoom levels
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
        for (let iy = 0; iy < rows; iy++) {
            for (let ix = 0; ix < cols; ix++) {
                if (mask[iy * cols + ix] !== 1) continue;
                const px = offX + ix * T, py = offY + iy * T;
                if (iy === 0 || mask[(iy - 1) * cols + ix] !== 1) { ctx.moveTo(px, py); ctx.lineTo(px + T, py); }
                if (ix === cols - 1 || mask[iy * cols + (ix + 1)] !== 1) { ctx.moveTo(px + T, py); ctx.lineTo(px + T, py + T); }
                if (iy === rows - 1 || mask[(iy + 1) * cols + ix] !== 1) { ctx.moveTo(px + T, py + T); ctx.lineTo(px, py + T); }
                if (ix === 0 || mask[iy * cols + (ix - 1)] !== 1) { ctx.moveTo(px, py + T); ctx.lineTo(px, py); }
            }
        }
        ctx.stroke();
        ctx.restore();

        // Phase 3: Selected tiles
        ctx.save();
        ctx.fillStyle = 'rgba(54,162,235,0.4)';
        this.selected.forEach(key => {
            const [tx, ty] = key.split(',').map(Number);
            if (!this.cellAllowed({ x: tx, y: ty })) return;
            const { ix, iy } = this.coordToIndex(tx, ty);
            ctx.fillRect(offX + ix * T, offY + iy * T, T, T);
        });
        ctx.restore();

        // Phase 4: Group selection
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

        // Phase 5: Hover highlight
        if (this.hoveredTile && this.validTile(this.hoveredTile) && this.cellAllowed(this.hoveredTile)) {
            const { ix, iy } = this.coordToIndex(this.hoveredTile.x, this.hoveredTile.y);
            const px = offX + ix * T, py = offY + iy * T;
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

// Example usage for a 4096x4096 image, 24px tiles, grid centered on (0,0):
const viewer = new MapViewer({
    imageWidth: 4096,
    imageHeight: 4096,
    tileSize: 24
});
window.viewer = viewer;
