// Core helpers: RNG, noise, math, iso projection
window.AR = window.AR || {};

AR.mulberry32 = function (seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

AR.Noise = function (seed) {
  const s = seed | 0;
  function hash(ix, iy) {
    let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(s, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function value(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  function fbm(x, y, oct) {
    oct = oct || 4;
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * value(x * f + i * 17.3, y * f - i * 9.1);
      norm += amp; amp *= 0.5; f *= 2.03;
    }
    return sum / norm; // 0..1
  }
  return { value, fbm, hash };
};

AR.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
AR.lerp = (a, b, t) => a + (b - a) * t;
AR.smoothstep = (e0, e1, x) => {
  const t = AR.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- Isometric projection (grid <-> world pixels) ----
AR.iso = {
  hw: 64, hh: 32,
  init(cfg) { this.hw = cfg.tileW / 2; this.hh = cfg.tileH / 2; },
  toWorld(gx, gy) { return { x: (gx - gy) * this.hw, y: (gx + gy) * this.hh }; },
  toGrid(x, y) { return { gx: (x / this.hw + y / this.hh) / 2, gy: (y / this.hh - x / this.hw) / 2 }; },
};

AR.makeCanvas = function (w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

AR.polyPath = function (ctx, pts, dy) {
  dy = dy || 0;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y + dy);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y + dy);
  ctx.closePath();
};

AR.bounds = function (pts, dy) {
  dy = dy || 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y + dy < y0) y0 = p.y + dy; if (p.y + dy > y1) y1 = p.y + dy;
  }
  return { x0, y0, x1, y1 };
};
