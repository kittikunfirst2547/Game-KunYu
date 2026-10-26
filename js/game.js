// =============================================================
//  Phaser 3 scenes
//   - BgScene     : ฉากหลังหุบเหว (gradient + ดาว) ไม่ขยับตามกล้อง
//   - IslandScene : เกาะ, sprite เรียงตามความลึก, overlay, กล้อง, input
//  พื้นเกาะยัง bake ด้วย js/terrain.js แล้วส่งเข้ามาเป็น texture
// =============================================================
window.AR = window.AR || {};

const WALL_DY = 0;   // ปรับขึ้น/ลงของกำแพงทั้งแนว (px)
const GATE_DY = 0;   // ปรับขึ้น/ลงของซุ้มประตู (px)
const hex = (c) => Phaser.Display.Color.HexStringToColor(c).color;

// ---------------------------------------------------------------
AR.BgScene = class extends Phaser.Scene {
  constructor() { super({ key: 'Bg', active: true }); }
  create() {
    const r = AR.mulberry32(7);
    this.stars = [];
    for (let i = 0; i < 160; i++) this.stars.push({ x: r(), y: r(), s: r() * 1.6 + 0.4, tw: r() * 6 });
    this.bgKey = 'bg-canvas';
    this.bg = null;
    this.g = this.add.graphics();
    this.rebuild();
    this.scale.on('resize', () => this.rebuild());
  }
  rebuild() {
    const W = this.scale.width, H = this.scale.height;
    if (this.textures.exists(this.bgKey)) this.textures.remove(this.bgKey);
    const c = AR.makeCanvas(W, H), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#07081a'); g.addColorStop(0.55, '#120c2a'); g.addColorStop(1, '#22103a');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const rg = x.createRadialGradient(W / 2, H * 1.05, 10, W / 2, H * 1.05, Math.max(W, H) * 0.8);
    rg.addColorStop(0, 'rgba(150,60,220,0.45)'); rg.addColorStop(0.35, 'rgba(90,30,150,0.18)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = rg; x.fillRect(0, 0, W, H);
    this.textures.addCanvas(this.bgKey, c);
    if (this.bg) this.bg.destroy();
    this.bg = this.add.image(0, 0, this.bgKey).setOrigin(0).setDepth(-1);
  }
  update(time) {
    const W = this.scale.width, H = this.scale.height, T = time / 1000;
    const isl = this.scene.get('Island');
    const cx = isl && isl.camState ? isl.camState.x : 0, cy = isl && isl.camState ? isl.camState.y : 0;
    const k = AR.dpr;
    this.g.clear();
    for (const s of this.stars) {
      const px = ((s.x * W * 1.3 - cx * 0.03 * k) % W + W) % W, py = ((s.y * H * 1.3 - cy * 0.03 * k) % H + H) % H;
      this.g.fillStyle(0xdcd2ff, 0.35 + 0.35 * Math.sin(T * 1.5 + s.tw));
      this.g.fillRect(px, py, s.s * k, s.s * k);
    }
  }
};

// ---------------------------------------------------------------
AR.IslandScene = class extends Phaser.Scene {
  constructor(data) {
    super({ key: 'Island', active: true });
    this.island = data.island;
    this.terrain = data.terrain;
    this.art = data.art;
    this.hud = data.hud;
    this.city = data.city;
    this.bArt = data.bArt;
    this.cfg = data.island.cfg;
  }

  // ---------------- lifecycle ----------------
  create() {
    this.camState = { x: 0, y: 0, zoom: 0.4 };
    this.show = { grid: false, zones: false, path: true, boss: true };
    this.hover = null;
    this.selected = null;
    this.T = 0;
    this.rng = AR.mulberry32(99);
    this.texKeys = new Map();

    this.addTerrain();
    this.addDecos();
    this.addFx();
    this.addOverlays();
    this.addLabels();
    this.addBuildings();

    this.onResize();
    this.fitView();
    this.focusGate();
    this.bindInput();
    this.scale.on('resize', () => this.onResize());
    this.hud.ready(this);
  }

  // ทำ canvas → texture (ใช้ซ้ำถ้าเคยเพิ่มแล้ว)
  canvasKey(canvas, prefix) {
    if (this.texKeys.has(canvas)) return this.texKeys.get(canvas);
    const key = `${prefix}-${this.texKeys.size}`;
    this.textures.addCanvas(key, canvas);
    this.texKeys.set(canvas, key);
    return key;
  }

  addTerrain() {
    for (const c of this.terrain.chunks) {
      this.add.image(c.x, c.y, this.canvasKey(c.canvas, 'chunk')).setOrigin(0).setDepth(-10000);
    }
  }

  addDecos() {
    const art = this.art;
    this.cellImgs = {};
    for (const d of this.island.decos) {
      let spr;
      if (d.type === 'tree') { const set = art.trees[d.variant]; spr = set[d.pick % set.length]; }
      else if (d.type === 'rock') spr = art.rocks[d.variant % art.rocks.length];
      else spr = art.mountains[d.variant % art.mountains.length];
      const key = this.canvasKey(spr.img, d.type);
      const img = this.add.image(d.x, d.y, key)
        .setOrigin(spr.ax / spr.img.width, spr.ay / spr.img.height)
        .setScale(d.scale || 1)
        .setDepth(d.y);
      if (d.type !== 'mountain' && !d.level) {
        const g = AR.iso.toGrid(d.x, d.y);
        const c = this.island.cellAt(Math.floor(g.gx), Math.floor(g.gy));
        if (c && c.inside) {
          const idx = c.y * this.cfg.gridSize + c.x;
          if (this.city.state.cleared.includes(idx)) { img.destroy(); continue; }
          (this.cellImgs[idx] = this.cellImgs[idx] || []).push(img);
        }
      }
    }
  }

  // Rift Portal จากภาพ: แสงเรือง → วงวนหมุน (อยู่หลังซุ้ม มองเห็นผ่านช่องประตู) → ซุ้มหิน
  addPortal(pc) {
    const P = AR.PORTAL_ART, S = this.cfg.portal.scale || 1, im = this.bArt.portal;
    const toCanvas = (img) => { const c = AR.makeCanvas(img.width, img.height); c.getContext('2d').drawImage(img, 0, 0); return c; };
    const archKey = this.canvasKey(toCanvas(im.arch), 'portal');
    const vortKey = this.canvasKey(toCanvas(im.vortex), 'portal');
    const ox = pc.x - P.base.x * S, oy = pc.y - P.base.y * S;   // มุมซ้ายบนของภาพซุ้มในโลก
    const hx = ox + P.hole.x * S, hy = oy + P.hole.y * S;
    // แสงเรือง
    const g = AR.makeCanvas(256, 256), gx = g.getContext('2d');
    const rg = gx.createRadialGradient(128, 128, 4, 128, 128, 128);
    rg.addColorStop(0, 'rgba(190,110,255,0.9)'); rg.addColorStop(0.45, 'rgba(130,60,230,0.35)'); rg.addColorStop(1, 'rgba(80,20,160,0)');
    gx.fillStyle = rg; gx.fillRect(0, 0, 256, 256);
    this.portalGlow = this.add.image(hx, hy, this.canvasKey(g, 'portal')).setDisplaySize(620 * S, 620 * S)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(pc.y - 3);
    // วงวน: container บีบเป็นวงรีตามช่องประตู แล้วหมุนภาพข้างใน → หมุนอยู่ในกรอบเดิม
    const vw = this.textures.get(vortKey).getSourceImage().width, vh = this.textures.get(vortKey).getSourceImage().height;
    const box = this.add.container(hx, hy).setDepth(pc.y - 2)
      .setScale((P.hole.w * S) / vw, (P.hole.h * S) / vh).setRotation(P.hole.tilt);
    const v1 = this.add.image(0, 0, vortKey);
    const v2 = this.add.image(0, 0, vortKey).setScale(0.72).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
    box.add([v1, v2]);
    this.portalVortex = { v1, v2, box };
    // ซุ้มหิน
    this.portalArch = this.add.image(ox, oy, archKey).setOrigin(0).setScale(S).setDepth(pc.y);
  }

  // เอฟเฟกต์เคลื่อนไหว: น้ำตก, Portal (วาดลง CanvasTexture ทุกเฟรม)
  addFx() {
    const r = this.rng, b = this.terrain.bounds, isl = this.island;
    this.dyn = [];
    const mkDyn = (key, x0, y0, w, h, depth, draw) => {
      const tex = this.textures.createCanvas(key, Math.ceil(w), Math.ceil(h));
      const img = this.add.image(x0, y0, key).setOrigin(0).setDepth(depth);
      this.dyn.push({ tex, ctx: tex.getContext(), x0, y0, w, h, draw, img });
    };
    isl.waterfalls.forEach((w, i) => {
      const extra = w.kind === 'void' ? 200 : 40;
      mkDyn(`fall-${i}`, w.x - 180, w.y - 30, 360, w.length + extra + 30, w.y + (w.kind === 'cliff' ? 0 : 5), (ctx, T) => this.drawFall(ctx, w, T));
    });
    const pc = isl.platform.center;
    if (this.bArt.portal) this.addPortal(isl.platform.arch);
    else mkDyn('portal', pc.x - 250, pc.y - 400, 500, 440, pc.y + 1, (ctx, T) => this.drawPortal(ctx, T));

    // clouds
    const c = AR.makeCanvas(256, 128), x = c.getContext('2d');
    const g = x.createRadialGradient(128, 64, 4, 128, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.save(); x.scale(2, 1); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 64, 0, Math.PI * 2); x.fill(); x.restore();
    const ck = this.canvasKey(c, 'cloud');
    this.clouds = [];
    const cy = isl.center.y + isl.H;
    for (let i = 0; i < 26; i++) {
      const front = r() < 0.5, w = 700 + r() * 900;
      const img = this.add.image(0, cy + 350 + r() * 650, ck).setDisplaySize(w, w / 2)
        .setAlpha((0.05 + r() * 0.09) * (front ? 0.45 : 1)).setDepth(front ? 1e6 : -20000);
      this.clouds.push({ img, x: AR.lerp(b.x0 - 400, b.x1 + 400, r()), v: 6 + r() * 12 });
    }
    // motes + river glints
    this.motes = [];
    for (let i = 0; i < 90; i++) this.motes.push({ x: AR.lerp(b.x0 - 600, b.x1 + 600, r()), y: AR.lerp(b.y0, b.y1 + 600, r()), v: 10 + r() * 30, s: 2 + r() * 4, col: r() < 0.6 ? 0xc49bff : 0x8ce8ff, ph: r() * 6 });
    this.moteG = this.add.graphics().setDepth(-15000);
    this.glints = [];
    const cl = isl.river.center;
    for (let i = 0; i < 70; i++) this.glints.push({ i: r() * (cl.length - 2), sp: 1.5 + r() * 2, off: (r() - 0.5) * 30 });
    this.glintG = this.add.graphics().setDepth(-9000);
  }

  addOverlays() {
    const isl = this.island, iso = AR.iso;
    this.diamondPts = (gx, gy, inset) => {
      const i = inset || 0;
      return [iso.toWorld(gx + i, gy + i), iso.toWorld(gx + 1 - i, gy + i), iso.toWorld(gx + 1 - i, gy + 1 - i), iso.toWorld(gx + i, gy + 1 - i)];
    };
    // zones (static)
    this.zoneG = this.add.graphics().setDepth(-8000).setVisible(false);
    const th = isl.townHall;
    this.thPts = [iso.toWorld(th.x, th.y), iso.toWorld(th.x + th.w, th.y), iso.toWorld(th.x + th.w, th.y + th.h), iso.toWorld(th.x, th.y + th.h)];
    this.drawZoneLayer();
    this.lockG = this.add.graphics().setDepth(-7998);   // โซนที่ยังล็อก + ช่องที่วางได้ (ตอนสร้าง)
    this.ghostG = this.add.graphics().setDepth(-7960);
    this.selG = this.add.graphics().setDepth(-7965);
    this.thCenter = iso.toWorld(th.x + th.w / 2, th.y + th.h / 2);
    // dynamic overlays
    this.thG = this.add.graphics().setDepth(-7995);
    this.gridG = this.add.graphics().setDepth(-7990);
    this.pathG = this.add.graphics().setDepth(-7980);
    this.hoverG = this.add.graphics().setDepth(-7970);
    this.gridZoom = 0;
    const br = isl.bridge, C = isl.C;
    this.bossPath = [
      isl.platform.arch,
      isl.platform.exit,
      br.toWorld(br.u, br.vEnd),
      br.toWorld(br.u, br.vEdge),
      br.toWorld(br.u, this.cfg.layout.wallRadius + 1.2),
    ];
  }

  drawZoneLayer() {
    const g = this.zoneG.clear();
    for (const c of this.island.cells) {
      if (!c.inside) continue;
      g.fillStyle(hex(this.cfg.zones[c.zone].color), 0.26).fillPoints(this.diamondPts(c.x, c.y), true);
    }
    g.fillStyle(0x140a0a, 0.35);
    for (const c of this.island.cells) if (c.inside && c.blocked) g.fillPoints(this.diamondPts(c.x, c.y, 0.15), true);
  }

  addLabels() {
    const isl = this.island, iso = AR.iso;
    const zc = {};
    for (const k of isl.zoneKeys) zc[k] = { x: 0, y: 0, n: 0 };
    for (const c of isl.cells) {
      if (!c.inside) continue;
      const p = iso.toWorld(c.x + 0.5, c.y + 0.5);
      zc[c.zone].x += p.x; zc[c.zone].y += p.y; zc[c.zone].n++;
    }
    const fixed = {
      wall: iso.toWorld(isl.C + this.cfg.layout.wallRadius, isl.C - this.cfg.layout.wallRadius * 0.45),
      city: iso.toWorld(isl.C - this.cfg.layout.wallRadius * 0.7, isl.C + 0.5),
      core: iso.toWorld(isl.C + this.cfg.layout.coreRadius * 0.7, isl.C + this.cfg.layout.coreRadius * 0.7),
    };
    const style = (col) => ({
      fontFamily: 'Kanit, Tahoma, sans-serif', fontSize: '13px', fontStyle: '600', color: '#ffffff',
      backgroundColor: 'rgba(12,10,24,0.82)', padding: { x: 9, y: 4 }, stroke: col, strokeThickness: 0,
    });
    this.labels = [];
    for (const k of isl.zoneKeys) {
      if (!zc[k].n) continue;
      const z = this.cfg.zones[k];
      const p = fixed[k] || { x: zc[k].x / zc[k].n, y: zc[k].y / zc[k].n };
      const t = this.add.text(p.x, p.y, z.name + (z.unlockTH > 1 ? `  · TH ${z.unlockTH}` : ''), style(z.color))
        .setOrigin(0.5).setDepth(2e6).setVisible(false).setResolution(AR.dpr * 2);
      this.labels.push(t);
    }
    this.thLabel = this.add.text(this.thCenter.x, this.thCenter.y, "Lord's Castle 8×8", {
      fontFamily: 'Kanit, Tahoma, sans-serif', fontSize: '15px', fontStyle: '600', color: '#ffd166', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2e6 - 1).setVisible(false).setResolution(AR.dpr * 2);
  }

  // ---------------- camera ----------------
  get W() { return this.scale.width / AR.dpr; }
  get H() { return this.scale.height / AR.dpr; }
  onResize() {
    const b = this.terrain.bounds;
    this.minZoom = Math.min(this.W / (b.x1 - b.x0), this.H / (b.y1 - b.y0 + 500)) * 0.9;
    this.camState.zoom = Math.max(this.camState.zoom, this.minZoom);
    this.cameras.main.setSize(this.scale.width, this.scale.height);
  }
  applyCam() {
    const cam = this.cameras.main, s = this.camState;
    cam.setZoom(s.zoom * AR.dpr);
    cam.centerOn(s.x, s.y);
  }
  fitView() {
    const b = this.terrain.bounds;
    this.camState.x = this.island.center.x;
    this.camState.y = (b.y0 + b.y1) / 2 - 250;
    this.camState.zoom = Math.max(this.minZoom, Math.min(this.W / (b.x1 - b.x0 + 200), this.H / (b.y1 - b.y0 + 300)));
  }
  // มุมกล้องเริ่มต้นแบบภาพตัวอย่าง: เมืองหลังกำแพงซ้ายบน · สนามรบ+สะพานขวาล่าง
  focusGate() {
    const br = this.island.bridge, L = this.cfg.layout;
    const p = br.toWorld(br.u - 2, L.wallRadius + 2.5);
    Object.assign(this.camState, { x: p.x - 120, y: p.y - 80, zoom: Math.max(this.minZoom, 0.5) });
  }
  moveTo(x, y) { this.camState.x = x; this.camState.y = y; this.clampCam(); }
  focusBuilding(id) {
    const b = this.city.byId(id); if (!b) return;
    const s = AR.BUILDINGS[b.type].size, p = AR.iso.toWorld(b.x + s / 2, b.y + s / 2);
    Object.assign(this.camState, { x: p.x, y: p.y - 40, zoom: Math.max(this.camState.zoom, 0.7) });
    this.clampCam();
    this.selectBuilding(id);
  }
  focusTown() {
    Object.assign(this.camState, { x: this.island.center.x, y: this.island.center.y + 60, zoom: 0.75 });
  }
  clampCam() {
    const b = this.terrain.bounds, s = this.camState;
    s.zoom = AR.clamp(s.zoom, this.minZoom, 2);
    s.x = AR.clamp(s.x, b.x0, b.x1);
    s.y = AR.clamp(s.y, b.y0 - 400, b.y1);
  }
  screenToWorld(sx, sy) { // sx, sy = CSS pixels
    const s = this.camState;
    return { x: (sx - this.W / 2) / s.zoom + s.x, y: (sy - this.H / 2) / s.zoom + s.y };
  }
  zoomAt(sx, sy, z) {
    const before = this.screenToWorld(sx, sy);
    this.camState.zoom = AR.clamp(z, this.minZoom, 2);
    const after = this.screenToWorld(sx, sy);
    this.camState.x += before.x - after.x; this.camState.y += before.y - after.y;
    this.clampCam();
  }

  // ---------------- input ----------------
  bindInput() {
    this.input.addPointer(2);
    const css = (p) => ({ x: p.x / AR.dpr, y: p.y / AR.dpr });
    let drag = null, pinch = null, moved = 0;
    this.input.on('pointerdown', (p) => {
      if (p.rightButtonDown()) {
        if (this.mode !== 'view') this.exitBuild();
        else this.deselect();
        drag = null; return;
      }
      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        pinch = { d: Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y), z: this.camState.zoom };
        drag = null; moved = 99;
        return;
      }
      const c = css(p);
      drag = { x: c.x, y: c.y, cx: this.camState.x, cy: this.camState.y, touch: p.event && p.event.pointerType === 'touch' };
      this.updateHover(c.x, c.y);
      moved = 0;
    });
    this.input.on('pointermove', (p) => {
      const c = css(p);
      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (pinch && p1.isDown && p2.isDown) {
        const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        this.zoomAt((p1.x + p2.x) / 2 / AR.dpr, (p1.y + p2.y) / 2 / AR.dpr, (pinch.z * d) / pinch.d);
      } else if (drag && p.isDown) {
        const dx = c.x - drag.x, dy = c.y - drag.y;
        moved = Math.max(moved, Math.hypot(dx, dy));
        this.camState.x = drag.cx - dx / this.camState.zoom;
        this.camState.y = drag.cy - dy / this.camState.zoom;
        this.clampCam();
        this.game.canvas.style.cursor = moved > 4 ? 'grabbing' : '';
      }
      this.updateHover(c.x, c.y);
    });
    this.input.on('pointerup', () => {
      if (!this.input.pointer1.isDown || !this.input.pointer2.isDown) pinch = null;
      if (drag && moved < 5) this.onTap(drag.touch);
      drag = null;
      this.game.canvas.style.cursor = '';
    });
    this.input.on('gameout', () => { this.hover = null; if (!this.selected && !this.selectedB) this.hud.showCell(null); });
    this.input.on('wheel', (p, objs, dx, dy) => {
      const c = css(p);
      this.zoomAt(c.x, c.y, this.camState.zoom * Math.pow(1.0015, -dy));
    });
    const kb = this.input.keyboard;
    this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT', false);
    kb.on('keydown-G', () => this.toggle('grid'));
    kb.on('keydown-Z', () => this.toggle('zones'));
    kb.on('keydown-B', () => this.hud.toggleDrawer());
    kb.on('keydown-ESC', () => { if (this.mode !== 'view') this.exitBuild(); else this.deselect(); });
    ['Q', 'W', 'E', 'R'].forEach((key, i) => kb.on('keydown-' + key, () => this.hud.skill(i)));
    kb.on('keydown', (e) => {
      if (e.key === '+' || e.key === '=') this.zoomAt(this.W / 2, this.H / 2, this.camState.zoom * 1.2);
      if (e.key === '-') this.zoomAt(this.W / 2, this.H / 2, this.camState.zoom / 1.2);
    });
  }
  toggle(k, v) {
    this.show[k] = v === undefined ? !this.show[k] : v;
    this.hud.syncToggles(this.show);
  }
  updateHover(sx, sy) {
    const w = this.screenToWorld(sx, sy);
    const g = AR.iso.toGrid(w.x, w.y);
    const gx = Math.floor(g.gx), gy = Math.floor(g.gy);
    const c = this.island.cellAt(gx, gy);
    this.pointerCell = { gx, gy };
    this.hover = c && c.inside ? { gx, gy } : null;
    if (this.mode !== 'view') return;
    if (!this.selected && !this.selectedB) {
      const b = this.hover && this.city.buildingAt(gx, gy);
      if (b) this.hud.showBuilding(this.buildingInfo(b.id), false);
      else this.hud.showCell(this.hover ? this.cellInfo(gx, gy) : null);
    }
  }
  cellInfo(gx, gy) {
    const c = this.island.cellAt(gx, gy);
    if (!c) return null;
    const z = this.cfg.zones[c.zone];
    const th = this.island.townHall;
    const inTH = gx >= th.x && gx < th.x + th.w && gy >= th.y && gy < th.y + th.h;
    let status, ok = false;
    if (inTH) status = 'สงวนไว้สำหรับ Town Hall';
    else if (c.blocked) status = c.deco === 'tree' ? 'มีต้นไม้ — ต้องเคลียร์ก่อน' : 'มีหิน — ต้องเคลียร์ก่อน';
    else if (c.road) status = 'ถนน — สร้างไม่ได้';
    else if (z.only === 'wall') { status = c.gate ? 'ประตูเมือง' : 'วางกำแพง/ป้อมได้'; ok = !c.gate; }
    else if (z.only === 'defense') { status = 'วางสิ่งป้องกันได้เท่านั้น'; ok = true; }
    else { status = 'สร้างได้'; ok = true; }
    const tname = { grass: 'หญ้า', grassdirt: 'หญ้าปนดิน', dirt: 'ดิน' }[c.terrain];
    const locked = !this.city.zoneUnlocked(c.zone);
    if (locked && ok) { status = `ยังล็อก — ต้องใช้ Town Hall Lv.${z.unlockTH}`; ok = false; }
    const clear = c.blocked && !locked ? this.city.clearCost() : null;
    return { gx, gy, zone: z.name, color: z.color, unlockTH: z.unlockTH, terrain: tname, status, ok, clear, locked };
  }
  exportJSON() {
    const isl = this.island;
    const data = {
      version: 1, seed: this.cfg.seed, gridSize: this.cfg.gridSize, tile: [this.cfg.tileW, this.cfg.tileH],
      townHall: isl.townHall, zones: this.cfg.zones,
      city: { th: this.city.th, resources: this.city.state.res, buildings: this.city.state.buildings.map((b) => ({ type: b.type, x: b.x, y: b.y, level: b.level })) },
      cells: isl.cells.filter((c) => c.inside).map((c) => ({ x: c.x, y: c.y, zone: c.zone, terrain: c.terrain, blocked: c.blocked ? c.deco : null, road: c.road || undefined, gate: c.gate || undefined })),
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'island_01.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------------- update ----------------
  update(time, delta) {
    const dt = Math.min(0.05, delta / 1000);
    this.T += dt;
    const T = this.T, k = this.keys, s = this.camState, sp = (900 * dt) / s.zoom;
    if (k.LEFT.isDown) s.x -= sp;
    if (k.RIGHT.isDown) s.x += sp;
    if (k.UP.isDown) s.y -= sp;
    if (k.DOWN.isDown) s.y += sp;
    this.clampCam();
    this.applyCam();
    this.city.tick(dt);
    this.updateBuildings(T);
    this.hudTimer = (this.hudTimer || 0) + dt;
    if (this.hudTimer > 0.25) { this.hudTimer = 0; this.hud.tick(this); }

    const cam = this.cameras.main.worldView;
    const vis = (x, y, w, h) => x < cam.right && x + w > cam.left && y < cam.bottom && y + h > cam.top;

    // animated canvases (เฉพาะที่อยู่ในจอ)
    // หมุนวงวน Portal อัตโนมัติ + แสงเต้นเป็นจังหวะ
    if (this.portalVortex) {
      const sp = this.cfg.portal.spin || 0.7;
      this.portalVortex.v1.rotation += sp * dt;
      this.portalVortex.v2.rotation -= sp * 1.6 * dt;
      this.portalVortex.v2.setAlpha(0.4 + 0.2 * Math.sin(T * 2.4));
      this.portalGlow.setAlpha(0.65 + 0.3 * Math.sin(T * 1.8));
    }
    for (const d of this.dyn) {
      const on = vis(d.x0, d.y0, d.w, d.h);
      d.img.setVisible(on);
      if (!on) continue;
      d.ctx.setTransform(1, 0, 0, 1, 0, 0);
      d.ctx.clearRect(0, 0, d.w, d.h);
      d.ctx.setTransform(1, 0, 0, 1, -d.x0, -d.y0);
      d.draw(d.ctx, T);
      d.tex.refresh();
    }
    // clouds
    const b = this.terrain.bounds, span = b.x1 - b.x0 + 1600;
    for (const c of this.clouds) c.img.x = ((c.x - b.x0 + 800 + T * c.v) % span + span) % span + b.x0 - 800;
    // motes
    const mh = b.y1 - b.y0 + 600;
    this.moteG.clear();
    for (const m of this.motes) {
      const y = ((m.y - T * m.v - b.y0) % mh + mh) % mh + b.y0;
      this.moteG.fillStyle(m.col, 0.6 * (0.4 + 0.4 * Math.sin(T * 2 + m.ph)));
      this.moteG.fillRect(m.x + Math.sin(T * 0.6 + m.ph) * 30, y, m.s, m.s);
    }
    // river glints
    const cl = this.island.river.center;
    this.glintG.clear();
    for (const g of this.glints) {
      const f = (g.i + T * g.sp) % (cl.length - 1);
      const i = Math.floor(f), t = f - i, a = cl[i], c2 = cl[i + 1];
      this.glintG.fillStyle(0xebfaff, 0.3 + 0.5 * Math.abs(Math.sin(T * 3 + g.i)));
      this.glintG.fillRect(a.x + (c2.x - a.x) * t + g.off * 0.6 - 7, a.y + (c2.y - a.y) * t + g.off * 0.3, 14, 2.5);
    }
    this.drawOverlays(T);
    this.drawShield(T);
  }

  // โดมพลังงานคลุมเมืองตอนเปิด City Protection
  drawShield(T) {
    if (!this.shieldG) this.shieldG = this.add.graphics().setDepth(1.2e6).setBlendMode(Phaser.BlendModes.ADD);
    const g = this.shieldG.clear(), p = this.city.protState();
    this.shieldA = AR.lerp(this.shieldA || 0, p.on ? 1 : 0, 0.06);
    if (this.shieldA < 0.01) return;
    const C = this.island.C, R = this.cfg.layout.wallRadius + 1.2, a = this.shieldA;
    const c = AR.iso.toWorld(C, C), rx = R * AR.iso.hw * 2.6, ry = R * AR.iso.hh * 2.6; // fillEllipse ใช้ความกว้างเต็ม
    const pulse = 0.5 + 0.5 * Math.sin(T * 1.6);
    for (let i = 0; i < 6; i++) {
      const k = 1 - i * 0.07;
      g.fillStyle(0x5fb8ff, (0.07 + 0.03 * pulse) * a).fillEllipse(c.x, c.y - i * 40 * a, rx * k * 1.42, ry * k * 1.42);
    }
    g.lineStyle(14, 0x9fd8ff, (0.55 + 0.3 * pulse) * a).strokeEllipse(c.x, c.y, rx * 1.42, ry * 1.42);
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2 + T * 0.15;
      const x = c.x + Math.cos(ang) * rx * 0.71, y = c.y + Math.sin(ang) * ry * 0.71;
      g.fillStyle(0xcfeeff, 0.5 * a * (0.5 + 0.5 * Math.sin(T * 3 + i))).fillCircle(x, y - 20 - 30 * Math.sin(T * 2 + i), 14);
    }
  }

  drawOverlays(T) {
    const z = this.camState.zoom;
    // zones + TH + labels
    this.zoneG.setVisible(this.show.zones);
    this.thG.clear();
    if (this.show.zones) {
      this.thG.lineStyle(4 / Math.max(z, 0.3), 0xffd166, 1);
      for (let i = 0; i < 4; i++) this.dashed(this.thG, this.thPts[i], this.thPts[(i + 1) % 4], 16, 10, 0);
    }
    for (const l of this.labels) l.setVisible(this.show.zones).setScale(1 / z);
    this.thLabel.setVisible(this.show.zones).setScale(1 / z);
    // grid: วาดใหม่เมื่อซูมเปลี่ยน (ให้เส้นหนาเท่าเดิมบนจอ)
    const gridOn = this.show.grid || this.mode !== 'view';
    if (gridOn && Math.abs(this.gridZoom - z) > 0.001) {
      this.gridZoom = z;
      this.gridG.clear().lineStyle(1.4 / z, 0xffffff, 0.28);
      for (const c of this.island.cells) if (c.inside) this.gridG.strokePoints(this.diamondPts(c.x, c.y), true);
    }
    this.gridG.setVisible(gridOn);
    // boss path (dashed, animated)
    this.pathG.clear();
    if (this.show.path) {
      this.pathG.lineStyle(10, 0xff4664, 0.85);
      let off = ((-T * 60) % 48 + 48) % 48;
      for (let i = 0; i < this.bossPath.length - 1; i++) off = this.dashed(this.pathG, this.bossPath[i], this.bossPath[i + 1], 26, 22, off);
      const a = this.bossPath[this.bossPath.length - 2], b = this.bossPath[this.bossPath.length - 1];
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      this.pathG.fillStyle(0xff4664, 0.95).fillTriangle(
        b.x + Math.cos(ang) * 30, b.y + Math.sin(ang) * 30,
        b.x + Math.cos(ang + 2.4) * 34, b.y + Math.sin(ang + 2.4) * 34,
        b.x + Math.cos(ang - 2.4) * 34, b.y + Math.sin(ang - 2.4) * 34);
    }
    // hover / selected
    this.hoverG.clear();
    const cell = this.mode === 'view' && !this.selectedB ? (this.selected || this.hover) : null;
    if (cell) {
      const info = this.cellInfo(cell.gx, cell.gy);
      const ok = info && info.ok, pts = this.diamondPts(cell.gx, cell.gy);
      this.hoverG.fillStyle(ok ? 0x50ff8c : 0xff505a, 0.35).fillPoints(pts, true);
      this.hoverG.lineStyle(3 / Math.max(z, 0.4), ok ? 0x7dffad : 0xff7a85, 1).strokePoints(pts, true);
    }
  }
  // เส้นประ — คืนค่า offset ต่อไปเพื่อให้ต่อเนื่องหลายช่วง
  dashed(g, a, b, dash, gap, offset) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 0.01) return offset || 0;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len, period = dash + gap;
    offset = offset || 0;
    for (let t = -offset; t < len; t += period) {
      const s0 = Math.max(0, t), s1 = Math.min(len, t + dash);
      if (s1 > s0) g.lineBetween(a.x + ux * s0, a.y + uy * s0, a.x + ux * s1, a.y + uy * s1);
    }
    return (offset + len) % period;
  }

  // =============================================================
  //  BUILD MODE — วาง / ย้าย / เลือก / อัปเกรด / รื้อ / เคลียร์สิ่งกีดขวาง
  // =============================================================
  addBuildings() {
    this.mode = 'view';          // 'view' | 'place' | 'move'
    this.placeType = null;
    this.moveId = null;
    this.selectedB = null;
    this.bSprites = new Map();
    this.bTimers = new Map();
    this.barG = this.add.graphics().setDepth(1.5e6);
    for (const b of this.city.state.buildings) this.addBuildingSprite(b);
    this.addGatehouses();
    this.city.on((ev, data) => this.onCityEvent(ev, data));
  }
  // เลือกภาพของอาคาร (กำแพงเลือกชิ้นตามทิศของแนวกำแพง, ป้อมธนูสุ่มแบบตาม id)
  wallOrient(x, y) {
    const u = x + 0.5 - this.island.C, v = y + 0.5 - this.island.C;
    return Math.abs(u) >= Math.abs(v) ? 'v' : 'u';
  }
  artFor(t) {
    const a = this.bArt[t.type];
    if (t.type === 'wall' && a.strips) {
      const o = this.wallOrient(t.x, t.y);
      const n = a.strips[o].length;
      const j = o === 'v' ? (((-t.y) % n) + n) % n : ((t.x % n) + n) % n;
      return a.strips[o][j];
    }
    if (t.type === 'townhall' && this.bArt.townhallLv) {
      const row = AR.TOWN_HALL[Math.min(t.level || 1, 5) - 1];
      return this.bArt.townhallLv[row.art];
    }
    if (a.variants) return a.variants[(t.id || 0) % a.variants.length];
    return a;
  }
  // ตำแหน่งวางภาพ: ภาพวาดเอง = มุมบนของฐาน, ภาพจริง = มุมหน้าของฐาน, กำแพง = ขอบล่างด้านหน้า
  anchorPos(t, e) {
    const size = AR.BUILDINGS[t.type].size, hw = AR.iso.hw, hh = AR.iso.hh;
    const front = AR.iso.toWorld(t.x + size, t.y + size);
    // กำแพงทุกด้านวางบน "เส้นกึ่งกลางช่อง" → มุมและซุ้มประตูต่อกันพอดีทุกด้าน
    if (e.wall === 'v') return { x: (t.x - t.y - 0.5) * hw, y: (t.x + t.y + 1.5) * hh + WALL_DY, depth: front.y - 6 };
    if (e.wall === 'u') return { x: (t.x - t.y - 0.5) * hw, y: (t.x + t.y + 0.5) * hh + WALL_DY, depth: front.y - 6 };
    if (e.anchor === 'TH') {
      // วางมุมล่างสุดของฐานปราสาท ให้ฐานอยู่กลางพื้นที่ 8×8
      const m = e.meta, du = (size - m.u * e.scale) / 2, dv = (size - m.v * e.scale) / 2;
      const p = AR.iso.toWorld(t.x + size - du, t.y + size - dv);
      return { x: p.x, y: p.y, depth: front.y - 6 };
    }
    if (e.anchor === 'S') {
      // ภาพจริง: ให้มุมหน้าของฐานอยู่ใต้จุดกึ่งกลางฐานอาคาร
      const c = AR.iso.toWorld(t.x + size / 2, t.y + size / 2);
      const baseW = Math.max(e.img.width * (e.scale || 1) * 0.8, size * hw * 2);
      return { x: c.x, y: c.y + baseW / 4, depth: front.y - 6 };
    }
    const p = AR.iso.toWorld(t.x, t.y);
    return { x: p.x, y: p.y, depth: front.y - 6 };
  }
  applyArt(img, e) {
    img.setTexture(this.canvasKey(e.img, 'bld'))
      .setOrigin(e.ax / e.img.width, e.ay / e.img.height).setScale(e.scale || 1);
  }
  addBuildingSprite(b) {
    const img = this.add.image(0, 0, '__DEFAULT');
    this.bSprites.set(b.id, img);
    if (AR.BUILDINGS[b.type].fixed) { img.setVisible(false); return; } // ป้อมปราการหลัก = ซุ้มประตูที่วาดอยู่แล้ว
    this.placeSprite(b);
  }
  placeSprite(b) {
    const img = this.bSprites.get(b.id), e = this.artFor(b);
    this.applyArt(img, e);
    const p = this.anchorPos(b, e);
    img.setPosition(p.x, p.y).setDepth(p.depth).setAlpha(b.done || b.upgrading ? 1 : 0.55);
  }
  // ซุ้มประตูเมือง 4 ทิศ (ฝั่งสนามรบ = ประตูปิด, ที่เหลือ = ซุ้มโค้งเปิด)
  addGatehouses() {
    const g = this.bArt.gates; if (!g) return;
    const C = this.island.C, R = this.cfg.layout.wallRadius;
    const fieldAxis = this.cfg.bridge.axis || 'v';
    const list = [
      { gx: C + R, gy: C, o: 'v', field: fieldAxis === 'u' },
      { gx: C - R, gy: C, o: 'v' },
      { gx: C, gy: C + R, o: 'u', field: fieldAxis === 'v' },
      { gx: C, gy: C - R, o: 'u' },
    ];
    for (const q of list) {
      const e = g[(q.field ? 'closed_' : 'open_') + q.o];
      const p = AR.iso.toWorld(q.gx, q.gy);
      const img = this.add.image(p.x, p.y + GATE_DY, '__DEFAULT');
      this.applyArt(img, e);
      img.setDepth(p.y + 40);
    }
  }
  onCityEvent(ev, data) {
    const def = data && data.type ? AR.BUILDINGS[data.type] : null;
    if (ev === 'player') this.hud.toast(`เลเวลผู้เล่นเพิ่มเป็น Lv.${data}!`, 'gold');
    if (ev === 'protect') {
      if (data === 'on') this.hud.toast('🛡 เปิด City Protection — เมืองจะไม่ถูกเลือกเป็นเป้าหมาย PVB', 'ok');
      if (data === 'off') this.hud.toast('ปิด City Protection — เก็บเวลาที่เหลือไว้แล้ว', 'info');
      if (data === 'expired') this.hud.toast('🛡 เวลาป้องกันของวันนี้หมดแล้ว — รอรอบรีเซ็ตใหม่', 'bad');
    }
    if (ev === 'done' && data.type === 'camp' && data.level === 1) {
      const n = this.city.activeParties();
      this.hud.toast(n >= this.city.campsBuilt() ? `ค่ายเสร็จแล้ว! ปาร์ตี้ ${n} พร้อมใช้งาน` : 'ค่ายเสร็จแล้ว — อัปปราสาทเพื่อปลดล็อกปาร์ตี้เพิ่ม', 'gold');
    }
    if (ev === 'add') this.addBuildingSprite(data);
    if (ev === 'move' || ev === 'update') this.placeSprite(data);
    if (ev === 'remove') {
      this.bSprites.get(data.id).destroy(); this.bSprites.delete(data.id);
      if (this.selectedB === data.id) this.deselect();
    }
    if (ev === 'done') {
      this.placeSprite(data);
      if (data.type === 'townhall') {
        const th = data.level;
        const unlocked = Object.values(this.cfg.zones).filter((z) => z.unlockTH === th).map((z) => z.name);
        const newB = AR.BUILD_ORDER.filter((k) => AR.BUILDINGS[k].unlockTH === th).map((k) => AR.BUILDINGS[k].name);
        const R = AR.TOWN_HALL[th - 1];
        let msg = `ปราสาทเจ้าเมือง Lv.${th}! ปาร์ตี้ ${R.parties} · ค่าย ${R.camps} · ป้องกันเมือง ${R.shield} ชม./วัน${th === 4 ? ' · ปราสาทหลังใหญ่!' : ''}`;
        if (unlocked.length) msg += ` · ปลดล็อก ${unlocked.join(', ')}`;
        if (newB.length) msg += ` · อาคารใหม่: ${newB.join(', ')}`;
        this.hud.toast(msg, 'gold');
        this.drawLockLayer();
      } else {
        this.hud.toast(`${def.name} ${data.level > 1 ? 'อัปเกรดเป็น Lv.' + data.level : 'สร้างเสร็จแล้ว'}`, 'ok');
      }
    }
    if (ev === 'clear') {
      (this.cellImgs[data] || []).forEach((img) => img.destroy());
      delete this.cellImgs[data];
      this.drawZoneLayer();
    }
    if (this.mode !== 'view') this.drawLockLayer();
    this.hud.refresh(this);
  }

  // ---------- modes ----------
  startBuild(type) {
    const st = this.city.canStart(type);
    if (!st.ok) { this.hud.toast(st.reason, 'bad'); return; }
    this.deselect();
    this.mode = 'place'; this.placeType = type; this.moveId = null; this.touchArm = null;
    this.setGhost(type);
    this.drawLockLayer();
    this.hud.setMode(this);
  }
  startMove() {
    const b = this.city.byId(this.selectedB);
    if (!b || b.type === 'townhall') return;
    this.mode = 'move'; this.placeType = b.type; this.moveId = b.id; this.touchArm = null;
    this.selectedB = null;
    this.bSprites.get(b.id).setAlpha(0.3);
    this.setGhost(b.type);
    this.drawLockLayer();
    this.hud.setMode(this);
    this.hud.showCell(null);
  }
  exitBuild() {
    if (this.mode === 'move') { const b = this.city.byId(this.moveId); if (b) this.placeSprite(b); }
    this.mode = 'view'; this.placeType = null; this.moveId = null;
    if (this.ghostImg) { this.ghostImg.destroy(); this.ghostImg = null; }
    this.ghostG.clear(); this.lockG.clear();
    this.hud.tip(null);
    this.hud.setMode(this);
  }
  setGhost(type) {
    if (this.ghostImg) this.ghostImg.destroy();
    this.ghostImg = this.add.image(0, 0, '__DEFAULT').setDepth(1.8e6).setAlpha(0.72).setVisible(false);
  }
  ghostOrigin() {
    if (!this.pointerCell) return null;
    const s = AR.BUILDINGS[this.placeType].size, o = Math.floor((s - 1) / 2);
    return { x: this.pointerCell.gx - o, y: this.pointerCell.gy - o };
  }
  deselect() {
    this.selected = null; this.selectedB = null;
    this.hud.showCell(null, true);
  }
  selectBuilding(id) {
    this.selected = null; this.selectedB = id;
    this.hud.showBuilding(this.buildingInfo(id), true);
  }

  // คลิก/แตะ (ไม่ได้ลาก)
  onTap(touch) {
    const pc = this.pointerCell;
    if (this.mode !== 'view') {
      const o = this.ghostOrigin();
      if (!o) return;
      // มือถือ: แตะครั้งแรก = เล็งตำแหน่ง, แตะซ้ำที่เดิม = วาง
      if (touch && (!this.touchArm || this.touchArm.x !== o.x || this.touchArm.y !== o.y)) {
        this.touchArm = o; this.hud.toast('แตะซ้ำที่เดิมเพื่อยืนยันตำแหน่ง', 'info'); return;
      }
      this.touchArm = null;
      if (this.mode === 'place') {
        const type = this.placeType;
        const r = this.city.place(type, o.x, o.y);
        if (!r.ok) { this.hud.toast(r.reason, 'bad'); return; }
        this.hud.toast(`เริ่มสร้าง${AR.BUILDINGS[type].name}`, 'ok');
        if (!(AR.BUILDINGS[type].repeat && this.city.canStart(type).ok)) this.exitBuild();
      } else {
        const id = this.moveId;
        const r = this.city.move(id, o.x, o.y);
        if (!r.ok) { this.hud.toast(r.reason, 'bad'); return; }
        this.exitBuild();
        this.selectBuilding(id);
      }
      return;
    }
    if (!pc) return;
    const b = this.city.buildingAt(pc.gx, pc.gy);
    if (b) { this.selectBuilding(b.id); return; }
    this.selectedB = null;
    this.selected = this.hover ? { ...this.hover } : null;
    this.hud.showCell(this.selected ? this.cellInfo(this.selected.gx, this.selected.gy) : null, true);
  }

  // ---------- actions (เรียกจาก HUD) ----------
  upgradeSelected() {
    const r = this.city.upgrade(this.selectedB);
    if (!r.ok) this.hud.toast(r.reason, 'bad');
    else this.hud.toast('เริ่มอัปเกรด', 'ok');
    this.refreshSelection();
  }
  speedUpSelected() {
    const r = this.city.speedUp(this.selectedB);
    if (!r.ok && r.reason) this.hud.toast(r.reason, 'bad');
    this.refreshSelection();
  }
  demolishSelected() {
    const b = this.city.byId(this.selectedB);
    const r = this.city.demolish(this.selectedB);
    if (!r.ok) { this.hud.toast(r.reason, 'bad'); return; }
    this.hud.toast(`รื้อ${AR.BUILDINGS[b.type].name} · คืน ${AR.fmtCost(r.refund)}`, 'info');
    this.deselect();
  }
  clearCell(gx, gy) {
    const r = this.city.clearObstacle(gy * this.cfg.gridSize + gx);
    if (!r.ok) { if (r.reason) this.hud.toast(r.reason, 'bad'); return; }
    this.hud.toast('เคลียร์พื้นที่แล้ว', 'ok');
    this.hud.showCell(this.cellInfo(gx, gy), true);
  }
  refreshSelection() {
    if (this.selectedB && this.city.byId(this.selectedB)) this.hud.showBuilding(this.buildingInfo(this.selectedB), true);
  }

  buildingInfo(id) {
    const b = this.city.byId(id), def = AR.BUILDINGS[b.type];
    const now = Date.now();
    const info = {
      id, type: b.type, name: def.name, en: def.en, level: b.level, size: def.size, desc: def.desc,
      done: b.done, upgrading: !!b.upgrading,
      remain: b.done ? 0 : Math.max(0, Math.ceil((b.end - now) / 1000)),
      progress: b.done ? 1 : AR.clamp((now - b.start) / (b.end - b.start), 0, 1),
      prod: def.prod ? def.prod * b.level : 0,
      canMove: b.type !== 'townhall' && !def.fixed, canDemolish: b.type !== 'townhall' && !def.fixed,
      refund: this.city.refund(b),
      icon: this.artFor(b).icon || this.bArt[b.type].icon,
    };
    const up = this.city.upgradeInfo(b);
    info.upgrade = up.max ? { max: true } : up.blocked ? { blocked: up.blocked } :
      { cost: up.cost, time: up.time, affordable: this.city.affordable(up.cost) };
    if (!b.done) info.speedCost = { coupon: Math.max(1, Math.ceil(info.remain / 10)) };
    if (b.type === 'townhall') {
      const th = b.level;
      const row = AR.TOWN_HALL[th - 1], nx = AR.TOWN_HALL[th];
      info.parties = row.parties; info.camps = row.camps; info.heroCap = row.heroes; info.shield = row.shield;
      info.campCount = this.city.campsBuilt();
      info.active = this.city.activeParties();
      info.nextRow = nx || null;
      const next = th + 1;
      info.nextUnlock = [
        ...Object.values(this.cfg.zones).filter((z) => z.unlockTH === next).map((z) => z.name),
        ...AR.BUILD_ORDER.filter((k) => AR.BUILDINGS[k].unlockTH === next).map((k) => AR.BUILDINGS[k].name),
      ];
      if (AR.rules.partySlots(next) > info.parties) info.nextUnlock.push(`ปาร์ตี้ที่ ${AR.rules.partySlots(next)}`);
      if (next <= AR.rules.maxTH) for (let L = 2; L <= AR.rules.maxFortress; L++) if (AR.rules.fortressNeedTH(L) === next) info.nextUnlock.push(`อัป Main Fortress Lv.${L}`);
    }
    if (b.type === 'camp') {
      const idx = this.city.campList().findIndex((c) => c.id === b.id);
      const P = this.city.state.parties[idx] || [];
      info.campParty = idx + 1; info.campHeroes = P.length;
      info.campActive = b.done || b.upgrading ? this.city.partyState(idx).state === 'active' : false;
    }
    if (b.type === 'fortress') {
      info.fortress = { max: AR.rules.maxFortress, needTH: b.level < AR.rules.maxFortress ? AR.rules.fortressNeedTH(b.level + 1) : null, th: this.city.th };
    }
    return info;
  }

  // ---------- drawing ----------
  drawLockLayer() {
    const g = this.lockG.clear();
    if (this.mode === 'view') return;
    const def = AR.BUILDINGS[this.placeType];
    for (const c of this.island.cells) {
      if (!c.inside) continue;
      const pts = this.diamondPts(c.x, c.y);
      if (!this.city.zoneUnlocked(c.zone)) { g.fillStyle(0x05030c, 0.5).fillPoints(pts, true); continue; }
      const occ = this.city.buildingAt(c.x, c.y);
      if (def.zones.includes(c.zone) && !c.gate && !c.road && !c.blocked && (!occ || occ.id === this.moveId)) {
        g.fillStyle(0x7dffad, 0.13).fillPoints(pts, true);
      }
    }
  }
  updateBuildings(T) {
    const now = Date.now(), z = this.camState.zoom;
    // แถบความคืบหน้าการก่อสร้าง
    this.barG.clear();
    const live = new Set();
    for (const b of this.city.state.buildings) {
      if (b.done) continue;
      live.add(b.id);
      const s = AR.BUILDINGS[b.type].size;
      const c = AR.iso.toWorld(b.x + s / 2, b.y + s / 2);
      const w = Math.max(70, s * 46), y = c.y - 30 - s * 22;
      const t = AR.clamp((now - b.start) / (b.end - b.start), 0, 1);
      this.barG.fillStyle(0x0c0a18, 0.85).fillRoundedRect(c.x - w / 2 - 3, y - 3, w + 6, 16, 6);
      this.barG.fillStyle(b.upgrading ? 0xe3b866 : 0x7dffad, 1).fillRoundedRect(c.x - w / 2, y, Math.max(6, w * t), 10, 4);
      let tx = this.bTimers.get(b.id);
      if (!tx) {
        tx = this.add.text(0, 0, '', { fontFamily: 'Kanit, Tahoma, sans-serif', fontSize: '13px', fontStyle: '600', color: '#ffffff', stroke: '#000000', strokeThickness: 4 })
          .setOrigin(0.5, 1).setDepth(1.5e6 + 1).setResolution(AR.dpr * 2);
        this.bTimers.set(b.id, tx);
      }
      const remain = Math.max(0, Math.ceil((b.end - now) / 1000));
      tx.setText(`${b.upgrading ? '⬆' : '🔨'} ${remain}s`).setPosition(c.x, y - 4).setScale(Math.min(2.2, 1 / z));
      const img = this.bSprites.get(b.id);
      if (img && !b.upgrading) img.setAlpha(0.45 + 0.1 * Math.sin(T * 4));
    }
    for (const [id, tx] of this.bTimers) if (!live.has(id)) { tx.destroy(); this.bTimers.delete(id); }

    // กรอบอาคารที่เลือก
    this.selG.clear();
    if (this.selectedB) {
      const b = this.city.byId(this.selectedB);
      if (b) {
        const s = AR.BUILDINGS[b.type].size;
        const boxes = b.type === 'fortress' ? this.city.fortressCells().map((c) => [c.x, c.y, 1]) : [[b.x, b.y, s]];
        for (const [x, y, n] of boxes) {
          const pts = [AR.iso.toWorld(x, y), AR.iso.toWorld(x + n, y), AR.iso.toWorld(x + n, y + n), AR.iso.toWorld(x, y + n)];
          this.selG.fillStyle(0xffd166, 0.18).fillPoints(pts, true);
          this.selG.lineStyle(4 / Math.max(z, 0.35), 0xffd166, 0.6 + 0.4 * Math.sin(T * 5)).strokePoints(pts, true);
        }
      }
    }

    // ghost ตอนวาง/ย้าย
    this.ghostG.clear();
    if (this.mode === 'view' || !this.ghostImg) return;
    const o = this.ghostOrigin();
    if (!o) { this.ghostImg.setVisible(false); return; }
    const chk = this.city.check(this.placeType, o.x, o.y, this.moveId);
    const ok = chk.ok && (this.mode === 'move' || this.city.canStart(this.placeType).ok);
    for (const c of chk.cells) {
      const pts = this.diamondPts(c.x, c.y);
      this.ghostG.fillStyle(c.ok ? 0x50ff8c : 0xff505a, 0.45).fillPoints(pts, true);
      this.ghostG.lineStyle(2 / Math.max(z, 0.4), c.ok ? 0x7dffad : 0xff7a85, 1).strokePoints(pts, true);
    }
    const gt = { type: this.placeType, x: o.x, y: o.y, id: this.moveId || this.city.state.nextId };
    const ge = this.artFor(gt), p = this.anchorPos(gt, ge);
    this.applyArt(this.ghostImg, ge);
    this.ghostImg.setVisible(true).setPosition(p.x, p.y).setTint(ok ? 0xffffff : 0xff8080).setAlpha(ok ? 0.8 : 0.6);
    const reason = chk.ok ? (this.mode === 'place' ? this.city.canStart(this.placeType).reason : null) : chk.reason;
    this.hud.tip(reason || null);
  }

  // ---------------- canvas effects ----------------
  drawFall(ctx, w, T) {
    const L = w.length, W = w.width, x = w.x, y = w.y;
    const g = ctx.createLinearGradient(0, y, 0, y + L);
    g.addColorStop(0, 'rgba(215,240,255,0.95)'); g.addColorStop(0.35, 'rgba(140,205,245,0.8)');
    g.addColorStop(1, w.kind === 'void' ? 'rgba(140,190,255,0)' : 'rgba(170,220,255,0.85)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - W / 2, y); ctx.lineTo(x + W / 2, y);
    ctx.lineTo(x + W / 2 + (w.kind === 'void' ? 18 : 4), y + L); ctx.lineTo(x - W / 2 - (w.kind === 'void' ? 18 : 4), y + L);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 12; i++) {
      const ph = (T * (0.55 + (i % 3) * 0.12) + i * 0.137) % 1;
      const sx = x - W / 2 + 4 + ((i * 37) % (W - 8)) + ph * (i % 2 ? 6 : -6);
      const sy = y + ph * L;
      ctx.globalAlpha = w.kind === 'void' ? (1 - ph) * 0.8 : 0.7;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, Math.min(y + L, sy + 26 + (i % 4) * 8)); ctx.stroke();
    }
    ctx.globalAlpha = 0.8; ctx.fillStyle = '#f2fbff';
    ctx.beginPath(); ctx.ellipse(x, y + 2, W * 0.62, 8, 0, 0, Math.PI * 2); ctx.fill();
    if (w.kind === 'cliff') {
      const s = 1 + 0.15 * Math.sin(T * 6);
      ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.ellipse(x, y + L, W * s, 13 * s, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      const mg = ctx.createRadialGradient(x, y + L * 0.75, 5, x, y + L * 0.75, 150);
      mg.addColorStop(0, 'rgba(200,225,255,0.25)'); mg.addColorStop(1, 'rgba(200,225,255,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = mg; ctx.fillRect(x - 160, y + L * 0.75 - 160, 320, 320);
    }
    ctx.globalAlpha = 1;
  }
  drawPortal(ctx, T) {
    const p = this.island.platform.center;
    const cx = p.x, cy = p.y - 135, rx = 72, ry = 120;
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 240);
    glow.addColorStop(0, 'rgba(190,90,255,0.55)'); glow.addColorStop(1, 'rgba(120,40,200,0)');
    ctx.fillStyle = glow; ctx.fillRect(cx - 240, cy - 240, 480, 480);
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#3b3346'; ctx.fillRect(cx + sx * (rx + 14) - 11, cy - ry - 20, 22, ry * 2 + 30);
      ctx.fillStyle = '#5d5270'; ctx.fillRect(cx + sx * (rx + 14) - 11, cy - ry - 20, 7, ry * 2 + 30);
      ctx.fillStyle = `rgba(210,150,255,${0.6 + 0.4 * Math.sin(T * 3 + sx)})`;
      ctx.fillRect(cx + sx * (rx + 14) - 3, cy - 40, 6, 18);
      ctx.fillRect(cx + sx * (rx + 14) - 3, cy + 20, 6, 18);
    }
    const sg = ctx.createRadialGradient(cx, cy, 4, cx, cy, ry);
    sg.addColorStop(0, '#0b0216'); sg.addColorStop(0.6, '#3a0f63'); sg.addColorStop(1, 'rgba(170,80,255,0.9)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    ctx.translate(cx, cy); ctx.scale(rx / ry, 1);
    for (let i = 0; i < 5; i++) {
      ctx.rotate(T * 0.8 + i * 1.25);
      ctx.strokeStyle = `rgba(${200 + i * 10},${120 + i * 20},255,0.35)`; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(0, 0, 25 + i * 18, 0, Math.PI * 1.1); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = `rgba(230,180,255,${0.75 + 0.25 * Math.sin(T * 4)})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f3dcff';
    for (let i = 0; i < 18; i++) {
      const a = T * (0.9 + (i % 3) * 0.3) + i;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(T * 5 + i);
      ctx.fillRect(cx + Math.cos(a) * (rx + 12), cy + Math.sin(a) * (ry + 12), 4, 4);
    }
    ctx.globalAlpha = 1;
  }
};
