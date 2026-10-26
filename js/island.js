// =============================================================
//  Island generator: รูปร่างเกาะ, โซน, เซลล์กริด, ตำแหน่งต้นไม้/ภูเขา
//  ทุกอย่างคำนวณใน "grid space" แล้วแปลงเป็นพิกัดโลกด้วย AR.iso
// =============================================================
window.AR = window.AR || {};

AR.buildIsland = function (cfg) {
  const N = AR.Noise(cfg.seed);
  const rng = AR.mulberry32(cfg.seed * 7 + 1);
  const C = cfg.gridSize / 2;
  const TAU = Math.PI * 2;
  const H = cfg.cliffHeight;
  const P = cfg.plateau;
  const L = cfg.layout;

  // ---------- radial shape functions ----------
  const angN = (th, k, off) => N.fbm(Math.cos(th) * k + off, Math.sin(th) * k + off, 4) * 2 - 1;
  const superR = (th, r0, p) =>
    r0 / Math.pow(Math.pow(Math.abs(Math.cos(th)), p) + Math.pow(Math.abs(Math.sin(th)), p), 1 / p);
  // "front" = ทิศที่หันเข้าหากล้อง (grid +x+y = ลงล่างของจอ)
  const frontness = (th) => AR.smoothstep(-0.55, 0.35, Math.cos(th - Math.PI / 4));
  const backness = (th) => AR.smoothstep(-0.25, 0.75, Math.cos(th - (5 * Math.PI) / 4));

  const SAMPLES = 1440;
  function table(fn) {
    const t = new Float32Array(SAMPLES + 1);
    for (let i = 0; i < SAMPLES; i++) t[i] = fn((i / SAMPLES) * TAU);
    t[SAMPLES] = t[0];
    return (th) => {
      const a = ((((th % TAU) + TAU) % TAU) / TAU) * SAMPLES;
      const i = Math.floor(a), f = a - i;
      return t[i] + (t[i + 1] - t[i]) * f;
    };
  }
  // สนามรบหน้าป้อม: ยืดที่ราบออกไปทางสะพาน (ขวาล่าง) เพิ่ม battlefieldDepth ช่อง
  const thField = (cfg.bridge.axis || 'v') === 'u' ? 0 : Math.PI / 2;
  const fieldBulge = (th) => (cfg.battlefieldDepth || 0) * AR.smoothstep(0.3, 0.85, Math.cos(th - thField));
  const plateauR = table((th) => superR(th, P.radius, P.squareness) + fieldBulge(th) + P.noiseAmp * angN(th, 1.7, 10));
  const upperR = table((th) =>
    plateauR(th) + 0.5 + cfg.rimWidth * backness(th) * (0.8 + 0.4 * N.fbm(Math.cos(th) * 2 + 50, Math.sin(th) * 2 + 50)));
  const ledgeR = table((th) =>
    upperR(th) + AR.lerp(cfg.ledge.back, cfg.ledge.front, frontness(th)) + 0.35 * angN(th, 3, 40));

  const polar = (th, r, dy) => {
    const p = AR.iso.toWorld(C + r * Math.cos(th), C + r * Math.sin(th));
    p.y += dy || 0;
    return p;
  };
  const toPolar = (gx, gy) => {
    const u = gx - C, v = gy - C;
    return { u, v, r: Math.hypot(u, v), th: Math.atan2(v, u) };
  };

  // ---------- polygons (world space) ----------
  const M = 540;
  const upperPoly = [], plateauPoly = [], ledgePoly = [];
  for (let i = 0; i < M; i++) {
    const th = (i / M) * TAU;
    upperPoly.push(polar(th, upperR(th)));
    plateauPoly.push(polar(th, plateauR(th)));
    ledgePoly.push(polar(th, ledgeR(th), H));
  }
  const center = AR.iso.toWorld(C, C);

  // ---------- river (on ledge) ----------
  const riverMid = (cfg.river.inner + cfg.river.outer) / 2;
  const onLedge = (th) => ledgeR(th) - upperR(th) > riverMid;
  let tA = 0, tB = 0;
  while (tA < Math.PI && onLedge(Math.PI / 4 + tA)) tA += 0.005;
  while (tB > -Math.PI && onLedge(Math.PI / 4 + tB)) tB -= 0.005;
  const river = { inner: [], outer: [], center: [], bankIn: [], bankOut: [] };
  for (let t = tB - 0.12; t <= tA + 0.12; t += 0.01) {
    const th = Math.PI / 4 + t, ur = upperR(th);
    const wob = 0.12 * angN(th, 6, 77);
    river.inner.push(polar(th, ur + cfg.river.inner + wob, H));
    river.outer.push(polar(th, ur + cfg.river.outer + wob, H));
    river.center.push(polar(th, ur + riverMid + wob, H));
    river.bankIn.push(polar(th, ur + cfg.river.inner - 0.3 + wob, H));
    river.bankOut.push(polar(th, ur + cfg.river.outer + 0.3 + wob, H));
  }
  const waterfalls = [];
  for (const t of [tA, tB]) {
    const th = Math.PI / 4 + t;
    const p = polar(th, ledgeR(th), H);
    waterfalls.push({ x: p.x, y: p.y, width: 60, length: 520, kind: 'void', th });
  }
  // ---------- bridge axis helpers ----------
  // สะพานวิ่งตามแกน grid 'u' (ไปขวาล่างของจอ) หรือ 'v' (ไปซ้ายล่าง)
  // a = ระยะตามแนวสะพาน (along), c = ระยะขวาง (across)
  const B = cfg.bridge;
  const AX = B.axis || 'v';
  const OFF = B.offset || 0;
  const toAC = (u, v) => (AX === 'u' ? { a: u, c: v } : { a: v, c: u });
  const fromAC = (a, c) => (AX === 'u' ? { gx: C + a, gy: C + c } : { gx: C + c, gy: C + a });
  const thBridge = AX === 'u' ? 0 : Math.PI / 2;

  // waterfall จากหน้าผาลงแม่น้ำ (ใกล้สะพาน เหมือนภาพ Ref)
  {
    const th = thBridge + (AX === 'u' ? 0.42 : -0.42);
    const p = polar(th, upperR(th));
    waterfalls.push({ x: p.x, y: p.y + 16, width: 44, length: H + 40, kind: 'cliff', th });
  }

  // ---------- bridge + portal platform ----------
  let vEdge = 0;
  while (vEdge < 40) {
    const g0 = fromAC(vEdge, OFF);
    const pp = toPolar(g0.gx, g0.gy);
    if (pp.r > plateauR(pp.th)) break;
    vEdge += 0.05;
  }
  // หมายเหตุ: u = ระยะขวาง (across), v = ระยะตามแนว (along) ของสะพาน
  const bridge = {
    axis: AX, u: OFF, w: B.width,
    vStart: vEdge - 1.4, vEdge, vEnd: vEdge + B.length,
    drop: B.deckDrop,
    toWorld: (across, along) => { const g = fromAC(along, across); return AR.iso.toWorld(g.gx, g.gy); },
  };
  // แท่นลอย = ลานรับปลายสะพาน + แท่นซุ้ม Portal ที่ขยับไปด้านข้าง
  // ให้ด้านหน้า (บันได) ของซุ้มหันลงมาหาสะพาน
  const Pt = cfg.portal, r = Pt.radius;
  const side = Pt.side || 2.9;                       // ระยะเยื้องซุ้มออกจากแนวสะพาน (ช่อง)
  const archA = bridge.vEnd + Pt.gap, archC = OFF - side;
  const land = { a: bridge.vEnd + 0.2, c: OFF - 1.0, r: 2.4 };
  const platform = { a: archA, c: archC, r, poly: [], flip: AX === 'v' };
  const circles = [{ a: archA, c: archC, r }, land];
  const o = { a: bridge.vEnd + 0.6, c: OFF - 2.0 };    // จุดที่อยู่ในทั้งสองวง
  for (let i = 0; i < 160; i++) {
    const th = (i / 160) * TAU, da = Math.cos(th), dc = Math.sin(th);
    let t = 0;
    for (const q of circles) {
      const fa = o.a - q.a, fc = o.c - q.c, b = fa * da + fc * dc, cc = fa * fa + fc * fc - q.r * q.r;
      t = Math.max(t, -b + Math.sqrt(Math.max(0, b * b - cc)));
    }
    t *= 1 + 0.08 * (N.fbm(da * 2 + 300, dc * 2 + 300) * 2 - 1);
    const g = fromAC(o.a + da * t, o.c + dc * t);
    platform.poly.push(AR.iso.toWorld(g.gx, g.gy));
  }
  const go = fromAC(o.a, o.c), ga = fromAC(archA, archC);
  platform.center = AR.iso.toWorld(go.gx, go.gy);      // จุดกลางแท่น (ใช้วาดหินใต้แท่น)
  platform.arch = AR.iso.toWorld(ga.gx, ga.gy);        // จุดตั้งซุ้ม Portal
  platform.archG = ga;
  const ge = fromAC(bridge.vEnd, OFF - 0.6);
  platform.exit = AR.iso.toWorld(ge.gx, ge.gy);        // ตีนบันไดซุ้ม → ทางลงสะพาน
  bridge.ledgeHit = (across, along) => {
    const g0 = fromAC(along, across);
    const pp = toPolar(g0.gx, g0.gy);
    return pp.r < ledgeR(pp.th);
  };

  // ---------- terrain value fields (ใช้ทั้งการวาดพื้นและข้อมูลเซลล์) ----------
  // ถนนคดเคี้ยวเล็กน้อยให้ดูเป็นธรรมชาติ แต่ตรงเมื่อใกล้ประตู/สะพาน
  function roadDist(gx, gy) {
    const { a, c } = toAC(gx - C, gy - C);
    const d = Math.max(Math.abs(a), Math.abs(c));
    const calm = (t) => 1 - AR.smoothstep(L.wallRadius - 2.5, L.wallRadius - 0.5, Math.abs(t));
    const wa = (N.fbm(3.1, a * 0.11 + 400, 2) - 0.5) * 2.2 * calm(a) * AR.smoothstep(2, 4, Math.abs(a));
    const wc = (N.fbm(c * 0.11 + 800, 5.7, 2) - 0.5) * 2.2 * calm(c) * AR.smoothstep(2, 4, Math.abs(c));
    let best = Infinity;
    if (d < L.wallRadius + 0.6 || a > 0) best = Math.min(best, Math.abs(c - OFF - wa));
    if (d < L.wallRadius + 0.6) best = Math.min(best, Math.abs(a - wc));
    return best;
  }
  function dirtAt(gx, gy) {
    const u = gx - C, v = gy - C;
    const n = N.fbm(gx * 0.35 + 100, gy * 0.35 + 100, 3) * 2 - 1;
    const d = Math.max(Math.abs(u), Math.abs(v));
    const rw = L.roadHalfWidth;
    const rr = Math.hypot(u * 0.9, v * 0.9);
    let val = 1 - AR.smoothstep(L.plazaRadius - 0.3, L.plazaRadius + 0.6, (d * 0.6 + rr * 0.4) + n * 0.9);
    val = Math.max(val, 1 - AR.smoothstep(rw - 0.25, rw + 0.25, roadDist(gx, gy) + n * 0.3));
    const { a, c } = toAC(u, v);
    const bf = AR.smoothstep(L.wallRadius + 0.3, L.wallRadius + 1.4, a + n * 0.8) *
      AR.smoothstep(-3.5, -1.5, a - Math.abs(c)) *
      AR.smoothstep(0.3, 0.42, N.fbm(gx * 0.3 + 7, gy * 0.3 + 3, 3));
    return Math.max(val, bf);
  }
  function mixAt(gx, gy) {
    const u = gx - C, v = gy - C;
    const d = Math.max(Math.abs(u), Math.abs(v));
    const m = AR.smoothstep(0.5, 0.6, N.fbm(gx * 0.16 + 30, gy * 0.16 + 60, 4));
    return m * (d < L.wallRadius ? 0.55 : 1);
  }
  function rimAt(gx, gy) {
    const pp = toPolar(gx, gy);
    return AR.smoothstep(-0.3, 0.8, pp.r - plateauR(pp.th));
  }

  // ---------- grid cells ----------
  const G = cfg.gridSize;
  const zoneKeys = Object.keys(cfg.zones);
  const cells = new Array(G * G);
  function zoneOf(u, v) {
    const d = Math.max(Math.abs(u), Math.abs(v));
    if (d <= L.coreRadius) return 'core';
    if (d < L.wallRadius) return 'city';
    if (d <= L.wallRadius) return 'wall';
    const { a, c } = toAC(u, v);
    if (a > L.wallRadius && Math.abs(c) <= a + 2) return 'battlefield';
    if (Math.abs(a) >= Math.abs(c)) return a > 0 ? 'battlefield' : 'expB';
    return c > 0 ? 'expA' : 'expC';
  }
  for (let gy = 0; gy < G; gy++) {
    for (let gx = 0; gx < G; gx++) {
      const cx = gx + 0.5, cy = gy + 0.5;
      const pp = toPolar(cx, cy);
      const inside = pp.r < plateauR(pp.th) - 0.9;
      const dv = dirtAt(cx, cy), mv = mixAt(cx, cy);
      const zone = inside ? zoneOf(pp.u, pp.v) : null;
      const ac = toAC(pp.u, pp.v);
      const gate = zone === 'wall' && (Math.abs(ac.c - OFF) < 3 || Math.abs(ac.a) < 3); // ซุ้มประตูกว้าง 6 ช่อง
      cells[gy * G + gx] = {
        x: gx, y: gy, inside, zone, gate,
        terrain: dv > 0.5 ? 'dirt' : mv > 0.5 ? 'grassdirt' : 'grass',
        blocked: false, deco: null,
        road: inside && roadDist(cx, cy) < L.roadHalfWidth,
      };
    }
  }
  const cellAt = (gx, gy) => (gx < 0 || gy < 0 || gx >= G || gy >= G ? null : cells[gy * G + gx]);
  // Town Hall reserved footprint 4x4 at center
  const townHall = { x: C - 4, y: C - 4, w: 8, h: 8 }; // ปราสาทเจ้าเมือง 8×8

  // ---------- decorations ----------
  const decos = [];
  const nearBridge = (gx, gy) => { const q = toAC(gx - C, gy - C); return Math.abs(q.c - OFF) < B.width / 2 + 1.3 && q.a > 0; };
  const nearFall = (th) => waterfalls.some((w) => w.kind === 'void' && Math.abs(Math.atan2(Math.sin(th - w.th), Math.cos(th - w.th))) < 0.1);

  // mountains on back rim
  const MT = Math.round(11 * P.radius / 15);
  for (let k = 0; k < MT; k++) {
    const th = (5 * Math.PI) / 4 + (k / (MT - 1) - 0.5) * 2.35 + (rng() - 0.5) * 0.1;
    const r = upperR(th) - 1.6 - rng() * 1.6;
    const p = polar(th, r);
    decos.push({ type: 'mountain', x: p.x, y: p.y, scale: 0.85 + rng() * 0.5, variant: k, level: 0 });
  }

  // rim forest + plateau edge trees
  const EXT = P.radius + (cfg.battlefieldDepth || 0) + cfg.rimWidth + cfg.ledge.front + 4;
  for (let gy = C - EXT; gy < C + EXT; gy += 0.85) {
    for (let gx = C - EXT; gx < C + EXT; gx += 0.85) {
      const jx = gx + (rng() - 0.5) * 0.7, jy = gy + (rng() - 0.5) * 0.7;
      const pp = toPolar(jx, jy);
      const pr = plateauR(pp.th), ur = upperR(pp.th);
      if (pp.r > pr + 0.15 && pp.r < ur - 0.3) {
        const dens = N.fbm(jx * 0.22 + 500, jy * 0.22 + 500, 3);
        const prob = 0.35 + 0.65 * backness(pp.th) + (dens - 0.5);
        if (nearBridge(jx, jy)) continue;
        if (rng() < prob) addTree(jx, jy, 0);
      } else if (pp.r > pr - 1.1 && pp.r <= pr + 0.15) {
        const q = toAC(pp.u, pp.v);
        if (nearBridge(jx, jy) || q.a > L.wallRadius + 0.5 && q.a + 2 > Math.abs(q.c)) continue; // keep battlefield open
        if (rng() < 0.28) addTree(jx, jy, 0);
      }
    }
  }
  // ledge (river banks)
  for (let gy = C - EXT; gy < C + EXT; gy += 0.75) {
    for (let gx = C - EXT; gx < C + EXT; gx += 0.75) {
      const jx = gx + (rng() - 0.5) * 0.6, jy = gy + (rng() - 0.5) * 0.6;
      const pp = toPolar(jx, jy);
      const ur = upperR(pp.th), lr = ledgeR(pp.th);
      if (pp.r <= ur + 0.2 || pp.r >= lr - 0.4) continue;
      if (nearBridge(jx, jy) || nearFall(pp.th)) continue;
      const rel = pp.r - ur;
      const inRiver = rel > cfg.river.inner - 0.45 && rel < cfg.river.outer + 0.45;
      if (inRiver) continue;
      if (rng() < (rel < cfg.river.inner ? 0.35 : 0.6)) addTree(jx, jy, H);
    }
  }
  // plateau clusters inside expansion zones (สิ่งกีดขวางที่ต้องเคลียร์ก่อนสร้าง)
  for (const c of cells) {
    if (!c.inside || c.road) continue;
    const isExp = c.zone === 'expA' || c.zone === 'expB' || c.zone === 'expC';
    if (!isExp) continue;
    const cl = N.fbm(c.x * 0.22 + 200, c.y * 0.22 + 900, 3);
    if (cl > 0.6) {
      const n = 1 + (rng() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) addTree(c.x + 0.25 + rng() * 0.5, c.y + 0.25 + rng() * 0.5, 0, c);
    } else if (rng() < 0.025) {
      const p = AR.iso.toWorld(c.x + 0.5, c.y + 0.5);
      decos.push({ type: 'rock', x: p.x, y: p.y, variant: (rng() * 4) | 0, level: 0 });
      c.blocked = true; c.deco = 'rock';
    }
  }
  // scattered rocks on rim & ledge
  for (let i = 0; i < 70; i++) {
    const th = rng() * TAU;
    const onL = rng() < 0.45;
    const r = onL ? upperR(th) + cfg.river.outer + 0.5 + rng() * Math.max(0, ledgeR(th) - upperR(th) - cfg.river.outer - 0.9)
                  : plateauR(th) + rng() * (upperR(th) - plateauR(th));
    if (onL && (ledgeR(th) - upperR(th) < cfg.river.outer + 0.9)) continue;
    const gx = C + r * Math.cos(th), gy = C + r * Math.sin(th);
    if (nearBridge(gx, gy)) continue;
    const p = polar(th, r, onL ? H : 0);
    decos.push({ type: 'rock', x: p.x, y: p.y, variant: (rng() * 4) | 0, level: onL ? H : 0 });
  }

  function addTree(gx, gy, level, cell) {
    const p = AR.iso.toWorld(gx, gy);
    const r = rng();
    const variant = r < 0.55 ? 0 : r < 0.78 ? 1 : r < 0.9 ? 2 : 3;
    decos.push({ type: 'tree', x: p.x, y: p.y + level, variant, pick: (rng() * 1000) | 0, scale: 0.85 + rng() * 0.35, level });
    if (cell) { cell.blocked = true; cell.deco = 'tree'; }
    else if (level === 0) {
      const c = cellAt(Math.floor(gx), Math.floor(gy));
      if (c && c.inside) { c.blocked = true; c.deco = 'tree'; }
    }
  }
  // ไม่ให้มีต้นไม้/หินบนแท่น Portal
  const onPlat = (d) => {
    const g = AR.iso.toGrid(d.x, d.y - (d.level || 0));
    const q = toAC(g.gx - C, g.gy - C);
    return circles.some((k) => Math.hypot(q.a - k.a, q.c - k.c) < k.r + 0.8);
  };
  for (let i = decos.length - 1; i >= 0; i--) if (decos[i].type !== 'mountain' && onPlat(decos[i])) decos.splice(i, 1);
  decos.sort((a, b) => a.y - b.y);

  return {
    cfg, C, H, cells, cellAt, townHall, zoneKeys,
    plateauR, upperR, ledgeR, frontness, backness,
    upperPoly, plateauPoly, ledgePoly, center,
    river, waterfalls, bridge, platform, toAC, fromAC,
    dirtAt, mixAt, rimAt, toPolar, polar,
    decos, noise: N,
  };
};
