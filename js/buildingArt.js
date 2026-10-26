// =============================================================
//  Procedural isometric building sprites (ภาพชั่วคราว)
//  วาดที่ความละเอียดครึ่งหนึ่งแล้วขยาย ×2 ให้เป็น pixel-art เข้ากับต้นไม้
//  แต่ละ sprite: { img, ax, ay } โดย (ax, ay) = มุมบน (N) ของฐานอาคาร
//  → วางภาพที่ AR.iso.toWorld(b.x, b.y) ได้ตรงช่องพอดี
// =============================================================
window.AR = window.AR || {};

AR.createBuildingArt = function (spr) {
  const HW = 32, HH = 16, SC = 2;

  const parse = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const shade = (hex, f) => {
    const c = parse(hex).map((v) => (f <= 1 ? v * f : v + (255 - v) * (f - 1)));
    return `rgb(${c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(',')})`;
  };
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  function upscale(src, s) {
    const c = AR.makeCanvas(src.width * s, src.height * s), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  // ---------- primitive helpers (ทำงานบน ctx + P ของแต่ละอาคาร) ----------
  function kit(x, P) {
    const poly = (pts, fill, stroke) => {
      x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y))); x.closePath();
      if (fill) { x.fillStyle = fill; x.fill(); }
      if (stroke) { x.strokeStyle = stroke; x.lineWidth = 1; x.stroke(); }
    };
    const line = (a, b, col, w) => { x.strokeStyle = col; x.lineWidth = w || 1; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); };
    const edge = 'rgba(20,14,10,0.45)';
    const box = (x0, y0, x1, y1, z0, h, col, o) => {
      o = o || {};
      poly([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z0 + h), P(x1, y0, z0 + h)], shade(col, o.dark || 0.7), edge);
      poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z0 + h), P(x0, y1, z0 + h)], shade(col, o.lit || 0.95), edge);
      if (!o.noTop) poly([P(x0, y0, z0 + h), P(x1, y0, z0 + h), P(x1, y1, z0 + h), P(x0, y1, z0 + h)], shade(col, 1.12), edge);
      return {
        L: (t, z) => P(x0 + (x1 - x0) * t, y1, z), // หน้า +v (ซ้าย สว่าง)
        R: (t, z) => P(x1, y0 + (y1 - y0) * t, z), // หน้า +u (ขวา มืด)
      };
    };
    const quad = (f, t0, t1, z0, z1, col, frame) => {
      poly([f(t0, z0), f(t1, z0), f(t1, z1), f(t0, z1)], col, frame);
    };
    const win = (f, t0, t1, z0, z1, lit) => {
      quad(f, t0 - 0.015, t1 + 0.015, z0 - 1, z1 + 1, '#4a3a2a');
      quad(f, t0, t1, z0, z1, lit ? '#ffd27a' : '#2c2a3a');
      if (lit) quad(f, t0, (t0 + t1) / 2, z0, z1, '#ffe6a8');
    };
    const pyramid = (x0, y0, x1, y1, z, h, col, o) => {
      o = o === undefined ? 0.1 : o;
      const A = P(x0 - o, y0 - o, z), B = P(x1 + o, y0 - o, z), C = P(x1 + o, y1 + o, z), D = P(x0 - o, y1 + o, z);
      const T = P((x0 + x1) / 2, (y0 + y1) / 2, z + h);
      poly([A, B, T], shade(col, 0.8)); poly([A, D, T], shade(col, 0.85));
      poly([B, C, T], shade(col, 0.68), edge); poly([D, C, T], shade(col, 1.0), edge);
      for (let k = 1; k < 4; k++) {
        const t = k / 4;
        line(lerp(D, T, t), lerp(C, T, t), shade(col, 0.78));
        line(lerp(B, T, t), lerp(C, T, t), shade(col, 0.55));
      }
      line(D, C, shade(col, 1.3), 1.5);
      return T;
    };
    const gable = (x0, y0, x1, y1, z, h, col, wallCol, o) => {
      o = o === undefined ? 0.12 : o;
      const ym = (y0 + y1) / 2;
      const A = P(x0 - o, y0 - o, z), B = P(x1 + o, y0 - o, z), C = P(x1 + o, y1 + o, z), D = P(x0 - o, y1 + o, z);
      const R0 = P(x0 - o, ym, z + h), R1 = P(x1 + o, ym, z + h);
      poly([A, B, R1, R0], shade(col, 0.72));
      poly([P(x1, y0, z), P(x1, y1, z), P(x1, ym, z + h - 2)], shade(wallCol, 0.68), edge);
      poly([B, P(x1 + o, y1 + o, z), R1], shade(col, 0.6));
      poly([D, C, R1, R0], shade(col, 1.0), edge);
      for (let k = 1; k < 5; k++) { const t = k / 5; line(lerp(D, R0, t), lerp(C, R1, t), shade(col, 0.78)); }
      line(D, C, shade(col, 1.35), 1.5);
      line(R0, R1, shade(col, 1.3), 1.5);
    };
    const crenels = (x0, y0, x1, y1, z, col, n) => {
      n = n || 3;
      const s = Math.min(x1 - x0, y1 - y0) / (n * 2 + 1) * 1.0;
      const blocks = [];
      for (let i = 0; i <= n * 2; i += 2) {
        const t = x0 + (x1 - x0) * (i / (n * 2)) - (i === n * 2 ? s : 0);
        const u = y0 + (y1 - y0) * (i / (n * 2)) - (i === n * 2 ? s : 0);
        blocks.push([t, y0], [t, y1 - s], [x0, u], [x1 - s, u]);
      }
      blocks.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
      for (const [bx, by] of blocks) box(bx, by, bx + s, by + s, z, 5, col);
    };
    const ellipse = (cx, cy, z, r, fill, stroke) => {
      const c = P(cx, cy, z);
      x.beginPath(); x.ellipse(c.x, c.y, r * HW * Math.SQRT2, r * HH * Math.SQRT2, 0, 0, Math.PI * 2);
      if (fill) { x.fillStyle = fill; x.fill(); }
      if (stroke) { x.strokeStyle = stroke; x.lineWidth = 1; x.stroke(); }
    };
    const glow = (p, r, col) => {
      const g = x.createRadialGradient(p.x, p.y, 1, p.x, p.y, r);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    };
    const banner = (f, t, z, h, col) => {
      quad(f, t - 0.035, t + 0.035, z - h, z, col);
      quad(f, t - 0.035, t + 0.035, z - 3, z, '#e3b866');
      const a = f(t - 0.035, z - h), b = f(t + 0.035, z - h), m = f(t, z - h - 5);
      poly([a, b, m], col);
    };
    const stoneLines = (f, z0, z1, col) => {
      for (let z = z0 + 5; z < z1; z += 5) line(f(0, z), f(1, z), col);
    };
    return { poly, line, box, quad, win, pyramid, gable, crenels, ellipse, glow, banner, stoneLines };
  }

  function make(size, top, draw) {
    const W = size * 2 * HW + 24, H = size * 2 * HH + top + 14;
    const c = AR.makeCanvas(W, H), x = c.getContext('2d');
    const ox = W / 2, oy = top;
    const P = (gx, gy, z) => ({ x: ox + (gx - gy) * HW, y: oy + (gx + gy) * HH - (z || 0) });
    // เงาใต้อาคาร
    x.fillStyle = 'rgba(10,20,10,0.28)';
    x.beginPath();
    [P(0.1, 0.1), P(size + 0.35, 0.1), P(size + 0.35, size + 0.1), P(0.1, size + 0.1)].forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)));
    x.closePath(); x.fill();
    draw(kit(x, P), P, x);
    const img = upscale(c, SC);
    // ไอคอนสำหรับแถบสร้าง
    const ic = AR.makeCanvas(120, 100), ix = ic.getContext('2d');
    const s = Math.min(112 / c.width, 92 / c.height);
    ix.imageSmoothingEnabled = false;
    ix.drawImage(c, (120 - c.width * s) / 2, (100 - c.height * s) / 2 + 2, c.width * s, c.height * s);
    return { img, ax: ox * SC, ay: oy * SC, icon: ic.toDataURL() };
  }

  const art = {};

  art.house = make(2, 70, (k) => {
    k.box(0.15, 0.15, 1.85, 1.85, 0, 5, '#8e8a84');
    const f = k.box(0.25, 0.25, 1.75, 1.75, 5, 24, '#e6d6b3');
    for (const t of [0, 0.34, 0.67, 1]) { k.line(f.L(t, 5), f.L(t, 29), '#6b4a2e', 1.5); k.line(f.R(t, 5), f.R(t, 29), '#4e3520', 1.5); }
    k.line(f.L(0, 17), f.L(1, 17), '#6b4a2e', 1.5); k.line(f.R(0, 17), f.R(1, 17), '#4e3520', 1.5);
    k.quad(f.L, 0.42, 0.58, 5, 19, '#5a3a22', '#3a2412');
    k.win(f.L, 0.1, 0.26, 20, 26); k.win(f.L, 0.74, 0.9, 20, 26);
    k.win(f.R, 0.3, 0.44, 20, 26); k.win(f.R, 0.6, 0.74, 20, 26);
    k.box(1.15, 0.45, 1.4, 0.7, 30, 26, '#8e8a84');
    k.gable(0.25, 0.25, 1.75, 1.75, 29, 22, '#3d63b0', '#e6d6b3');
  });

  art.tavern = make(2, 76, (k) => {
    k.box(0.12, 0.12, 1.88, 1.88, 0, 5, '#8e8a84');
    const f = k.box(0.22, 0.22, 1.78, 1.78, 5, 28, '#dccaa5');
    for (const t of [0, 0.5, 1]) { k.line(f.L(t, 5), f.L(t, 33), '#6b4a2e', 2); k.line(f.R(t, 5), f.R(t, 33), '#4e3520', 2); }
    k.line(f.L(0, 19), f.L(1, 19), '#6b4a2e', 2); k.line(f.R(0, 19), f.R(1, 19), '#4e3520', 2);
    k.quad(f.L, 0.4, 0.6, 5, 20, '#5a3a22', '#3a2412');
    k.win(f.L, 0.1, 0.3, 23, 30, true); k.win(f.L, 0.7, 0.9, 23, 30, true);
    k.win(f.R, 0.2, 0.4, 23, 30, true); k.win(f.R, 0.6, 0.8, 23, 30, true);
    k.win(f.R, 0.2, 0.4, 9, 16, true);
    k.line(f.R(0.65, 20), f.R(0.85, 20), '#3a2412', 1.5);
    k.quad(f.R, 0.68, 0.84, 11, 18, '#a8412f', '#3a2412');
    k.gable(0.22, 0.22, 1.78, 1.78, 33, 24, '#a8412f', '#dccaa5');
  });

  art.warehouse = make(2, 64, (k) => {
    k.box(0.12, 0.12, 1.88, 1.88, 0, 4, '#8e8a84');
    const f = k.box(0.2, 0.2, 1.8, 1.8, 4, 24, '#94683c');
    for (let z = 8; z < 28; z += 4) { k.line(f.L(0, z), f.L(1, z), '#6e4a28'); k.line(f.R(0, z), f.R(1, z), '#553820'); }
    k.quad(f.L, 0.3, 0.7, 4, 22, '#4e3420', '#2e1e10');
    k.line(f.L(0.5, 4), f.L(0.5, 22), '#2e1e10', 1.5);
    k.line(f.L(0.3, 4), f.L(0.7, 22), '#6e4a28', 1.5); k.line(f.L(0.7, 4), f.L(0.3, 22), '#6e4a28', 1.5);
    k.gable(0.2, 0.2, 1.8, 1.8, 28, 20, '#5e4128', '#94683c');
    k.box(1.85, 1.2, 2.0, 1.4, 0, 8, '#8a6a3a'); k.box(1.55, 1.95, 1.8, 2.0, 0, 8, '#8a6a3a');
  });

  art.sawmill = make(2, 60, (k, P) => {
    const f = k.box(0.2, 0.2, 1.25, 1.8, 0, 20, '#9b7043');
    for (let z = 4; z < 20; z += 4) k.line(f.L(0, z), f.L(1, z), '#6e4a28');
    k.quad(f.L, 0.25, 0.75, 0, 14, '#3e2a18');
    k.win(f.R, 0.3, 0.5, 9, 15);
    k.gable(0.2, 0.2, 1.25, 1.8, 20, 16, '#7a5530', '#9b7043');
    // กองไม้
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) {
      const c = P(1.45 + i * 0.12 + r * 0.06, 1.75, 4 + r * 7);
      k.poly([P(1.45 + i * 0.12 + r * 0.06, 0.5, 4 + r * 7 + 3), c, P(1.45 + i * 0.12 + r * 0.06, 1.75, 4 + r * 7 - 3), P(1.45 + i * 0.12 + r * 0.06, 0.5, 4 + r * 7 - 3)], '#7a5530');
    }
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) {
      const c = P(1.45 + i * 0.12 + r * 0.06, 1.75, 4 + r * 7);
      k.poly([{ x: c.x - 4, y: c.y }, { x: c.x, y: c.y - 3.5 }, { x: c.x + 4, y: c.y }, { x: c.x, y: c.y + 3.5 }], '#d9b07a', '#6e4a28');
    }
  });

  art.mine = make(2, 62, (k, P, x) => {
    const pts = [P(0.1, 0.4), P(0.6, 0.05), P(1.6, 0.1), P(1.95, 0.8), P(1.9, 1.7), P(1.3, 1.95), P(0.4, 1.9), P(0.05, 1.3)];
    const T = P(0.9, 0.9, 40);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const lit = (a.x + b.x) / 2 < T.x;
      k.poly([a, b, T], lit ? '#8d8a85' : '#5f5c58', 'rgba(20,14,10,0.35)');
    }
    for (let i = 0; i < 14; i++) { const p = lerp(pts[(i * 3) % 8], T, 0.2 + (i % 5) * 0.15); x.fillStyle = i % 2 ? '#b8b4ad' : '#4a4744'; x.fillRect(p.x, p.y, 3, 2); }
    // ทางเข้าเหมือง
    const e0 = P(0.55, 1.92, 0), e1 = P(1.05, 1.92, 0);
    k.poly([e0, e1, { x: e1.x, y: e1.y - 18 }, { x: (e0.x + e1.x) / 2, y: (e0.y + e1.y) / 2 - 24 }, { x: e0.x, y: e0.y - 18 }], '#1d1612');
    k.line(e0, { x: e0.x, y: e0.y - 18 }, '#7a5530', 3); k.line(e1, { x: e1.x, y: e1.y - 18 }, '#7a5530', 3);
    k.line({ x: e0.x - 2, y: e0.y - 19 }, { x: e1.x + 2, y: e1.y - 19 }, '#7a5530', 3);
    k.line(P(0.7, 1.95), P(0.7, 2.3), '#555', 1.5); k.line(P(0.9, 1.95), P(0.9, 2.3), '#555', 1.5);
    k.box(1.3, 1.95, 1.65, 2.25, 2, 8, '#6b4a2e');
    for (let i = 0; i < 4; i++) { const p = P(1.38 + i * 0.07, 2.05, 11); x.fillStyle = i % 2 ? '#c9ccd2' : '#e3b866'; x.fillRect(p.x, p.y, 3, 3); }
  });

  art.forge = make(2, 80, (k, P) => {
    k.box(0.12, 0.12, 1.88, 1.88, 0, 4, '#76716b');
    const f = k.box(0.22, 0.22, 1.78, 1.78, 4, 24, '#8a857f');
    k.stoneLines(f.L, 4, 28, '#6a655f'); k.stoneLines(f.R, 4, 28, '#55504b');
    k.quad(f.L, 0.38, 0.62, 4, 20, '#2a1a10');
    k.quad(f.L, 0.42, 0.58, 4, 10, '#ff8a2a');
    k.win(f.R, 0.3, 0.5, 14, 22, true);
    k.pyramid(0.22, 0.22, 1.78, 1.78, 28, 20, '#4b4d57');
    k.box(1.2, 0.35, 1.5, 0.65, 28, 34, '#6a655f');
    k.glow(P(1.35, 0.5, 64), 14, 'rgba(255,140,40,0.85)');
    k.box(0.0, 1.95, 0.35, 2.05, 0, 6, '#3a3a40');
  });

  art.research = make(2, 152, (k, P) => {
    k.box(0.15, 0.15, 1.85, 1.85, 0, 8, '#a8a2b4');
    const f = k.box(0.5, 0.5, 1.5, 1.5, 8, 64, '#cfc6dc');
    k.stoneLines(f.L, 8, 72, '#b3a9c4'); k.stoneLines(f.R, 8, 72, '#9a90ab');
    k.quad(f.L, 0.35, 0.65, 8, 24, '#3a2a55');
    k.win(f.L, 0.38, 0.62, 36, 48, true); k.win(f.R, 0.38, 0.62, 36, 48, true);
    k.win(f.L, 0.38, 0.62, 56, 66, true); k.win(f.R, 0.38, 0.62, 56, 66, true);
    const T = k.pyramid(0.5, 0.5, 1.5, 1.5, 72, 50, '#6a3fb0', 0.14);
    k.glow({ x: T.x, y: T.y - 8 }, 18, 'rgba(120,230,255,0.9)');
    k.poly([{ x: T.x, y: T.y - 18 }, { x: T.x + 5, y: T.y - 9 }, { x: T.x, y: T.y }, { x: T.x - 5, y: T.y - 9 }], '#9ff0ff', '#3aa6e0');
  });

  art.heroHall = make(3, 96, (k) => {
    const pl = k.box(0.1, 0.1, 2.9, 2.9, 0, 8, '#9b968e');
    k.stoneLines(pl.L, 0, 8, '#7d786f');
    const f = k.box(0.4, 0.4, 2.6, 2.6, 8, 36, '#ece2c8');
    for (const t of [0.08, 0.27, 0.73, 0.92]) k.quad(f.L, t - 0.025, t + 0.025, 8, 44, '#fff6e0', 'rgba(0,0,0,0.2)');
    k.quad(f.L, 0.4, 0.6, 8, 30, '#5a3a22', '#3a2412');
    k.quad(f.L, 0.4, 0.6, 30, 34, '#e3b866');
    k.win(f.L, 0.14, 0.21, 24, 36, true); k.win(f.L, 0.79, 0.86, 24, 36, true);
    for (const t of [0.2, 0.45, 0.7]) k.win(f.R, t, t + 0.1, 22, 34, true);
    k.banner(f.R, 0.12, 40, 18, '#b0303a'); k.banner(f.R, 0.88, 40, 18, '#b0303a');
    k.gable(0.4, 0.4, 2.6, 2.6, 44, 30, '#2f56a6', '#ece2c8');
  });

  art.guild = make(3, 84, (k, P, x) => {
    const f = k.box(0.3, 0.3, 2.0, 2.0, 0, 30, '#7a5232');
    for (let z = 5; z < 30; z += 5) { k.line(f.L(0, z), f.L(1, z), '#5e3e24'); k.line(f.R(0, z), f.R(1, z), '#4a2f1a'); }
    k.quad(f.L, 0.38, 0.62, 0, 20, '#2a1a10');
    k.win(f.R, 0.3, 0.5, 14, 22, true);
    // ป้ายดาบไขว้
    const c = f.L(0.5, 25);
    x.strokeStyle = '#d8dde6'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(c.x - 6, c.y - 4); x.lineTo(c.x + 6, c.y + 4); x.moveTo(c.x + 6, c.y - 4); x.lineTo(c.x - 6, c.y + 4); x.stroke();
    k.gable(0.3, 0.3, 2.0, 2.0, 30, 24, '#2e7048', '#7a5232');
    // หุ่นฝึก + ชั้นวางอาวุธ
    k.box(2.45, 2.45, 2.55, 2.55, 0, 26, '#7a5530');
    k.box(2.3, 2.45, 2.7, 2.55, 16, 4, '#7a5530');
    k.box(2.43, 2.43, 2.57, 2.57, 20, 8, '#c9a46a');
    k.box(2.3, 0.6, 2.4, 1.6, 0, 16, '#6b4a2e');
    for (let i = 0; i < 4; i++) k.line(P(2.4, 0.75 + i * 0.25, 2), P(2.4, 0.75 + i * 0.25, 24), '#c9ccd2', 1.5);
  });

  art.farm = make(3, 50, (k, P) => {
    k.poly([P(0.1, 0.1), P(2.9, 0.1), P(2.9, 2.9), P(0.1, 2.9)], '#7b5a2c', 'rgba(40,25,10,0.5)');
    for (let y = 0.3, i = 0; y < 2.8; y += 0.24, i++) {
      const x0 = y < 1.15 ? 1.15 : 0.25;
      k.line(P(x0, y, 1), P(2.75, y, 1), i % 2 ? '#d8b84a' : '#6fae3a', 4);
      k.line(P(x0, y - 0.04, 2.5), P(2.75, y - 0.04, 2.5), i % 2 ? '#f0d878' : '#9ed05a', 1.5);
    }
    for (let t = 0; t <= 2.9; t += 0.4) {
      k.box(t, 2.85, t + 0.06, 2.91, 0, 7, '#8a6a3a');
      k.box(2.85, t, 2.91, t + 0.06, 0, 7, '#8a6a3a');
    }
    k.line(P(0, 2.88, 5), P(2.9, 2.88, 5), '#a8814a', 1.5); k.line(P(2.88, 0, 5), P(2.88, 2.9, 5), '#a8814a', 1.5);
    const f = k.box(0.15, 0.15, 1.0, 1.0, 0, 18, '#b88a55');
    k.quad(f.L, 0.35, 0.65, 0, 12, '#4e3420');
    k.gable(0.15, 0.15, 1.0, 1.0, 18, 13, '#c9a03a', '#b88a55');
  });

  art.fountain = make(2, 56, (k, P) => {
    k.ellipse(1, 1, 0, 0.85, '#7d786f');
    k.ellipse(1, 1, 7, 0.85, '#b8b2a6', 'rgba(20,14,10,0.4)');
    k.ellipse(1, 1, 7, 0.68, '#3f95c8');
    k.ellipse(0.9, 0.9, 7, 0.45, '#6cc3ee');
    k.box(0.9, 0.9, 1.1, 1.1, 7, 18, '#b8b2a6');
    k.ellipse(1, 1, 25, 0.3, '#cfc9bd', 'rgba(20,14,10,0.4)');
    k.ellipse(1, 1, 25, 0.22, '#6cc3ee');
    const top = P(1, 1, 36);
    k.line(P(1, 1, 25), top, '#e8f7ff', 2);
    for (const [dx, dy] of [[-0.4, 0.1], [0.4, -0.1], [0.1, 0.4], [-0.1, -0.4]]) {
      const end = P(1 + dx, 1 + dy, 9);
      k.line(top, { x: (top.x + end.x) / 2, y: top.y - 4 }, 'rgba(220,245,255,0.8)', 1.5);
      k.line({ x: (top.x + end.x) / 2, y: top.y - 4 }, end, 'rgba(220,245,255,0.8)', 1.5);
    }
  });

  art.wall = make(1, 44, (k) => {
    const f = k.box(0, 0, 1, 1, 0, 26, '#a39e94');
    k.stoneLines(f.L, 0, 26, '#8a857b'); k.stoneLines(f.R, 0, 26, '#6e695f');
    for (const t of [0.33, 0.66]) { k.line(f.L(t, 0), f.L(t, 26), '#8a857b'); k.line(f.R(t, 0), f.R(t, 26), '#6e695f'); }
    k.crenels(0, 0, 1, 1, 26, '#a39e94', 2);
  });

  art.archer = make(1, 110, (k) => {
    const f = k.box(0.15, 0.15, 0.85, 0.85, 0, 58, '#9e998f');
    k.stoneLines(f.L, 0, 58, '#837e74'); k.stoneLines(f.R, 0, 58, '#6a655c');
    k.quad(f.L, 0.45, 0.55, 30, 42, '#1d1612'); k.quad(f.R, 0.45, 0.55, 30, 42, '#1d1612');
    k.quad(f.L, 0.35, 0.65, 0, 14, '#5a3a22');
    k.box(0.06, 0.06, 0.94, 0.94, 58, 7, '#8a857b');
    k.crenels(0.06, 0.06, 0.94, 0.94, 65, '#8a857b', 2);
    k.pyramid(0.2, 0.2, 0.8, 0.8, 70, 24, '#a8412f', 0.08);
  });

  art.trap = make(1, 24, (k, P) => {
    k.box(0.12, 0.12, 0.88, 0.88, 0, 3, '#5b4632');
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const gx = 0.25 + i * 0.25, gy = 0.25 + j * 0.25;
      const a = P(gx - 0.07, gy + 0.07, 3), b = P(gx + 0.07, gy + 0.07, 3), c = P(gx + 0.07, gy - 0.07, 3), t = P(gx, gy, 14);
      k.poly([a, b, t], '#d7dae0'); k.poly([b, c, t], '#8c9098');
    }
  });

  art.crystal = make(2, 130, (k, P) => {
    k.box(0.1, 0.1, 1.9, 1.9, 0, 6, '#77728a');
    const f = k.box(0.25, 0.25, 1.75, 1.75, 6, 44, '#8f8aa0');
    k.stoneLines(f.L, 6, 50, '#7a758c'); k.stoneLines(f.R, 6, 50, '#625d73');
    k.quad(f.L, 0.4, 0.6, 6, 24, '#2a2238');
    k.quad(f.L, 0.15, 0.22, 30, 40, '#5fd0ff'); k.quad(f.L, 0.78, 0.85, 30, 40, '#5fd0ff');
    k.quad(f.R, 0.45, 0.55, 30, 40, '#5fd0ff');
    k.crenels(0.25, 0.25, 1.75, 1.75, 50, '#8f8aa0', 3);
    const c = P(1, 1, 92);
    k.glow(c, 46, 'rgba(110,210,255,0.75)');
    const top = { x: c.x, y: c.y - 28 }, bot = { x: c.x, y: c.y + 26 }, l = { x: c.x - 15, y: c.y - 2 }, r = { x: c.x + 15, y: c.y - 2 }, m = { x: c.x + 2, y: c.y + 1 };
    k.poly([top, l, m], '#c8f6ff'); k.poly([top, m, r], '#6fd2f5'); k.poly([l, bot, m], '#5ab8e8'); k.poly([m, bot, r], '#2f86c4');
    k.poly([top, r, bot, l], null, '#e8fdff');
  });

  art.townhall = make(4, 204, (k, P) => {
    const pl = k.box(0.1, 0.1, 3.9, 3.9, 0, 10, '#a19b90');
    k.stoneLines(pl.L, 0, 10, '#857f74'); k.stoneLines(pl.R, 0, 10, '#6c665c');
    const f = k.box(0.5, 0.5, 3.5, 3.5, 10, 44, '#efe5cc');
    k.stoneLines(f.L, 10, 54, '#ddd0b0'); k.stoneLines(f.R, 10, 54, '#c4b694');
    k.quad(f.L, 0.42, 0.58, 10, 36, '#5a3a22', '#3a2412');
    k.quad(f.L, 0.42, 0.58, 36, 40, '#e3b866');
    for (const t of [0.12, 0.26, 0.74, 0.88]) k.win(f.L, t - 0.04, t + 0.04, 26, 40, true);
    for (const t of [0.15, 0.32, 0.5, 0.68, 0.85]) k.win(f.R, t - 0.035, t + 0.035, 26, 40, true);
    k.banner(f.L, 0.34, 52, 26, '#2f56a6'); k.banner(f.L, 0.66, 52, 26, '#2f56a6');
    k.gable(0.5, 0.5, 3.5, 3.5, 54, 30, '#2f56a6', '#efe5cc');
    // หอกลาง
    const t = k.box(1.5, 1.5, 2.5, 2.5, 54, 72, '#efe5cc');
    k.stoneLines(t.L, 54, 126, '#ddd0b0'); k.stoneLines(t.R, 54, 126, '#c4b694');
    k.win(t.L, 0.35, 0.65, 92, 110, true); k.win(t.R, 0.35, 0.65, 92, 110, true);
    k.quad(t.L, 0.3, 0.7, 70, 76, '#e3b866'); k.quad(t.R, 0.3, 0.7, 70, 76, '#c99c4a');
    const T = k.pyramid(1.5, 1.5, 2.5, 2.5, 126, 54, '#2f56a6', 0.16);
    k.line(T, { x: T.x, y: T.y - 14 }, '#e3b866', 2);
    k.poly([{ x: T.x, y: T.y - 14 }, { x: T.x + 10, y: T.y - 11 }, { x: T.x, y: T.y - 8 }], '#c0303a');
    // ป้อมมุม
    for (const [cx, cy] of [[0.2, 3.2], [3.2, 0.2], [3.2, 3.2]]) {
      const s = k.box(cx, cy, cx + 0.6, cy + 0.6, 10, 56, '#e4d8bc');
      k.win(s.L, 0.4, 0.6, 46, 56, true);
      k.pyramid(cx, cy, cx + 0.6, cy + 0.6, 66, 32, '#2f56a6', 0.08);
    }
  });

  art.tower = art.archer;
  art.camp = art.guild; // Hero Party Camp: ภาพชั่วคราว (ใช้ภาพกิลด์) จนกว่าจะมีภาพจริง

  // ---------- ภาพจริงจากไฟล์ (assets/buildings/sprites.js) ----------
  if (spr && spr.tower_blue && AR.SPRITES) {
    const S = AR.SPRITE_SCALE || 0.5;
    const toCanvas = (im) => { const c = AR.makeCanvas(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); return c; };
    const mk = (k, extra) => Object.assign({ img: toCanvas(spr[k]), ax: AR.SPRITES[k].ax, ay: AR.SPRITES[k].ay, scale: S, anchor: 'S' }, extra || {});
    // ไอคอน: วางหลายภาพต่อกันตามจุด anchor แล้วย่อให้พอดีกรอบ 120×100
    const icon = (parts) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of parts) { x0 = Math.min(x0, p.dx - p.e.ax); x1 = Math.max(x1, p.dx - p.e.ax + p.e.img.width); y0 = Math.min(y0, p.dy - p.e.ay); y1 = Math.max(y1, p.dy - p.e.ay + p.e.img.height); }
      const c = AR.makeCanvas(120, 100), x = c.getContext('2d');
      const s = Math.min(112 / (x1 - x0), 94 / (y1 - y0));
      x.imageSmoothingQuality = 'high';
      for (const p of parts) x.drawImage(p.e.img, (p.dx - p.e.ax - x0) * s + (120 - (x1 - x0) * s) / 2, (p.dy - p.e.ay - y0) * s + (100 - (y1 - y0) * s) / 2, p.e.img.width * s, p.e.img.height * s);
      return c.toDataURL();
    };
    art.tower = mk('tower_blue'); art.tower.icon = icon([{ e: art.tower, dx: 0, dy: 0 }]);
    const mages = [0, 1, 2, 3].map((i) => mk('tower_mage' + i));
    art.archer = Object.assign({}, mages[0], { variants: mages, icon: icon([{ e: mages[1], dx: 0, dy: 0 }]) });
    art.crystal = mk('tower_crystal'); art.crystal.icon = icon([{ e: art.crystal, dx: 0, dy: 0 }]);
    const strips = { v: [], u: [] };
    for (let j = 0; AR.SPRITES['wall_v' + j]; j++) { strips.v.push(mk('wall_v' + j, { wall: 'v' })); strips.u.push(mk('wall_u' + j, { wall: 'u' })); }
    art.wall = Object.assign({}, strips.v[0], { strips, icon: icon(strips.v.map((e, j) => ({ e, dx: j * 128, dy: -64 * j }))) });
    art.gates = {};
    for (const k of ['closed_v', 'closed_u', 'open_v', 'open_u']) art.gates[k] = mk('gate_' + k);
    art.fortress = Object.assign({}, art.gates.closed_v, { icon: icon([{ e: art.gates.closed_v, dx: 0, dy: 0 }]) });
  }
  return art;
};
