(function () {
  /* ===========================
     CANVAS SETUP
     =========================== */
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: 2147483647,
  });

  document.body.appendChild(canvas);

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  /* ===========================
     SHARED LABEL + CLAMP LOGIC
     =========================== */
  function drawClampedLabel(text, anchorX, anchorY, dx, dy) {
    const padding = 4;
    ctx.font = '11px monospace';
    const w = ctx.measureText(text).width + padding * 2;
    const h = 14;

    let x = anchorX + (dx >= 0 ? 6 : -w - 6);
    let y = anchorY + (dy >= 0 ? 6 : -h - 6);

    x = Math.max(0, Math.min(x, canvas.width - w));
    y = Math.max(0, Math.min(y, canvas.height - h));

    ctx.strokeStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = '#fff';
    ctx.fillText(text, x + padding, y + h - 3);
  }

  /* ===========================
     HOVER SPACING LOGIC
     =========================== */
  function getNearestSpacing(target) {
    const t = target.getBoundingClientRect();
    const nearest = {
      top: { d: t.top },
      bottom: { d: canvas.height - t.bottom },
      left: { d: t.left },
      right: { d: canvas.width - t.right },
    };

    for (const el of document.body.querySelectorAll('*')) {
      if (el === target) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;

      if (r.bottom <= t.top) nearest.top.d = Math.min(nearest.top.d, t.top - r.bottom);
      if (r.top >= t.bottom) nearest.bottom.d = Math.min(nearest.bottom.d, r.top - t.bottom);
      if (r.right <= t.left) nearest.left.d = Math.min(nearest.left.d, t.left - r.right);
      if (r.left >= t.right) nearest.right.d = Math.min(nearest.right.d, r.left - t.right);
    }

    return { t, nearest };
  }

  /* ===========================
     AUTO RULER OVERLAY
     =========================== */
  const RULER_UNIT = 'px'; // 'px' | 'vw' | '%'
  const MAX_RULER_ELEMENTS = 250;

  function colorForElement(el) {
    let hash = 0;
    const str = el.tagName + (el.id || '') + (el.className || '');
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return `hsla(${Math.abs(hash) % 360}, 90%, 55%, 0.85)`;
  }

  function formatValue(px, axis) {
    if (RULER_UNIT === 'vw') return `${(px / window.innerWidth * 100).toFixed(1)}vw`;
    if (RULER_UNIT === '%') {
      const base = axis === 'x' ? window.innerWidth : window.innerHeight;
      return `${(px / base * 100).toFixed(1)}%`;
    }
    return `${Math.round(px)}px`;
  }

  function drawRuler(x1, y1, x2, y2, label, color, axis) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const cap = 4;
    ctx.beginPath();
    if (axis === 'y') {
      ctx.moveTo(x1 - cap, y1);
      ctx.lineTo(x1 + cap, y1);
      ctx.moveTo(x2 - cap, y2);
      ctx.lineTo(x2 + cap, y2);
    } else {
      ctx.moveTo(x1, y1 - cap);
      ctx.lineTo(x1, y1 + cap);
      ctx.moveTo(x2, y2 - cap);
      ctx.lineTo(x2, y2 + cap);
    }
    ctx.stroke();

    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    drawClampedLabel(label, cx, cy, axis === 'x' ? 0 : -1, axis === 'y' ? 0 : -1);
  }

  function renderAutoRulers() {
    let count = 0;
    for (const el of document.body.querySelectorAll('*')) {
      if (count++ > MAX_RULER_ELEMENTS) break;

      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right < 0 || r.bottom < 0 || r.left > canvas.width || r.top > canvas.height) continue;

      const color = colorForElement(el);

      drawRuler(
        r.left,
        r.top - 6,
        r.right,
        r.top - 6,
        formatValue(r.width, 'x'),
        color,
        'x'
      );

      drawRuler(
        r.left - 6,
        r.top,
        r.left - 6,
        r.bottom,
        formatValue(r.height, 'y'),
        color,
        'y'
      );
    }
  }

  /* ===========================
     MAIN RENDER
     =========================== */
  function render(target) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (target) {
      const { t, nearest } = getNearestSpacing(target);
      const cx = t.left + t.width / 2;
      const cy = t.top + t.height / 2;

      if (target.parentElement) {
        const p = target.parentElement.getBoundingClientRect();
        ctx.strokeStyle = 'rgba(0,128,255,0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.left, p.top, p.width, p.height);
      }

      ctx.strokeStyle = 'red';
      ctx.lineWidth = 1;

      drawClampedLabel(`${Math.round(nearest.top.d)}px`, cx, t.top, 0, -1);
      drawClampedLabel(`${Math.round(nearest.bottom.d)}px`, cx, t.bottom, 0, 1);
      drawClampedLabel(`${Math.round(nearest.left.d)}px`, t.left, cy, -1, 0);
      drawClampedLabel(`${Math.round(nearest.right.d)}px`, t.right, cy, 1, 0);
    }

    renderAutoRulers();
  }

  /* ===========================
     EVENTS
     =========================== */
  let current = null;

  document.addEventListener('mousemove', (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el !== current) {
      current = el;
      render(current);
    }
  });

  document.addEventListener('mouseleave', () => {
    current = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  render(null);
})();
