// =============================================================
//  Terrain baker: วาดพื้นเกาะทั้งหมดลง canvas เป็น chunk ครั้งเดียวตอนโหลด
//  ลำดับชั้น: ใต้เกาะ → ชั้นล่าง+แม่น้ำ → หน้าผา → ที่ราบ (splat 3 texture)
//            → เสาสะพาน → แท่น Portal → พื้นสะพาน
// =============================================================
window.AR = window.AR || {};

AR.bakeTerrain = async function (island, images, art, onProgress) {
  const cfg = island.cfg, H = island.H, CS = cfg.chunkSize, MS = cfg.maskScale;
  const iso = AR.iso, C = island.C;

  // ---------- bounds ----------
  const bl = AR.bounds(island.ledgePoly), bu = AR.bounds(island.upperPoly), bp = AR.bounds(island.platform.poly);
  const x0 = Math.floor(Math.min(bl.x0, bu.x0, bp.x0) - 60);
  const x1 = Math.ceil(Math.max(bl.x1, bu.x1, bp.x1) + 60);
  const y0 = Math.floor(Math.min(bl.y0, bu.y0, bp.y0) - 60);
  const y1 = Math.ceil(Math.max(bl.y1 + cfg.underside.max, bp.y1 + 420) + 40);

  const temp = AR.makeCanvas(CS, CS), tctx = temp.getContext('2d');

  // ---------- geometry helpers ----------
  function centroid(poly) {
    let sx = 0, sy = 0;
    for (const p of poly) { sx += p.x; sy += p.y; }
    return { x: sx / poly.length, y: sy / poly.length };
  }
  // ช่วงขอบที่หันหน้าเข้ากล้อง (มองเห็นหน้าผา)
  function frontRuns(poly) {
    const n = poly.length, ctr = centroid(poly), f = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      let nx = b.y - a.y, ny = -(b.x - a.x);
      const mx = (a.x + b.x) / 2 - ctr.x, my = (a.y + b.y) / 2 - ctr.y;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      f[i] = ny / Math.hypot(nx, ny) > 0.02;
    }
    let s = f.findIndex((v, i) => v && !f[(i - 1 + n) % n]);
    if (s < 0) return f[0] ? [poly.concat([poly[0]])] : [];
    const runs = [];
    for (let k = 0; k < n; k++) {
      const i = (s + k) % n;
      if (f[i] && !f[(i - 1 + n) % n]) runs.push([poly[i]]);
      if (f[i]) runs[runs.length - 1].push(poly[(i + 1) % n]);
    }
    return runs;
  }
  function stripPath(ctx, top, depth, from, to) {
    // from/to: 0..1 fractions of depth — แถบย่อยของผนัง
    from = from || 0; to = to === undefined ? 1 : to;
    ctx.beginPath();
    top.forEach((p, i) => { const y = p.y + depth[i] * from; i ? ctx.lineTo(p.x, y) : ctx.moveTo(p.x, y); });
    for (let i = top.length - 1; i >= 0; i--) ctx.lineTo(top[i].x, top[i].y + depth[i] * to);
    ctx.closePath();
  }
  function lightGradient(ctx, top, lit, shade) {
    let a = Infinity, b = -Infinity;
    for (const p of top) { a = Math.min(a, p.x); b = Math.max(b, p.x); }
    const g = ctx.createLinearGradient(a, 0, b, 0);
    g.addColorStop(0, lit); g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, shade);
    return g;
  }

  // ---------- precomputed strips ----------
  const N = island.noise;
  const cliffRuns = frontRuns(island.upperPoly).map((top) => ({
    top,
    depth: top.map((p) => H + 4 + 14 * N.fbm(p.x * 0.02, p.y * 0.02 + 70, 2) + (N.hash((p.x * 3) | 0, (p.y * 3) | 0) * 8)),
  }));
  const ledgeCx = island.center.x;
  const halfW = (bl.x1 - bl.x0) / 2;
  const undersideRuns = frontRuns(island.ledgePoly).map((top) => ({
    top,
    depth: top.map((p) => {
      const t = 1 - Math.min(1, Math.abs(p.x - ledgeCx) / halfW);
      const jag = N.fbm(p.x * 0.012 + 9, 3, 3) * 120 + N.hash((p.x / 9) | 0, 7) * 40;
      return cfg.underside.min + (cfg.underside.max - cfg.underside.min) * Math.pow(t, 0.8) + jag * (0.3 + t);
    }),
  }));
  const plat = island.platform;
  const pHalf = (bp.x1 - bp.x0) / 2;
  const platRuns = frontRuns(plat.poly).map((top) => ({
    top,
    depth: top.map((p) => {
      const t = 1 - Math.min(1, Math.abs(p.x - plat.center.x) / pHalf);
      return 40 + 330 * Math.pow(t, 1.3) + N.hash((p.x / 7) | 0, 11) * 30;
    }),
  }));

  // ---------- splat masks (per chunk, low-res) ----------
  function buildMasks(cx, cy) {
    const mw = Math.ceil(CS / MS), mh = Math.ceil(CS / MS);
    const mk = () => { const c = AR.makeCanvas(mw, mh); return { c, ctx: c.getContext('2d'), d: null }; };
    const dirt = mk(), mix = mk(), rim = mk();
    for (const m of [dirt, mix, rim]) m.d = m.ctx.createImageData(mw, mh);
    for (let j = 0; j < mh; j++) {
      const wy = cy + j * MS + MS / 2;
      if (wy < bu.y0 - MS || wy > bu.y1 + MS) continue;
      for (let i = 0; i < mw; i++) {
        const wx = cx + i * MS + MS / 2;
        if (wx < bu.x0 - MS || wx > bu.x1 + MS) continue;
        const g = iso.toGrid(wx, wy);
        const k = (j * mw + i) * 4 + 3;
        const rv = island.rimAt(g.gx, g.gy);
        rim.d.data[k] = rv * 255;
        if (rv > 0.98) continue;
        dirt.d.data[k] = island.dirtAt(g.gx, g.gy) * 255;
        mix.d.data[k] = island.mixAt(g.gx, g.gy) * 255;
      }
    }
    for (const m of [dirt, mix, rim]) m.ctx.putImageData(m.d, 0, 0);
    return { dirt: dirt.c, mix: mix.c, rim: rim.c };
  }

  // ---------- drawing helpers ----------
  function patterns(ctx) {
    const s = cfg.textureScale;
    const mk = (img, sc) => {
      const p = ctx.createPattern(img, 'repeat');
      if (sc !== 1 && p.setTransform) p.setTransform(new DOMMatrix().scale(sc));
      return p;
    };
    return {
      grass: mk(images.grass, s), grassdirt: mk(images.grassdirt, s), dirt: mk(images.dirt, s),
      cliff: mk(art.cliffTex, 1), under: mk(art.undersideTex, 1),
    };
  }
  function maskedLayer(ctx, cx, cy, fill, mask) {
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, CS, CS);
    tctx.setTransform(1, 0, 0, 1, -cx, -cy);
    tctx.fillStyle = fill;
    tctx.fillRect(cx, cy, CS, CS);
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(mask, 0, 0, mask.width * MS, mask.height * MS);
    tctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(temp, 0, 0); ctx.restore();
  }
  // ผนังหินที่จางหายลงไปในหุบเหว (ใต้เกาะลอยฟ้า)
  function underside(ctx, cx, cy, runs, pat) {
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, CS, CS);
    tctx.setTransform(1, 0, 0, 1, -cx, -cy);
    for (const r of runs) {
      stripPath(tctx, r.top, r.depth);
      tctx.fillStyle = pat; tctx.fill();
      tctx.fillStyle = lightGradient(tctx, r.top, 'rgba(255,230,200,0.10)', 'rgba(0,0,10,0.45)'); tctx.fill();
      for (let k = 1; k < 10; k++) {
        stripPath(tctx, r.top, r.depth, k / 10, 1);
        tctx.fillStyle = 'rgba(20,10,30,0.10)'; tctx.fill();
      }
      tctx.globalCompositeOperation = 'destination-out';
      for (let k = 3; k < 12; k++) {
        stripPath(tctx, r.top, r.depth, k / 12, 1.02);
        tctx.fillStyle = 'rgba(0,0,0,0.16)'; tctx.fill();
      }
      tctx.globalCompositeOperation = 'source-over';
      // hanging roots/top lip
      tctx.strokeStyle = 'rgba(40,30,20,0.9)'; tctx.lineWidth = 4;
      tctx.beginPath(); r.top.forEach((p, i) => (i ? tctx.lineTo(p.x, p.y + 2) : tctx.moveTo(p.x, p.y + 2))); tctx.stroke();
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(temp, 0, 0); ctx.restore();
  }
  function polyline(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  }
  function band(ctx, a, b) {
    ctx.beginPath();
    a.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    for (let i = b.length - 1; i >= 0; i--) ctx.lineTo(b[i].x, b[i].y);
    ctx.closePath();
  }
  const lerpPts = (a, b, t) => a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * t, y: p.y + (b[i].y - p.y) * t }));
  const g = (u, v) => island.bridge.toWorld(u, v); // u = ขวางสะพาน, v = ตามแนวสะพาน

  // ---------- bridge pieces ----------
  const br = island.bridge;
  const uL = br.u - br.w / 2, uR = br.u + br.w / 2;
  const pillars = [];
  for (let v = br.vEdge + 1.0; v < br.vEnd - 0.4; v += 2.6) {
    const onLedge = br.ledgeHit(uR, v + 0.35);
    pillars.push({ v, bottom: onLedge ? H + 6 : H + 420, onLedge });
  }
  function drawPillars(ctx, which) {
    for (const p of pillars) {
      if (which === 'ledge' && !p.onLedge) continue;
      if (which === 'void' && p.onLedge) continue;
      const a = g(uL, p.v + 0.7), b = g(uR, p.v + 0.7), c = g(uR, p.v);
      const fade = (y0, y1, col) => {
        if (p.onLedge) return col;
        const gr = ctx.createLinearGradient(0, y0, 0, y1);
        gr.addColorStop(0, col); gr.addColorStop(0.55, col); gr.addColorStop(1, 'rgba(20,14,30,0)');
        return gr;
      };
      // +v face (lit)
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + br.drop); ctx.lineTo(b.x, b.y + br.drop);
      ctx.lineTo(b.x, b.y + p.bottom); ctx.lineTo(a.x, a.y + p.bottom); ctx.closePath();
      ctx.fillStyle = fade(a.y, a.y + p.bottom, br.axis === 'u' ? '#776e60' : '#a59a86'); ctx.fill();
      // +u face (shade)
      ctx.beginPath();
      ctx.moveTo(c.x, c.y + br.drop); ctx.lineTo(b.x, b.y + br.drop);
      ctx.lineTo(b.x, b.y + p.bottom); ctx.lineTo(c.x, c.y + p.bottom); ctx.closePath();
      ctx.fillStyle = fade(c.y, c.y + p.bottom, br.axis === 'u' ? '#a59a86' : '#776e60'); ctx.fill();
      // block lines
      ctx.strokeStyle = 'rgba(40,30,25,0.35)'; ctx.lineWidth = 1.5;
      for (let y = br.drop + 22; y < Math.min(p.bottom, 260); y += 22) {
        ctx.beginPath(); ctx.moveTo(a.x, a.y + y); ctx.lineTo(b.x, b.y + y); ctx.lineTo(c.x, c.y + y); ctx.stroke();
      }
    }
  }
  function drawDeck(ctx, pats) {
    const S0 = br.vStart, S1 = br.vEnd;
    // arches/spandrels on the front (+u) face
    const stops = [br.vEdge - 0.1].concat(pillars.map((p) => p.v)).concat([S1]);
    for (let k = 0; k < stops.length - 1; k++) {
      const va = k === 0 ? stops[0] : stops[k] + 0.7, vb = stops[k + 1];
      if (vb - va < 0.4) continue;
      const A = g(uR, va), B = g(uR, vb), M = g(uR, (va + vb) / 2);
      ctx.beginPath();
      ctx.moveTo(A.x, A.y + br.drop - 2); ctx.lineTo(B.x, B.y + br.drop - 2);
      ctx.lineTo(B.x, B.y + br.drop + 50);
      ctx.quadraticCurveTo(M.x, M.y + br.drop - 8, A.x, A.y + br.drop + 50);
      ctx.closePath();
      ctx.fillStyle = '#857b6b'; ctx.fill();
      ctx.strokeStyle = 'rgba(40,30,25,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(B.x, B.y + br.drop + 50); ctx.quadraticCurveTo(M.x, M.y + br.drop - 8, A.x, A.y + br.drop + 50); ctx.stroke();
    }
    // front side face
    const fA = g(uR, S0), fB = g(uR, S1);
    ctx.beginPath(); ctx.moveTo(fA.x, fA.y); ctx.lineTo(fB.x, fB.y); ctx.lineTo(fB.x, fB.y + br.drop); ctx.lineTo(fA.x, fA.y + br.drop); ctx.closePath();
    ctx.fillStyle = br.axis === 'u' ? '#a69b86' : '#8b8171'; ctx.fill();
    // end face
    const eA = g(uL, S1);
    ctx.beginPath(); ctx.moveTo(eA.x, eA.y); ctx.lineTo(fB.x, fB.y); ctx.lineTo(fB.x, fB.y + br.drop); ctx.lineTo(eA.x, eA.y + br.drop); ctx.closePath();
    ctx.fillStyle = br.axis === 'u' ? '#857b6b' : '#a69b86'; ctx.fill();
    // deck
    const d0 = g(uL, S0), d1 = g(uR, S0), d2 = g(uR, S1), d3 = g(uL, S1);
    ctx.beginPath(); ctx.moveTo(d0.x, d0.y); ctx.lineTo(d1.x, d1.y); ctx.lineTo(d2.x, d2.y); ctx.lineTo(d3.x, d3.y); ctx.closePath();
    ctx.fillStyle = '#b5a88e'; ctx.fill();
    ctx.fillStyle = pats.dirt; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(90,78,60,0.55)'; ctx.lineWidth = 1.5;
    for (let v = S0; v <= S1; v += 0.5) { const a = g(uL, v), b = g(uR, v); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    for (let u = uL + 0.5; u < uR; u += 0.5) {
      for (let v = S0 + ((u * 2) % 2 ? 0.25 : 0); v < S1; v += 0.5) {
        const a = g(u, v), b = g(u, Math.min(S1, v + 0.5)); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    // face block lines
    ctx.strokeStyle = 'rgba(40,30,25,0.4)'; ctx.lineWidth = 1.5;
    for (let v = S0; v <= S1; v += 0.5) { const a = g(uR, v); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, a.y + br.drop); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(fA.x, fA.y + br.drop / 2); ctx.lineTo(fB.x, fB.y + br.drop / 2); ctx.stroke();
    // parapets + posts
    const PH = 14, PW = 0.2;
    for (const side of [uL, uR - PW]) {
      const a = g(side, S0), b = g(side + PW, S0), c = g(side + PW, S1), d = g(side, S1);
      ctx.beginPath(); ctx.moveTo(b.x, b.y - PH); ctx.lineTo(c.x, c.y - PH); ctx.lineTo(c.x, c.y); ctx.lineTo(b.x, b.y); ctx.closePath();
      ctx.fillStyle = '#958a76'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(a.x, a.y - PH); ctx.lineTo(b.x, b.y - PH); ctx.lineTo(c.x, c.y - PH); ctx.lineTo(d.x, d.y - PH); ctx.closePath();
      ctx.fillStyle = '#d2c5a8'; ctx.fill();
      for (let v = S0; v <= S1 + 0.01; v += 1.5) {
        const p0 = g(side + PW, v), p1 = g(side + PW, Math.min(S1, v + 0.3));
        ctx.fillStyle = '#7e7464';
        ctx.fillRect(p0.x - 2, p0.y - PH - 10, Math.max(4, p1.x - p0.x + 4), PH + 10);
        ctx.fillStyle = '#d8ccb0'; ctx.fillRect(p0.x - 2, p0.y - PH - 12, Math.max(4, p1.x - p0.x + 4), 3);
      }
    }
  }
  function drawPlatform(ctx, cx, cy, pats, tp) {
    underside(ctx, cx, cy, platRuns, tp.under);
    AR.polyPath(ctx, plat.poly);
    ctx.fillStyle = pats.grass; ctx.fill();
    ctx.fillStyle = 'rgba(40,20,60,0.25)'; ctx.fill();
    const inner = plat.poly.map((p) => ({ x: plat.center.x + (p.x - plat.center.x) * 0.72, y: plat.center.y + (p.y - plat.center.y) * 0.72 }));
    AR.polyPath(ctx, inner);
    ctx.fillStyle = pats.dirt; ctx.fill();
    ctx.fillStyle = 'rgba(60,20,80,0.25)'; ctx.fill();
    ctx.strokeStyle = 'rgba(30,40,20,0.8)'; ctx.lineWidth = 3;
    const fr = frontRuns(plat.poly);
    for (const r of fr) { polyline(ctx, r); ctx.stroke(); }
  }

  // ---------- bake a chunk ----------
  function bakeChunk(cx, cy) {
    const can = AR.makeCanvas(CS, CS), ctx = can.getContext('2d');
    ctx.translate(-cx, -cy);
    const pats = patterns(ctx);
    const tp = patterns(tctx);

    // 1) ใต้เกาะลอยฟ้า
    underside(ctx, cx, cy, undersideRuns, tp.under);

    // 2) ชั้นล่าง (ริมแม่น้ำ)
    ctx.save();
    AR.polyPath(ctx, island.ledgePoly); ctx.clip();
    ctx.fillStyle = pats.grass; ctx.fillRect(cx, cy, CS, CS);
    ctx.fillStyle = 'rgba(15,40,25,0.22)'; ctx.fillRect(cx, cy, CS, CS);
    // river
    const R = island.river;
    band(ctx, R.bankIn, R.bankOut); ctx.fillStyle = pats.dirt; ctx.fill();
    ctx.fillStyle = 'rgba(70,60,40,0.35)'; ctx.fill();
    band(ctx, R.inner, R.outer); ctx.fillStyle = '#1b6896'; ctx.fill();
    band(ctx, lerpPts(R.inner, R.outer, 0.18), lerpPts(R.inner, R.outer, 0.82)); ctx.fillStyle = 'rgba(64,166,220,0.75)'; ctx.fill();
    band(ctx, lerpPts(R.inner, R.outer, 0.38), lerpPts(R.inner, R.outer, 0.62)); ctx.fillStyle = 'rgba(110,200,240,0.45)'; ctx.fill();
    ctx.strokeStyle = 'rgba(230,248,255,0.6)'; ctx.lineWidth = 3;
    polyline(ctx, R.inner); ctx.stroke(); polyline(ctx, R.outer); ctx.stroke();
    // cliff contact shadow
    if ('filter' in ctx) ctx.filter = 'blur(16px)';
    AR.polyPath(ctx, island.upperPoly, H + 30);
    ctx.fillStyle = 'rgba(0,10,0,0.35)'; ctx.fill();
    ctx.filter = 'none';
    ctx.restore();

    // 3) หน้าผา
    for (const r of cliffRuns) {
      stripPath(ctx, r.top, r.depth);
      ctx.fillStyle = pats.cliff; ctx.fill();
      ctx.fillStyle = lightGradient(ctx, r.top, 'rgba(255,245,225,0.16)', 'rgba(10,15,40,0.42)'); ctx.fill();
      for (let k = 2; k < 7; k++) {
        stripPath(ctx, r.top, r.depth, k / 7, 1);
        ctx.fillStyle = 'rgba(10,20,30,0.07)'; ctx.fill();
      }
      // moss lip + drips
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#30561f'; ctx.lineWidth = 9; polyline(ctx, r.top); ctx.stroke();
      ctx.strokeStyle = '#4f8530'; ctx.lineWidth = 4; polyline(ctx, r.top.map((p) => ({ x: p.x, y: p.y - 1 }))); ctx.stroke();
      ctx.lineCap = 'round';
      for (let i = 0; i < r.top.length; i += 2) {
        const p = r.top[i], h = N.hash(i * 7, (p.x | 0)) * 26;
        if (h < 6) continue;
        ctx.strokeStyle = N.hash(i, 3) < 0.5 ? '#30561f' : '#3d6b27'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + h); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }

    // 4) ที่ราบ (ใช้ texture พื้น 3 แบบผสมกันด้วย splat mask)
    const masks = buildMasks(cx, cy);
    ctx.save();
    AR.polyPath(ctx, island.upperPoly); ctx.clip();
    ctx.fillStyle = pats.grass; ctx.fillRect(cx, cy, CS, CS);
    maskedLayer(ctx, cx, cy, tp.grassdirt, masks.mix);
    maskedLayer(ctx, cx, cy, tp.dirt, masks.dirt);
    maskedLayer(ctx, cx, cy, 'rgba(10,40,20,0.42)', masks.rim);
    ctx.restore();

    // 5) สะพาน + Portal
    drawPillars(ctx, 'ledge');
    drawPillars(ctx, 'void');
    drawPlatform(ctx, cx, cy, pats, tp);
    drawDeck(ctx, pats);
    return can;
  }

  // ---------- run ----------
  const chunks = [];
  const list = [];
  for (let cy = y0; cy < y1; cy += CS) for (let cx = x0; cx < x1; cx += CS) list.push({ cx, cy });
  for (let i = 0; i < list.length; i++) {
    const { cx, cy } = list[i];
    chunks.push({ x: cx, y: cy, w: CS, h: CS, canvas: bakeChunk(cx, cy) });
    if (onProgress) onProgress((i + 1) / list.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  return { chunks, bounds: { x0, y0, x1, y1 } };
};
