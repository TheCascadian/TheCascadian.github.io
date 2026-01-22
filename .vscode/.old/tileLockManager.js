// tileLockManager.js
/*
 * TileLockManager – Local/Collaborative Tile Lock System
 * Copyright (c) 2025 TheCascadian
 * MIT License
 */

class TileLockManager {
    constructor(storage) {
        this.storage = storage || window.localStorage;
    }

    getTileLockKey(tx, ty) { // Unique key for tile
        return `tile-lock-${tx},${ty}`;
    }

    isTileLocked(tx, ty) { // Return lock info if locked, else false
        const val = this.storage.getItem(this.getTileLockKey(tx, ty));
        if (!val) return false;
        try { return JSON.parse(val); } catch { return false; }
    }

    setTileLock(tx, ty, user) { // Lock a tile for user
        this.storage.setItem(this.getTileLockKey(tx, ty), JSON.stringify({
            user: user,
            ts: Date.now()
        }));
    }

    releaseTileLock(tx, ty) { // Remove lock from tile
        this.storage.removeItem(this.getTileLockKey(tx, ty));
    }

    getAllTileLocks() { // Return all tile locks as {key: info}
        const out = {};
        for (let i = 0; i < this.storage.length; ++i) {
            const k = this.storage.key(i);
            if (k && k.startsWith('tile-lock-')) {
                try { out[k] = JSON.parse(this.storage.getItem(k)); } catch { }
            }
        }
        return out;
    }

    lockTiles(tileList, user) { // Batch lock [ {x, y}, ... ]
        tileList.forEach(t => this.setTileLock(t.x, t.y, user));
    }

    unlockTiles(tileList) { // Batch unlock [ {x, y}, ... ]
        tileList.forEach(t => this.releaseTileLock(t.x, t.y));
    }

    exportLocksJSON() { // Export all locks as JSON string
        return JSON.stringify(this.getAllTileLocks(), null, 2);
    }

    importLocksJSON(json) { // Import locks from JSON string
        let data = {};
        try { data = JSON.parse(json); } catch { throw new Error('Invalid JSON'); }
        Object.entries(data).forEach(([k, v]) => {
            if (k.startsWith('tile-lock-')) this.storage.setItem(k, JSON.stringify(v));
        });
    }
}

// Export as module for ES6 import
export default TileLockManager;
