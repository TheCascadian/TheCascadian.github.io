/*
 * Clean Commonwealth Cartographer
 * Copyright (c) 2025 TheCascadian
 *
 * Licensed under the MIT License.
 * See LICENSE.md for details.
 */

(function () {
    'use strict';

    /* ─── GitHub Configuration ───────────────────────────────────────── */
    const GH_OWNER = window.GH_OWNER || 'TheCascadian';
    const GH_REPO = window.GH_REPO || 'TheCascadian.github.io';
    const GH_BASE = `https://github.com/${GH_OWNER}/${GH_REPO}`;

    /* ─── Internal State ─────────────────────────────────────────────── */
    let lastContextEvent = null;

    /* ─── Error Popup ────────────────────────────────────────────────── */
    function showErrorPopup(msg, stack = '') {
        // Re‑use a single popup if possible
        let pop = document.getElementById('error-popup');
        if (!pop) {
            pop = document.createElement('div');
            pop.id = 'error-popup';
            Object.assign(pop.style, {
                position: 'fixed',
                top: '12px',
                right: '12px',
                maxWidth: '420px',
                background: 'var(--color-panel, #2b2b2b)',
                color: 'var(--color-text, #f0f0f0)',
                border: '2px solid var(--color-accent, #e53935)',
                borderRadius: '6px',
                padding: '12px',
                fontFamily: 'monospace',
                fontSize: '14px',
                zIndex: 1e6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                whiteSpace: 'pre-wrap',
                overflowY: 'auto',
                maxHeight: '60vh'
            });
            const btn = document.createElement('button');
            btn.textContent = 'Dismiss';
            Object.assign(btn.style, {
                marginTop: '8px',
                cursor: 'pointer',
                background: 'var(--color-bg-terminal, #000)',
                color: 'var(--color-accent, #e53935)',
                border: '1px solid currentColor',
                padding: '4px 8px',
                borderRadius: '4px'
            });
            btn.onclick = () => pop.remove();
            pop.appendChild(btn);
            document.body.appendChild(pop);
        }
        const pre = document.createElement('div');
        pre.textContent = `[${new Date().toLocaleTimeString()}] ${msg}${stack ? `\n${stack}` : ''}`;
        pop.insertBefore(pre, pop.firstChild);
    }

    // Global error traps
    window.addEventListener('error', e => showErrorPopup(e.message, e.error?.stack));
    window.addEventListener('unhandledrejection', e => {
        const reason = e.reason;
        const msg = reason?.message || reason || 'Unhandled promise rejection';
        showErrorPopup(msg, reason?.stack);
    });

    /* ─── Utility Functions ──────────────────────────────────────────── */
    function getTileCoord(e) {
        const canvas = document.getElementById('canvas');
        if (!canvas) throw new Error('Canvas element #canvas not found.');
        const rect = canvas.getBoundingClientRect();

        // Device pixel ratio from viewer (or fallback to window)
        const dpr = window.viewer?.dpr || window.devicePixelRatio || 1;

        // Screen-space mouse position relative to canvas
        const cssX = e.clientX - rect.left;
        const cssY = e.clientY - rect.top;

        // Viewer pan/zoom state
        const state = window.viewer?.state || { panX: 0, panY: 0, scale: 1 };
        const scale = state.scale || 1;
        const panX = state.panX || 0;
        const panY = state.panY || 0;

        // World (image) coordinates, including pan/zoom/dpr
        const worldX = (cssX * dpr) / scale + panX;
        const worldY = (cssY * dpr) / scale + panY;

        // Tile grid offset and size from viewer config
        const offsetX = window.viewer?.OFFSET?.X || 0;
        const offsetY = window.viewer?.OFFSET?.Y || 0;
        const tile = window.viewer?.CONFIG?.TILE_SIZE || 1;

        // Tile indices
        const tx = Math.floor((worldX - offsetX) / tile);
        const ty = Math.floor((worldY - offsetY) / tile);

        return {
            tx,
            ty,
            x: cssX,
            y: cssY
        };
    }


    function annotateCell() {
        if (!lastContextEvent) return;
        const { tx, ty } = getTileCoord(lastContextEvent);
        const key = `annotation-${tx}-${ty}`;
        const text = localStorage.getItem(key) || 'No annotation saved.';
        const tip = document.createElement('div');
        Object.assign(tip.style, {
            position: 'absolute',
            left: `${lastContextEvent.pageX + 8}px`,
            top: `${lastContextEvent.pageY + 8}px`,
            background: 'var(--color-panel, #2b2b2b)',
            border: '1px solid var(--color-border, #888)',
            borderRadius: '4px',
            padding: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            color: 'var(--color-text, #f0f0f0)',
            fontFamily: 'monospace',
            zIndex: 1e6,
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
            maxWidth: '240px'
        });
        tip.textContent = text;
        document.body.appendChild(tip);
        document.getElementById('canvas')
            .addEventListener('mousemove', () => tip.remove(), { once: true });
    }

    function notateCell() {
        if (!lastContextEvent) return;
        const { tx, ty } = getTileCoord(lastContextEvent);
        const key = `note-${tx}-${ty}`;
        const existing = localStorage.getItem(key) || '';
        const popup = document.createElement('div');
        Object.assign(popup.style, {
            position: 'absolute',
            left: `${lastContextEvent.pageX}px`,
            top: `${lastContextEvent.pageY}px`,
            transform: 'translate(-50%, 0)',
            background: 'var(--color-panel, #2b2b2b)',
            border: '1px solid var(--color-border, #888)',
            borderRadius: '4px',
            padding: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            color: 'var(--color-text, #f0f0f0)',
            fontFamily: 'monospace',
            zIndex: 1e6
        });
        popup.innerHTML = `
            <div id="note-editor" contenteditable="true"
                 style="min-width:220px;min-height:90px;
                        background:#111;color:#eee;
                        border:1px solid #555;border-radius:4px;
                        padding:6px;white-space:pre-wrap;">
                ${existing}
            </div>
            <button id="save" style="margin-top:6px;padding:4px 8px;">Save</button>
            <button id="close" style="margin-left:6px;margin-top:6px;padding:4px 8px;">Close</button>
        `;
        document.body.appendChild(popup);
        popup.querySelector('#save').onclick = () => {
            const val = popup.querySelector('#note-editor').innerText.trim();
            localStorage.setItem(key, val);
            popup.remove();
        };
        popup.querySelector('#close').onclick = () => popup.remove();
    }

    function labelCell() {
        if (!lastContextEvent) return;
        const { tx, ty } = getTileCoord(lastContextEvent);
        const key = `label-${tx}-${ty}`;
        const existing = localStorage.getItem(key) || '';
        const answer = prompt(`Label for cell (${tx}, ${ty}):`, existing);
        if (answer !== null) localStorage.setItem(key, answer);
    }

    function claimCellMod() {
        if (!lastContextEvent) return;
        const { tx, ty } = getTileCoord(lastContextEvent);
        const title = `Claim Cell (${tx},${ty})`;
        const body = `I wish to claim cell (${tx}, ${ty}) for my mod.`;
        window.open(`${GH_BASE}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`,
            '_blank');
    }

    function claimCellGroup() {
        if (!lastContextEvent) return;
        const { tx, ty } = getTileCoord(lastContextEvent);
        const title = `Claim Region Group at (${tx},${ty})`;
        const body = `I wish to claim the region group around cell (${tx}, ${ty}).`;
        window.open(`${GH_BASE}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`,
            '_blank');
    }

    function tagCellPR() {
        window.open(`${GH_BASE}/pull/new`, '_blank');
    }

    function purgeCache() {
        try {
            if (window.viewer?.purgeCache) {
                window.viewer.purgeCache();
            } else {
                caches.keys().then(keys => Promise.all(keys.map(caches.delete)));
            }
            showErrorPopup('Cache purged successfully.');
        } catch (err) {
            showErrorPopup('Cache purge failed.', err.stack);
        }
    }

    function openSettingsMenu() {
        let panel = document.getElementById('settings-panel');
        if (panel) return panel.remove();
        panel = document.createElement('div');
        panel.id = 'settings-panel';
        Object.assign(panel.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--color-panel, #2b2b2b)',
            border: '1px solid var(--color-border, #888)',
            borderRadius: '6px',
            padding: '16px',
            color: 'var(--color-text, #f0f0f0)',
            fontFamily: 'monospace',
            zIndex: 1e6,
            maxWidth: '80vw',
            maxHeight: '80vh',
            overflowY: 'auto'
        });
        panel.innerHTML = `
            <h2 style="margin-top:0">Settings</h2>
            <p>(settings controls forthcoming)</p>
            <button id="close" style="margin-top:8px;padding:4px 8px;">Close</button>
        `;
        panel.querySelector('#close').onclick = () => panel.remove();
        document.body.appendChild(panel);
    }

    /* ─── Context Menu Construction ──────────────────────────────────── */
    /* Context Menu Construction */
    const menu = document.createElement('div');
    menu.id = 'custom-context-menu';
    menu.innerHTML = `
        <ul>
        <li class="has-submenu">Browser Options
            <ul class="submenu">
            <li data-action="copy-url">Copy Page URL</li>
            <li data-action="open-devtools">Open DevTools</li>
            </ul>
        </li>
        <li class="has-submenu">Cell Actions
            <ul class="submenu">
            <li data-action="annotate-cell">Annotate Cell</li>
            <li data-action="notate-cell">Notate Cell</li>
            <li data-action="label-cell">Label Cell</li>
            <li class="has-submenu">Claim
                <ul class="submenu">
                <li data-action="claim-cell-mod">Cell for Mod (GitHub)</li>
                <li data-action="claim-cell-group">Cell Group as Region (GitHub)</li>
                </ul>
            </li>
            <li data-action="tag-cell-pr">Tag Cell for PR</li>
            </ul>
        </li>
        <li data-action="purge-cache">Purge Cache</li>
        <li data-action="open-settings">Settings…</li>
        </ul>
    `;
    document.body.appendChild(menu);

    /* ─── Context Menu Display Logic ─────────────────────────────────── */
    document.addEventListener('contextmenu', e => {
        lastContextEvent = e;
        e.preventDefault();
        menu.style.top = `${e.pageY}px`;
        menu.style.left = `${e.pageX}px`;
        menu.style.display = 'block';
    });
    document.addEventListener('click', () => {
        menu.style.display = 'none';
    });

    /* ─── Action Dispatcher ──────────────────────────────────────────── */
    menu.addEventListener('click', e => {
        const action = e.target.getAttribute('data-action');
        if (!action) return;
        e.stopPropagation();
        try {
            switch (action) {
                case 'copy-url': navigator.clipboard.writeText(location.href); break;
                case 'open-devtools': alert('Press F12 or Ctrl+Shift+I to open DevTools.'); break;
                case 'annotate-cell': annotateCell(); break;
                case 'notate-cell': notateCell(); break;
                case 'label-cell': labelCell(); break;
                case 'claim-cell-mod': claimCellMod(); break;
                case 'claim-cell-group': claimCellGroup(); break;
                case 'tag-cell-pr': tagCellPR(); break;
                case 'purge-cache': purgeCache(); break;
                case 'open-settings': openSettingsMenu(); break;
            }
        } catch (err) {
            showErrorPopup(err.message, err.stack);
        }
        menu.style.display = 'none';
    });
})();
