// =============================================================
//  Procedural pixel-art: ต้นไม้, หิน, ภูเขา, ลายหินหน้าผา
//  (ภาพชั่วคราว — เปลี่ยนเป็นไฟล์ PNG ของจริงได้ภายหลัง โดยแทนที่
//   AR.art.trees / rocks / mountains ด้วย Image ที่โหลดมา)
// =============================================================
window.AR = window.AR || {};

AR.createArt = function (seed) {
  const rng = AR.mulberry32(seed * 13 + 5);
  const PX = 3; // ขนาด "พิกเซล" ของ sprite

  function upscale(src, s) {
    const c = AR.makeCanvas(src.width * s, src.height * s);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  function crispAlpha(c) {
    const x = c.getContext('2d');
    const d = x.getImageData(0, 0, c.width, c.height);
    for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 110 ? 255 : 0;
    x.putImageData(d, 0, 0);
  }
  function withShadow(sprite, baseX, baseY, rx, ry, alpha) {
    const c = AR.makeCanvas(sprite.width + rx, sprite.height + ry);
    const x = c.getContext('2d');
    x.fillStyle = `rgba(10,20,10,${alpha})`;
    x.beginPath();
    x.ellipse(baseX + rx * 0.35, baseY, rx, ry, 0, 0, Math.PI * 2);
    x.fill();
    x.drawImage(sprite, 0, 0);
    return { img: c, ax: baseX, ay: baseY };
  }

  // ---------------- Pine trees ----------------
  const TREE_PALS = [
    ['#132a1b', '#1f4a2c', '#2f6e3a', '#4f9a48', '#8cc65a'], // green
    ['#0d2116', '#173a28', '#24573a', '#3a7a46', '#6aa85a'], // deep
    ['#26330f', '#3e5a22', '#5c7d2a', '#85a33a', '#b8c95a'], // olive
    ['#3f2b09', '#6b4f12', '#a07a1c', '#c9a030', '#e8cf6a'], // gold (เหมือนต้นเหลืองใน Ref)
  ];
  function jaggedTri(x, cx, apexY, hw, baseY, color) {
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(cx, apexY);
    x.lineTo(cx + hw, baseY);
    const n = 5;
    for (let i = 1; i < n; i++) {
      const t = 1 - i / n;
      x.lineTo(cx - hw + t * 2 * hw, baseY - (i % 2 ? 2 : 0) + (rng() < 0.3 ? 1 : 0));
    }
    x.lineTo(cx - hw, baseY);
    x.closePath();
    x.fill();
  }
  function pine(pal) {
    const w = 30, h = 52;
    const c = AR.makeCanvas(w, h), x = c.getContext('2d');
    const cx = w / 2, bottom = h - 7, top = 2;
    x.fillStyle = '#3b2416'; x.fillRect(cx - 1.5, h - 11, 3, 8);
    x.fillStyle = '#6a4428'; x.fillRect(cx - 1.5, h - 11, 1, 8);
    const tiers = 4 + ((rng() * 2) | 0);
    const tierH = (bottom - top) * 0.42;
    const step = (bottom - top - tierH) / (tiers - 1);
    const maxHW = 11.5 + rng() * 2;
    for (let k = 0; k < tiers; k++) {
      const baseY = bottom - k * step, apexY = baseY - tierH;
      const hw = maxHW * (1 - k / (tiers + 0.7));
      jaggedTri(x, cx, apexY, hw, baseY, pal[0]);
      jaggedTri(x, cx, apexY + 1, hw - 1, baseY - 1, pal[1]);
      x.fillStyle = pal[2];
      x.beginPath(); x.moveTo(cx, apexY + 1); x.lineTo(cx - hw + 1.5, baseY - 1.5); x.lineTo(cx + hw * 0.15, baseY - 1.5); x.closePath(); x.fill();
      x.fillStyle = pal[3];
      x.beginPath(); x.moveTo(cx - 0.5, apexY + 2); x.lineTo(cx - hw + 2.5, baseY - 2.5); x.lineTo(cx - hw * 0.3, baseY - 2.5); x.closePath(); x.fill();
      for (let i = 0; i < hw * 3; i++) {
        const py = apexY + 2 + rng() * (tierH - 3);
        const span = ((py - apexY) / tierH) * hw * 0.9;
        const px = cx - span + rng() * span * 2;
        x.fillStyle = px < cx - 1 ? pal[4] : pal[0];
        if (rng() < 0.55) x.fillRect(px | 0, py | 0, 1, 1);
      }
    }
    crispAlpha(c);
    const big = upscale(c, PX);
    return withShadow(big, cx * PX, (h - 4) * PX, 13 * PX, 4 * PX, 0.28);
  }
  const trees = TREE_PALS.map((pal) => {
    const arr = [];
    for (let i = 0; i < 6; i++) arr.push(pine(pal));
    return arr;
  });

  // ---------------- Rocks ----------------
  function rock() {
    const w = 22, h = 16;
    const c = AR.makeCanvas(w, h), x = c.getContext('2d');
    const n = 2 + ((rng() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const rx = 4 + rng() * 4, ry = 3 + rng() * 3;
      const ox = 4 + rx + rng() * (w - 8 - rx * 2), oy = h - 2 - ry;
      x.fillStyle = '#3e424a'; x.beginPath(); x.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#767c86'; x.beginPath(); x.ellipse(ox - 0.7, oy - 0.7, rx - 1, ry - 1, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#a9afb8'; x.beginPath(); x.ellipse(ox - rx * 0.35, oy - ry * 0.4, rx * 0.45, ry * 0.4, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#5f7f3a';
      for (let k = 0; k < 4; k++) x.fillRect((ox - rx + rng() * rx * 2) | 0, (oy - ry + rng() * 2) | 0, 1, 1);
    }
    crispAlpha(c);
    const big = upscale(c, PX);
    return withShadow(big, (w / 2) * PX, (h - 2) * PX, 9 * PX, 2.5 * PX, 0.25);
  }
  const rocks = [rock(), rock(), rock(), rock()];

  // ---------------- Mountains ----------------
  function mpd(a, b, rough, depth) {
    if (depth === 0) return [a];
    const m = { x: (a.x + b.x) / 2 + (rng() - 0.5) * rough, y: (a.y + b.y) / 2 + (rng() - 0.5) * rough * 0.7 };
    return mpd(a, m, rough * 0.55, depth - 1).concat(mpd(m, b, rough * 0.55, depth - 1));
  }
  function mountain() {
    const w = 230, h = 130;
    const c = AR.makeCanvas(w, h), x = c.getContext('2d');
    const peaks = [];
    const main = { ax: w / 2 + (rng() - 0.5) * 16, ay: 6 + rng() * 10, bw: 84 };
    peaks.push({ ax: main.ax - 42 - rng() * 12, ay: 40 + rng() * 15, bw: 52 });
    peaks.push({ ax: main.ax + 42 + rng() * 12, ay: 38 + rng() * 15, bw: 52 });
    peaks.push(main);
    const baseY = h - 4;
    for (const pk of peaks) {
      const apex = { x: pk.ax, y: pk.ay };
      const L = { x: Math.max(2, pk.ax - pk.bw), y: baseY }, R = { x: Math.min(w - 2, pk.ax + pk.bw), y: baseY };
      const left = mpd(apex, L, 14, 4).concat([L]);
      const right = mpd(R, apex, 14, 4);
      const ridge = mpd(apex, { x: pk.ax + 4, y: baseY }, 10, 4).concat([{ x: pk.ax + 4, y: baseY }]);
      // whole (shadow side)
      x.fillStyle = '#4a5466';
      x.beginPath(); left.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)));
      right.forEach((p) => x.lineTo(p.x, p.y)); x.closePath(); x.fill();
      // lit side
      x.fillStyle = '#8a95a6';
      x.beginPath(); left.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)));
      for (let i = ridge.length - 1; i >= 0; i--) x.lineTo(ridge[i].x, ridge[i].y);
      x.closePath(); x.fill();
      // strata
      x.save();
      x.beginPath(); left.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)));
      right.forEach((p) => x.lineTo(p.x, p.y)); x.closePath(); x.clip();
      for (let i = 0; i < 26; i++) {
        const sx = pk.ax - pk.bw + rng() * pk.bw * 2, sy = pk.ay + 10 + rng() * (baseY - pk.ay);
        x.fillStyle = sx < pk.ax ? '#6f7a8c' : '#3a4354';
        x.fillRect(sx | 0, sy | 0, 4 + ((rng() * 6) | 0), 1);
        x.fillRect((sx + 2) | 0, (sy + 1) | 0, 2, 1);
      }
      // snow cap
      const snowH = (baseY - pk.ay) * (0.28 + rng() * 0.1);
      x.beginPath();
      x.moveTo(pk.ax - pk.bw, pk.ay - 5);
      x.lineTo(pk.ax + pk.bw, pk.ay - 5);
      for (let sx = pk.ax + pk.bw; sx >= pk.ax - pk.bw; sx -= 3) {
        x.lineTo(sx, pk.ay + snowH * (0.6 + 0.4 * Math.cos((sx - pk.ax) / pk.bw * 1.4)) + (rng() - 0.5) * 8);
      }
      x.closePath();
      x.fillStyle = '#eef4fb'; x.fill();
      x.fillStyle = 'rgba(120,140,175,0.55)';
      x.beginPath(); x.moveTo(pk.ax, pk.ay);
      ridge.forEach((p) => x.lineTo(p.x, p.y)); x.lineTo(pk.ax + pk.bw, baseY); x.lineTo(pk.ax + pk.bw, pk.ay); x.closePath(); x.fill();
      x.restore();
    }
    // forest fringe along the base
    for (let i = 0; i < 70; i++) {
      const tx = 6 + rng() * (w - 12), ty = baseY - rng() * 14 + 2, th = 6 + rng() * 6;
      x.fillStyle = rng() < 0.2 ? '#7a6a1c' : rng() < 0.5 ? '#1f4a2c' : '#2b5f36';
      x.beginPath(); x.moveTo(tx, ty - th); x.lineTo(tx - 3, ty); x.lineTo(tx + 3, ty); x.closePath(); x.fill();
    }
    crispAlpha(c);
    const big = upscale(c, PX);
    return { img: big, ax: (w / 2) * PX, ay: (h - 8) * PX };
  }
  const mountains = [];
  for (let i = 0; i < 5; i++) mountains.push(mountain());

  // ---------------- Cliff rock textures (tileable) ----------------
  function rockTex(pal, size) {
    size = size || 128;
    const c = AR.makeCanvas(size, size), x = c.getContext('2d');
    let px = 0;
    while (px < size) {
      let cw = 7 + ((rng() * 10) | 0);
      if (size - px < 12) cw = size - px;
      x.fillStyle = pal.mids[(rng() * pal.mids.length) | 0];
      x.fillRect(px, 0, cw, size);
      x.fillStyle = pal.light; x.fillRect(px, 0, 1, size);
      x.fillStyle = pal.dark; x.fillRect(px + cw - 2, 0, 2, size);
      const nc = 2 + ((rng() * 4) | 0);
      for (let i = 0; i < nc; i++) {
        const y = (rng() * size) | 0;
        x.fillStyle = pal.crack; x.fillRect(px, y, cw - 1, 1);
        x.fillStyle = pal.light; x.fillRect(px + 1, (y + 1) % size, cw - 3, 1);
      }
      for (let i = 0; i < cw * size * 0.05; i++) {
        x.fillStyle = rng() < 0.5 ? pal.light : pal.dark;
        x.fillRect(px + ((rng() * cw) | 0), (rng() * size) | 0, 1, 1);
      }
      px += cw;
    }
    return upscale(c, 2);
  }
  const cliffTex = rockTex({ mids: ['#868c95', '#7d838c', '#90969e', '#777d86'], light: '#b9bec5', dark: '#565c65', crack: '#3b4048' });
  const undersideTex = rockTex({ mids: ['#5b4c42', '#54463d', '#625247', '#4d4038'], light: '#7d6a5a', dark: '#3a2f29', crack: '#241c18' });

  return { trees, rocks, mountains, cliffTex, undersideTex };
};
