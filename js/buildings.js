// =============================================================
//  Buildings: รายการอาคาร, กติกาการวาง, ระบบเมือง (ทรัพยากร/TH/บันทึก)
//  แก้ราคา ขนาด จำนวนสูงสุด เลเวลปลดล็อก ได้ที่ AR.BUILDINGS
// =============================================================
window.AR = window.AR || {};

const CITY_ZONES = ['core', 'city', 'expA', 'expB', 'expC'];

// size = ขนาดฐาน N×N ช่อง · cost = ราคาสร้าง (Lv.1) · time = วินาทีที่ใช้สร้าง
// limit = { base, per } → จำนวนสูงสุด = base + floor(TH × per)
// prod = Silver ต่อนาทีต่อเลเวล · zones = โซนที่วางได้ · repeat = วางต่อเนื่องได้
AR.BUILDINGS = {
  townhall:  { name: 'ปราสาทเจ้าเมือง', en: "Lord's Castle", size: 8, group: 'core', unique: true, zones: ['core'],
               desc: 'อาคารหลัก · กำหนดจำนวนปาร์ตี้ Hero Party Camp เวลาป้องกันเมืองจาก PVB และเงื่อนไขอัปเกรด Main Fortress' },
  fortress:  { name: 'ป้อมปราการหลัก', en: 'Main Fortress', size: 1, group: 'defense', unique: true, fixed: true,
               cost: { silver: 5000, gold: 20 }, time: 10, zones: [],
               desc: 'ซุ้มประตูหน้าเมืองฝั่งสนามรบ (บอสบุกที่นี่) · อัปเกรดได้เมื่อปราสาทเจ้าเมืองถึงเลเวลที่กำหนด' },
  camp:      { name: 'ค่ายปาร์ตี้ฮีโร่', en: 'Hero Party Camp', size: 3, group: 'hero', cost: { silver: 1500 }, time: 6, unlockTH: 1, limitFn: (th) => Math.min(AR.TOWN_HALL[th - 1].camps, AR.rules.maxCamps), zones: CITY_ZONES,
               desc: 'ปาร์ตี้ 1 ทีมต้องมีค่าย 1 แห่ง · รองรับฮีโร่ 4 ตัว · สร้างได้ตามสิทธิ์จากปราสาท (สูงสุด 5)' },
  house:     { name: 'บ้านพัก', size: 2, group: 'city', cost: { silver: 600 }, time: 4, unlockTH: 1, limit: { base: 8, per: 2 }, zones: CITY_ZONES,
               desc: 'ที่อยู่อาศัยของชาวเมือง' },
  farm:      { name: 'ฟาร์ม', size: 3, group: 'prod', cost: { silver: 1000 }, time: 6, unlockTH: 1, limit: { base: 2, per: 0.34 }, prod: 60, zones: CITY_ZONES,
               desc: 'ผลิต Silver อัตโนมัติ' },
  sawmill:   { name: 'โรงไม้', size: 2, group: 'prod', cost: { silver: 900 }, time: 5, unlockTH: 1, limit: { base: 1, per: 0.25 }, prod: 40, zones: CITY_ZONES,
               desc: 'ผลิต Silver อัตโนมัติ' },
  warehouse: { name: 'คลังเสบียง', size: 2, group: 'city', cost: { silver: 1200 }, time: 6, unlockTH: 1, limit: { base: 1, per: 0.2 }, zones: CITY_ZONES,
               desc: 'เก็บทรัพยากรของเมือง' },
  heroHall:  { name: 'หอฮีโร่', size: 3, group: 'hero', cost: { silver: 2000 }, time: 8, unlockTH: 1, limit: { base: 1, per: 0 }, zones: CITY_ZONES,
               desc: 'จัดทีมฮีโร่ · สูงสุด 5 ปาร์ตี้ ปาร์ตี้ละ 4 ตัว' },
  fountain:  { name: 'น้ำพุ', size: 2, group: 'decor', cost: { silver: 500 }, time: 3, unlockTH: 1, limit: { base: 2, per: 0.2 }, zones: CITY_ZONES,
               desc: 'ของตกแต่งเมือง' },
  mine:      { name: 'เหมืองหิน', size: 2, group: 'prod', cost: { silver: 1200 }, time: 6, unlockTH: 2, limit: { base: 1, per: 0.25 }, prod: 50, zones: CITY_ZONES,
               desc: 'ผลิต Silver อัตโนมัติ' },
  research:  { name: 'หอวิจัย', size: 2, group: 'hero', cost: { silver: 2500 }, time: 8, unlockTH: 2, limit: { base: 1, per: 0 }, zones: CITY_ZONES,
               desc: 'วิจัยเทคโนโลยีเพิ่มพลังเมืองและฮีโร่' },
  tavern:    { name: 'โรงเตี๊ยม', size: 2, group: 'hero', cost: { silver: 1500 }, time: 6, unlockTH: 2, limit: { base: 1, per: 0 }, zones: CITY_ZONES,
               desc: 'รับสมัครฮีโร่ใหม่' },
  forge:     { name: 'โรงตีเหล็ก', size: 2, group: 'hero', cost: { silver: 2500 }, time: 8, unlockTH: 3, limit: { base: 1, per: 0 }, zones: CITY_ZONES,
               desc: 'ตีและอัปเกรดอุปกรณ์ฮีโร่' },
  guild:     { name: 'กิลด์นักล่า', size: 3, group: 'hero', cost: { silver: 3000, gold: 10 }, time: 10, unlockTH: 3, limit: { base: 1, per: 0 }, zones: CITY_ZONES,
               desc: 'ส่งฮีโร่ออกล่ามอนสเตอร์ (PvE)' },
  wall:      { name: 'กำแพงหิน', size: 1, group: 'defense', cost: { silver: 60 }, time: 1, unlockTH: 1, limit: { base: 260, per: 10 }, zones: ['wall'], repeat: true,
               desc: 'วางบนแนวกำแพงเท่านั้น (เว้นช่องประตู)' },
  tower:     { name: 'หอคอยกำแพง', size: 1, group: 'defense', cost: { silver: 500 }, time: 3, unlockTH: 1, limit: { base: 12, per: 1 }, zones: ['wall'], repeat: true,
               desc: 'หอคอยหลังคาฟ้าบนแนวกำแพง ใช้เป็นมุมกำแพง' },
  archer:    { name: 'ป้อมธนู', size: 1, group: 'defense', cost: { silver: 800 }, time: 4, unlockTH: 1, limit: { base: 16, per: 1 }, zones: ['wall', 'city', 'battlefield'], repeat: true,
               desc: 'ยิงศัตรูและบอสที่บุกเข้ามา' },
  trap:      { name: 'กับดักหนาม', size: 1, group: 'defense', cost: { silver: 150 }, time: 1, unlockTH: 2, limit: { base: 6, per: 1 }, zones: ['battlefield'], repeat: true,
               desc: 'วางในสนามรบ ทำดาเมจบอสที่เดินผ่าน' },
  crystal:   { name: 'ป้อมปราการผลึก', size: 2, group: 'defense', cost: { silver: 6000, gold: 30 }, time: 12, unlockTH: 5, limit: { base: 1, per: 0.2 }, zones: ['city', 'battlefield'],
               desc: 'ป้อมเวทพลังสูง ยิงลำแสงใส่บอส' },
};
// ---------------------------------------------------------------
//  ปราสาทเจ้าเมือง (Lord's Castle / Town Hall) — ตาราง [ยืนยันแล้ว]
//  parties = ปาร์ตี้สูงสุด · camps = Hero Party Camp สูงสุด · heroes = ฮีโร่ในปาร์ตี้รวม
//  shield = ป้องกันเมืองจาก PVB (ชั่วโมง/วัน) · art = ภาพปราสาท (แดง Lv.1-3, ฟ้า Lv.4-5)
// ---------------------------------------------------------------
AR.TOWN_HALL = [
  { lv: 1, parties: 2, camps: 2, heroes: 8,  shield: 0, art: 'red' },
  { lv: 2, parties: 3, camps: 3, heroes: 12, shield: 2, art: 'red' },
  { lv: 3, parties: 4, camps: 4, heroes: 16, shield: 4, art: 'red' },
  { lv: 4, parties: 5, camps: 5, heroes: 20, shield: 6, art: 'blue' },
  { lv: 5, parties: 5, camps: 5, heroes: 20, shield: 8, art: 'blue' },
];
// รางวัลประจำวันของปราสาทเจ้าเมือง — เลเวลสูงขึ้น ได้มากขึ้น/ดีขึ้น (ค่าเริ่มต้น แก้ได้)
// ⚠ ต้องแก้ให้ตรงกับ TH_DAILY ใน server/server.js ด้วย
AR.TH_DAILY = [
  { lv: 1, silver: 2000,  gold: 0,  coupon: 0 },
  { lv: 2, silver: 4000,  gold: 10, coupon: 0 },
  { lv: 3, silver: 7000,  gold: 20, coupon: 5 },
  { lv: 4, silver: 11000, gold: 35, coupon: 10 },
  { lv: 5, silver: 16000, gold: 50, coupon: 20 },
];
AR.BUILD_ORDER = ['camp', 'house', 'farm', 'sawmill', 'mine', 'warehouse', 'heroHall', 'tavern', 'research', 'forge', 'guild', 'fountain', 'wall', 'tower', 'archer', 'trap', 'crystal'];
// ฮีโร่ตัวอย่าง (ข้อมูลชั่วคราวไว้ทดสอบ UI ปาร์ตี้ — แทนด้วยระบบฮีโร่จริงภายหลัง)
AR.HERO_CLASSES = {
  warrior: { name: 'นักรบ', icon: '⚔', color: '#c0503a', pow: 300 },
  archer:  { name: 'นักธนู', icon: '🏹', color: '#3f9a4a', pow: 260 },
  mage:    { name: 'นักเวท', icon: '✦', color: '#6a4fd0', pow: 340 },
  healer:  { name: 'นักบวช', icon: '✚', color: '#d8a93a', pow: 200 },
};
AR.SAMPLE_HEROES = [
  { id: 1, name: 'Aria', cls: 'warrior', lv: 12, hair: '#f1d36b', eye: '#3a6fd0' },
  { id: 2, name: 'Selene', cls: 'mage', lv: 11, hair: '#e6e6f0', eye: '#8a4fd0' },
  { id: 3, name: 'Rin', cls: 'archer', lv: 10, hair: '#ff8fb1', eye: '#2f8a55' },
  { id: 4, name: 'Kael', cls: 'healer', lv: 10, hair: '#2b2b38', eye: '#c0503a' },
  { id: 5, name: 'Mira', cls: 'warrior', lv: 9, hair: '#d0383f', eye: '#e3b866' },
  { id: 6, name: 'Lyra', cls: 'mage', lv: 9, hair: '#7ccf6a', eye: '#2f6fd0' },
  { id: 7, name: 'Nox', cls: 'archer', lv: 8, hair: '#7a4fb8', eye: '#d04f8a' },
  { id: 8, name: 'Elin', cls: 'healer', lv: 8, hair: '#f3e2a0', eye: '#4fa0d0' },
  { id: 9, name: 'Vex', cls: 'warrior', lv: 7, hair: '#5a3a22', eye: '#e3b866' },
  { id: 10, name: 'Sora', cls: 'mage', lv: 7, hair: '#5fb8e8', eye: '#3a3a8a' },
];
AR.RES = {
  coupon: { name: 'Coupon', icon: '🎫' },
  gold:   { name: 'Gold', icon: '🪙' },
  silver: { name: 'Silver', icon: '⚪' },
};

AR.rules = {
  maxTH: 5,
  partySlots: (th) => AR.TOWN_HALL[Math.min(th, 5) - 1].parties,
  partyUnlockTH: (i) => AR.TOWN_HALL.findIndex((t) => t.parties > i) + 1,
  maxFortress: 5,
  fortressNeedTH: (lv) => lv,   // Main Fortress Lv.N ต้องมีปราสาทเจ้าเมือง Lv.N ขึ้นไป (แก้ตามสเปกจริงได้)
  maxCamps: 5,            // แคมป์สูงสุดทั้งเกม
  heroesPerCamp: 4,       // แคมป์ 1 แห่งรองรับฮีโร่ 4 ตัว
  shieldHours: (th) => AR.TOWN_HALL[Math.min(th, 5) - 1].shield,
  thUpgrade: (lv) => ({ cost: { silver: Math.round(3000 * Math.pow(lv, 1.6)), gold: lv >= 4 ? 10 * lv : 0 }, time: 5 + lv * 3 }),
  upgrade: (def, lv) => {
    const cost = {};
    for (const k in def.cost) cost[k] = Math.round(def.cost[k] * (0.6 + 0.7 * lv));
    return { cost, time: Math.round(def.time * (1 + lv * 0.6)) };
  },
  limit: (def, th) => (def.unique ? 1 : def.limitFn ? def.limitFn(th) : def.limit.base + Math.floor(th * def.limit.per)),
};

// ---------------------------------------------------------------
//  City state
// ---------------------------------------------------------------
AR.City = class {
  constructor(island, remote) {
    this.island = island;
    this.cfg = island.cfg;
    this.G = this.cfg.gridSize;
    this.key = 'abyssal-rift-city-v7'; // v7 = ปาร์ตี้ต้องมีค่ายรองรับ
    this.state = (remote !== undefined ? this.fromRemote(remote) : this.load()) || this.fresh();
    this.occ = new Int32Array(this.G * this.G);
    // apply cleared obstacles
    for (const idx of this.state.cleared) {
      const c = this.island.cells[idx];
      if (c) { c.blocked = false; c.deco = null; }
    }
    this.rebuildOcc();
    this.listeners = [];
    if (!this.state.seeded) { this.seedStarter(); this.state.seeded = true; this.save(); }
    this.ensureFortress();
    this.protUpdate(); // นับเวลาป้องกันที่ลดลงระหว่างออฟไลน์ทันทีที่โหลด
  }

  // เมืองเริ่มต้นแบบภาพตัวอย่าง: กำแพงรอบเมือง, ป้อมธนูขนาบประตู, บ้าน/ฟาร์มหลังกำแพง
  seedStarter() {
    const isl = this.island, L = this.cfg.layout, st = this.state;
    const add = (type, x, y) => {
      if (!this.check(type, x, y).ok) return false;
      st.buildings.push({ id: st.nextId++, type, x, y, level: 1, done: true });
      this.rebuildOcc();
      return true;
    };
    // กำแพงเต็มแนว: หอคอยที่มุม + ทุก ๆ 10 ช่อง, ป้อมธนูฝั่งสนามรบ (ประตูเป็นซุ้มประตูอัตโนมัติ)
    const R = L.wallRadius;
    const wallCells = isl.cells.filter((c) => c.inside && c.zone === 'wall' && !c.gate && !c.road && !c.blocked);
    const rel = (c) => ({ u: c.x + 0.5 - isl.C, v: c.y + 0.5 - isl.C });
    for (const c of wallCells) {
      const { u, v } = rel(c);
      const corner = Math.abs(Math.abs(u) - R) < 0.1 && Math.abs(Math.abs(v) - R) < 0.1;
      const along = Math.abs(u) > Math.abs(v) ? v : u;
      if (corner || Math.abs(Math.abs(along) - 10.5) < 0.1) add('tower', c.x, c.y);
    }
    for (const c of wallCells) {
      const q = isl.toAC(rel(c).u, rel(c).v);
      if (q.a > R - 0.6 && Math.abs(Math.abs(q.c) - 5.5) < 0.1) add('archer', c.x, c.y);
    }
    for (const c of wallCells) add('wall', c.x, c.y);
    // อาคารในเมือง: หาจุดว่างใกล้ลานกลาง (ฝั่งหลังกำแพง ซ้ายบนของจอ)
    const list = []; // เมืองเริ่มต้นว่าง (มีแค่ Town Hall + กำแพง) — ใส่ชื่ออาคารที่นี่ถ้าอยากให้มีตั้งแต่เริ่ม
    const C = isl.C;
    const spots = [];
    for (let y = 1; y < this.G - 1; y++) for (let x = 1; x < this.G - 1; x++) {
      const u = x - C, v = y - C;
      const d = Math.max(Math.abs(u), Math.abs(v));
      if (d > L.wallRadius - 1.5) continue;
      spots.push({ x, y, k: Math.hypot(u + 2, v + 1) + (u + v > 6 ? 6 : 0) });
    }
    spots.sort((a, b) => a.k - b.k);
    for (const type of list) {
      const s = AR.BUILDINGS[type].size;
      for (const p of spots) {
        // เว้นระยะ 1 ช่องรอบอาคาร ให้ดูเป็นตรอกซอย
        let free = true;
        for (let y = p.y - 1; y <= p.y + s && free; y++) for (let x = p.x - 1; x <= p.x + s && free; x++) {
          const b = this.buildingAt(x, y); if (b) free = false;
        }
        if (free && add(type, p.x, p.y)) break;
      }
    }
  }
  fresh() {
    const th = this.island.townHall;
    return {
      v: 1,
      res: { coupon: 100, gold: 500, silver: 30000 },
      silverFrac: 0,
      buildings: [{ id: 1, type: 'townhall', x: th.x, y: th.y, level: 1, done: true }],
      nextId: 2,
      cleared: [],
      layout: this.key,
      player: { name: (AR.Net && AR.Net.player && AR.Net.player.name) || 'AbyssLord', lv: 1, exp: 0 },
      heroes: AR.SAMPLE_HEROES.map((h) => ({ ...h })),
      parties: [[], [], [], [], []], // ว่างจนกว่าจะสร้างค่าย
      quests: {},
      daily: '',
    };
  }
  // เมืองจากเซิร์ฟเวอร์: ใช้ได้เมื่อเป็นผังเกาะรุ่นเดียวกัน ไม่งั้นเริ่มใหม่
  fromRemote(s) {
    if (!s || s.v !== 1 || !Array.isArray(s.buildings) || s.layout !== this.key) return null;
    return s;
  }
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.v !== 1 || !Array.isArray(s.buildings)) return null;
      return s;
    } catch (e) { return null; }
  }
  save() {
    this.state.layout = this.key;
    if (AR.Net && AR.Net.online) { AR.Net.queueSave(() => ({ state: this.state, power: this.power() })); return; }
    try { localStorage.setItem(this.key, JSON.stringify(this.state)); } catch (e) { /* storage อาจถูกปิด */ }
  }
  reset() {
    try { localStorage.removeItem(this.key); } catch (e) { /* ignore */ }
  }
  on(fn) { this.listeners.push(fn); }
  emit(ev, data) { for (const f of this.listeners) f(ev, data); }

  get th() { return this.state.buildings.find((b) => b.type === 'townhall').level; }
  get townHall() { return this.state.buildings.find((b) => b.type === 'townhall'); }
  byId(id) { return this.state.buildings.find((b) => b.id === id); }
  count(type) { return this.state.buildings.filter((b) => b.type === type).length; }
  limit(type) { return AR.rules.limit(AR.BUILDINGS[type], this.th); }
  zoneUnlocked(zone) { return this.cfg.zones[zone].unlockTH <= this.th; }

  // ---------- Main Fortress (1.6 [ยืนยันแล้ว]) ----------
  // ซุ้มประตูฝั่งสนามรบ: ใช้ช่องประตูเป็นพื้นที่ของอาคาร · อัปเกรดต้องผ่านเงื่อนไขเลเวลปราสาท
  fortressCells() {
    if (this._fcells) return this._fcells;
    const isl = this.island, R = this.cfg.layout.wallRadius;
    this._fcells = isl.cells.filter((c) => {
      if (!c.gate) return false;
      const q = isl.toAC(c.x + 0.5 - isl.C, c.y + 0.5 - isl.C);
      return q.a > R - 1 && Math.abs(q.c) < Math.abs(q.a);
    });
    return this._fcells;
  }
  ensureFortress() {
    if (this.state.buildings.some((b) => b.type === 'fortress')) return;
    const cells = this.fortressCells();
    if (!cells.length) return;
    const mid = cells[Math.floor(cells.length / 2)];
    this.state.buildings.push({ id: this.state.nextId++, type: 'fortress', x: mid.x, y: mid.y, level: 1, done: true });
    this.rebuildOcc(); this.save();
  }
  get fortress() { return this.state.buildings.find((b) => b.type === 'fortress'); }

  rebuildOcc() {
    this.occ.fill(0);
    for (const b of this.state.buildings) {
      if (b.type === 'fortress') { for (const c of this.fortressCells()) this.occ[c.y * this.G + c.x] = b.id; continue; }
      const s = AR.BUILDINGS[b.type].size;
      for (let y = b.y; y < b.y + s; y++) for (let x = b.x; x < b.x + s; x++) this.occ[y * this.G + x] = b.id;
    }
  }
  buildingAt(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= this.G || gy >= this.G) return null;
    const id = this.occ[gy * this.G + gx];
    return id ? this.byId(id) : null;
  }

  affordable(cost) {
    for (const k in cost) if ((this.state.res[k] || 0) < cost[k]) return false;
    return true;
  }
  pay(cost, sign) {
    for (const k in cost) this.state.res[k] = (this.state.res[k] || 0) - sign * cost[k];
  }

  // ตรวจว่าเลือกสร้างประเภทนี้ได้ไหม (ก่อนเข้าโหมดวาง)
  canStart(type) {
    const def = AR.BUILDINGS[type];
    if (def.unique) return { ok: false, reason: 'มีได้แค่หลังเดียว' };
    if (this.th < def.unlockTH) return { ok: false, reason: `ต้องใช้ Town Hall Lv.${def.unlockTH}` };
    if (this.count(type) >= this.limit(type)) {
      if (type === 'camp') return { ok: false, reason: this.limit(type) >= AR.rules.maxCamps ? `ค่ายครบ ${AR.rules.maxCamps} แห่งแล้ว (สูงสุดทั้งเกม)` : `สร้างค่ายครบตามสิทธิ์ปราสาท Lv.${this.th} แล้ว (${this.limit(type)} แห่ง) — อัปปราสาทเพื่อเพิ่ม` };
      return { ok: false, reason: 'ครบจำนวนสูงสุดแล้ว (อัปปราสาทเพื่อเพิ่ม)' };
    }
    if (!this.affordable(def.cost)) return { ok: false, reason: 'ทรัพยากรไม่พอ' };
    return { ok: true };
  }

  // ตรวจแต่ละช่องของฐานอาคาร → ใช้วาดสีเขียว/แดง
  check(type, x0, y0, ignoreId) {
    const def = AR.BUILDINGS[type], s = def.size;
    const th = this.island.townHall;
    const cells = [];
    let reason = null;
    for (let y = y0; y < y0 + s; y++) {
      for (let x = x0; x < x0 + s; x++) {
        const c = this.island.cellAt(x, y);
        let r = null;
        if (!c || !c.inside) r = 'อยู่นอกพื้นที่สร้าง';
        else if (!this.zoneUnlocked(c.zone)) r = `${this.cfg.zones[c.zone].name} ยังล็อก (ต้องใช้ TH Lv.${this.cfg.zones[c.zone].unlockTH})`;
        else if (!def.zones.includes(c.zone)) r = `${def.name} วางใน${this.cfg.zones[c.zone].name}ไม่ได้`;
        else if (c.gate) r = 'ช่องประตูเมือง — ต้องเว้นไว้';
        else if (c.road) r = 'ทับถนน';
        else if (c.blocked) r = 'มีต้นไม้/หินขวาง — คลิกเพื่อเคลียร์ก่อน';
        else if (type !== 'townhall' && x >= th.x && x < th.x + th.w && y >= th.y && y < th.y + th.h) r = 'พื้นที่ของ Town Hall';
        else {
          const id = this.occ[y * this.G + x];
          if (id && id !== ignoreId) r = 'ทับสิ่งก่อสร้างอื่น';
        }
        cells.push({ x, y, ok: !r });
        if (r && !reason) reason = r;
      }
    }
    return { ok: !reason, reason, cells };
  }

  place(type, x, y) {
    const def = AR.BUILDINGS[type];
    const st = this.canStart(type);
    if (!st.ok) return st;
    const chk = this.check(type, x, y);
    if (!chk.ok) return chk;
    this.pay(def.cost, 1);
    const now = Date.now();
    const b = { id: this.state.nextId++, type, x, y, level: 1, done: false, start: now, end: now + def.time * 1000 };
    this.state.buildings.push(b);
    this.rebuildOcc();
    this.save();
    this.emit('add', b);
    return { ok: true, building: b };
  }
  move(id, x, y) {
    const b = this.byId(id);
    const chk = this.check(b.type, x, y, id);
    if (!chk.ok) return chk;
    b.x = x; b.y = y;
    this.rebuildOcc(); this.save();
    this.emit('move', b);
    return { ok: true };
  }
  demolish(id) {
    const b = this.byId(id);
    if (!b || b.type === 'townhall') return { ok: false, reason: 'รื้อปราสาทเจ้าเมืองไม่ได้' };
    if (AR.BUILDINGS[b.type].fixed) return { ok: false, reason: `รื้อ${AR.BUILDINGS[b.type].name}ไม่ได้` };
    if (b.type === 'camp' && (b.done || b.upgrading)) {
      const last = this.activeParties() - 1;   // รื้อค่าย → ปาร์ตี้สุดท้ายที่ใช้งานได้จะถูกปิด
      if (last >= 0 && this.state.parties[last].length) return { ok: false, reason: `นำฮีโร่ออกจากปาร์ตี้ ${last + 1} ก่อน แล้วค่อยรื้อค่าย` };
    }
    const refund = this.refund(b);
    this.pay(refund, -1);
    this.state.buildings = this.state.buildings.filter((o) => o.id !== id);
    this.rebuildOcc(); this.save();
    this.emit('remove', b);
    return { ok: true, refund };
  }
  refund(b) {
    const def = AR.BUILDINGS[b.type], r = {};
    for (const k in def.cost) r[k] = Math.floor(def.cost[k] * 0.5);
    return r;
  }
  upgradeInfo(b) {
    const def = AR.BUILDINGS[b.type];
    if (b.type === 'townhall') {
      if (b.level >= AR.rules.maxTH) return { max: true };
      return AR.rules.thUpgrade(b.level);
    }
    if (b.type === 'fortress') {
      if (b.level >= AR.rules.maxFortress) return { max: true };
      const need = AR.rules.fortressNeedTH(b.level + 1);
      if (this.th < need) return { blocked: `ต้องอัปปราสาทเจ้าเมืองเป็น Lv.${need} ก่อน`, needTH: need };
      return AR.rules.upgrade(def, b.level);
    }
    if (b.level >= this.th) return { blocked: `อัป Town Hall ก่อน (เลเวลอาคารต้องไม่เกิน TH)` };
    return AR.rules.upgrade(def, b.level);
  }
  upgrade(id) {
    const b = this.byId(id);
    if (!b.done) return { ok: false, reason: 'กำลังก่อสร้างอยู่' };
    const info = this.upgradeInfo(b);
    if (info.max) return { ok: false, reason: 'เลเวลสูงสุดแล้ว' };
    if (info.blocked) return { ok: false, reason: info.blocked };
    if (!this.affordable(info.cost)) return { ok: false, reason: 'ทรัพยากรไม่พอ' };
    this.pay(info.cost, 1);
    const now = Date.now();
    Object.assign(b, { done: false, upgrading: true, start: now, end: now + info.time * 1000 });
    this.save();
    this.emit('update', b);
    return { ok: true };
  }
  speedUp(id) {
    const b = this.byId(id);
    if (!b || b.done) return { ok: false };
    const cost = { coupon: Math.max(1, Math.ceil((b.end - Date.now()) / 10000)) };
    if (!this.affordable(cost)) return { ok: false, reason: 'Coupon ไม่พอ' };
    this.pay(cost, 1);
    b.end = Date.now();
    this.tick(0);
    return { ok: true };
  }
  clearCost() { return { silver: 200 }; }
  clearObstacle(idx) {
    const c = this.island.cells[idx];
    if (!c || !c.blocked) return { ok: false };
    if (!this.zoneUnlocked(c.zone)) return { ok: false, reason: `โซนยังล็อก (TH Lv.${this.cfg.zones[c.zone].unlockTH})` };
    const cost = this.clearCost();
    if (!this.affordable(cost)) return { ok: false, reason: 'Silver ไม่พอ' };
    this.pay(cost, 1);
    c.blocked = false; c.deco = null;
    this.state.cleared.push(idx);
    this.save();
    this.emit('clear', idx);
    return { ok: true };
  }

  // ---------- ผู้เล่น / ฮีโร่ / ปาร์ตี้ ----------
  expNeed(lv) { return 60 + lv * 40; }
  gainExp(n) {
    const p = this.state.player;
    p.exp += n;
    while (p.exp >= this.expNeed(p.lv)) { p.exp -= this.expNeed(p.lv); p.lv++; this.emit('player', p.lv); }
  }
  // ---------- ปาร์ตี้ & แคมป์ (1.3 [ยืนยันแล้ว]) ----------
  // ปาร์ตี้ใช้งานได้ = min(สิทธิ์จากปราสาท, ค่ายที่สร้างเสร็จแล้ว) · ค่ายไม่สร้างให้อัตโนมัติ
  campsBuilt() { return this.state.buildings.filter((b) => b.type === 'camp' && (b.done || b.upgrading)).length; }
  campsAllowed() { return Math.min(AR.TOWN_HALL[this.th - 1].camps, AR.rules.maxCamps); }
  activeParties() { return Math.min(AR.rules.partySlots(this.th), this.campsBuilt(), AR.rules.maxCamps); }
  heroCapacity() { return this.activeParties() * AR.rules.heroesPerCamp; }
  campList() { return this.state.buildings.filter((b) => b.type === 'camp').sort((a, b) => a.id - b.id); }
  partyState(i) {
    if (i >= AR.rules.partySlots(this.th)) return { state: 'needTH', reason: `ปาร์ตี้ ${i + 1} ปลดล็อกที่ปราสาท Lv.${AR.rules.partyUnlockTH(i)}` };
    if (i >= this.campsBuilt()) {
      const building = this.campList().length > this.campsBuilt();
      return { state: 'needCamp', reason: building && i === this.campsBuilt() ? `ค่ายของปาร์ตี้ ${i + 1} กำลังก่อสร้าง` : `ต้องสร้างค่ายปาร์ตี้ฮีโร่ก่อน (ปาร์ตี้ 1 ทีม = ค่าย 1 แห่ง)` };
    }
    return { state: 'active' };
  }
  hero(id) { return this.state.heroes.find((h) => h.id === id); }
  heroPower(h) { return Math.round(h.lv * 1150 + AR.HERO_CLASSES[h.cls].pow * h.lv); }
  power() {
    let p = this.th * 4000;
    for (const party of this.state.parties.slice(0, this.activeParties())) for (const id of party) { const h = this.hero(id); if (h) p += this.heroPower(h); }
    return p;
  }
  assignHero(partyIdx, heroId) {
    const ps = this.partyState(partyIdx);
    if (ps.state !== 'active') return { ok: false, reason: ps.reason };
    const P = this.state.parties;
    for (const p of P) { const i = p.indexOf(heroId); if (i >= 0) p.splice(i, 1); }
    if (P[partyIdx].length >= AR.rules.heroesPerCamp) return { ok: false, reason: `ค่ายเต็มแล้ว (ค่าย 1 แห่งรองรับ ${AR.rules.heroesPerCamp} ฮีโร่)` };
    P[partyIdx].push(heroId);
    this.save();
    return { ok: true };
  }
  unassignHero(heroId) {
    for (const p of this.state.parties) { const i = p.indexOf(heroId); if (i >= 0) p.splice(i, 1); }
    this.save();
  }

  // ---------- ภารกิจ / กิจกรรม ----------
  questList() {
    const cnt = (t) => this.state.buildings.filter((b) => b.type === t && (b.done || b.upgrading)).length;
    const Q = [
      { id: 'camp1', name: 'สร้างค่ายปาร์ตี้ฮีโร่แห่งแรก (เปิดใช้ปาร์ตี้ 1)', cur: cnt('camp'), need: 1, reward: { silver: 1000 } },
      { id: 'farm1', name: 'สร้างฟาร์ม 2 แห่ง', cur: cnt('farm'), need: 2, reward: { silver: 1500 } },
      { id: 'th2', name: 'อัปปราสาทเจ้าเมืองเป็น Lv.2', cur: this.th, need: 2, reward: { gold: 30 } },
      { id: 'research', name: 'สร้างหอวิจัย', cur: cnt('research'), need: 1, reward: { silver: 2000 } },
      { id: 'clear3', name: 'เคลียร์ต้นไม้/หิน 3 จุด', cur: this.state.cleared.length, need: 3, reward: { silver: 800 } },
      { id: 'trap3', name: 'วางกับดักหนามในสนามรบ 3 อัน', cur: cnt('trap'), need: 3, reward: { coupon: 10 } },
      { id: 'th4', name: 'อัปปราสาทเจ้าเมืองเป็น Lv.4 (ปราสาทหลังใหญ่ + ปาร์ตี้ 5)', cur: this.th, need: 4, reward: { coupon: 50, gold: 100 } },
      { id: 'camp2', name: 'สร้างค่ายปาร์ตี้ฮีโร่ 2 แห่ง', cur: cnt('camp'), need: 2, reward: { silver: 2000 } },
      { id: 'crystal', name: 'สร้างป้อมปราการผลึก', cur: cnt('crystal'), need: 1, reward: { gold: 80 } },
    ];
    for (const q of Q) { q.done = q.cur >= q.need; q.claimed = !!this.state.quests[q.id]; }
    return Q;
  }
  claimQuest(id) {
    const q = this.questList().find((x) => x.id === id);
    if (!q || !q.done || q.claimed) return { ok: false };
    this.pay(q.reward, -1); this.state.quests[id] = true; this.save();
    return { ok: true, reward: q.reward };
  }
  // ---------- City Protection (1.4 [ยืนยันแล้ว]) ----------
  // เวลาต่อวันตามเลเวลปราสาท · ลดลงเฉพาะตอนเปิด (รวมตอนออฟไลน์) · ปิดแล้วเก็บเวลาที่เหลือ
  // ห้ามเปิดระหว่างต่อสู้ PVB · ใช้ครบแล้วต้องรอรีเซ็ต (เที่ยงคืนตามเวลาเครื่อง)
  protState() {
    if (!this.state.protect) this.state.protect = { day: this.today(), usedMs: 0, on: false, since: 0 };
    return this.state.protect;
  }
  protAllowanceMs() { return AR.rules.shieldHours(this.th) * 3600e3; }
  protUsedMs(now) {
    const p = this.protState(); now = now || Date.now();
    return p.usedMs + (p.on ? Math.max(0, now - p.since) : 0);
  }
  protRemainingMs(now) { return Math.max(0, this.protAllowanceMs() - this.protUsedMs(now)); }
  isProtected() { this.protUpdate(); return this.protState().on; }   // ใช้เช็คก่อนถูกเลือกเป็นเป้า PVB
  nextResetMs() { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); }
  protUpdate() {
    const p = this.protState(), now = Date.now(), today = this.today();
    if (p.day !== today) {                       // รอบรีเซ็ตใหม่
      const mid = new Date(); mid.setHours(0, 0, 0, 0);
      p.day = today; p.usedMs = 0;
      if (p.on) p.since = Math.max(p.since, mid.getTime());
      this.save();
    }
    if (p.on && this.protRemainingMs(now) <= 0) { // หมดเวลาของวันนี้ (นับต่อแม้ออฟไลน์)
      p.usedMs = this.protAllowanceMs(); p.on = false; p.since = 0;
      this.save(); this.emit('protect', 'expired');
    }
  }
  setProtection(on, inBattle) {
    this.protUpdate();
    const p = this.protState();
    if (on === p.on) return { ok: true };
    if (on) {
      if (inBattle) return { ok: false, reason: 'เปิด City Protection ระหว่างการต่อสู้ PVB ไม่ได้' };
      if (this.protAllowanceMs() <= 0) return { ok: false, reason: `ปราสาท Lv.${this.th} ยังไม่มีเวลาป้องกัน — อัปเป็น Lv.2 เพื่อได้ 2 ชม./วัน` };
      if (this.protRemainingMs() <= 0) return { ok: false, reason: 'ใช้เวลาป้องกันของวันนี้ครบแล้ว — รอรอบรีเซ็ตใหม่' };
      p.on = true; p.since = Date.now();
    } else {
      p.usedMs = this.protUsedMs(); p.on = false; p.since = 0;   // เก็บเวลาที่เหลือไว้ใช้ต่อ
    }
    this.save(); this.emit('protect', on ? 'on' : 'off');
    return { ok: true };
  }
  today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
  // ---------- รางวัลประจำวันของปราสาทเจ้าเมือง [ยืนยันแล้ว] ----------
  // ออนไลน์: เซิร์ฟเวอร์ตรวจสิทธิ์และให้รางวัลตามเวลาเซิร์ฟเวอร์ · ออฟไลน์: ตรวจในเครื่อง
  thDailyReward(th) { const r = AR.TH_DAILY[Math.min(th || this.th, 5) - 1]; return { silver: r.silver, gold: r.gold, coupon: r.coupon }; }
  dailyReady() {
    if (AR.Net && AR.Net.online) return !(AR.Net.daily && AR.Net.daily.claimed);
    return this.state.thDaily !== this.today();
  }
  async claimDaily() {
    if (!this.dailyReady()) return { ok: false, reason: 'รับรางวัลประจำวันไปแล้ว — รอรอบรีเซ็ตใหม่' };
    if (AR.Net && AR.Net.online) {
      AR.Net.flush();                                  // ให้เซิร์ฟเวอร์เห็นเลเวลปราสาทล่าสุดก่อน
      await new Promise((r) => setTimeout(r, 300));
      const j = await AR.Net.claimDaily().catch(() => ({ ok: false, error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' }));
      if (!j.ok) { if (j.nextReset) AR.Net.daily = { claimed: true, nextReset: j.nextReset }; return { ok: false, reason: j.error }; }
      AR.Net.daily = { claimed: true, nextReset: j.nextReset };
      this.pay(j.reward, -1); this.state.thDaily = this.today(); this.save();
      return { ok: true, reward: j.reward, th: j.th };
    }
    const r = this.thDailyReward();
    this.pay(r, -1); this.state.thDaily = this.today(); this.save();
    return { ok: true, reward: r, th: this.th };
  }

  productionPerMin() {
    let s = 0;
    for (const b of this.state.buildings) {
      const def = AR.BUILDINGS[b.type];
      if (def.prod && (b.done || b.upgrading)) s += def.prod * b.level;
    }
    return s;
  }
  // เรียกทุกเฟรม: เก็บผลผลิต + ปิดงานก่อสร้างที่ครบเวลา
  tick(dt) {
    if (Date.now() - (this.protChecked || 0) > 1000) { this.protChecked = Date.now(); this.protUpdate(); }
    const now = Date.now();
    for (const b of this.state.buildings) {
      if (!b.done && b.end <= now) {
        b.done = true;
        if (b.upgrading) { b.level++; b.upgrading = false; }
        delete b.start; delete b.end;
        this.gainExp(10 * b.level * AR.BUILDINGS[b.type].size);
        this.save();
        this.emit('done', b);
      }
    }
    this.state.silverFrac += (this.productionPerMin() / 60) * dt;
    if (this.state.silverFrac >= 1) {
      const n = Math.floor(this.state.silverFrac);
      this.state.res.silver += n; this.state.silverFrac -= n;
      this.dirtySave = (this.dirtySave || 0) + dt;
    }
    if (this.dirtySave > 5) { this.dirtySave = 0; this.save(); }
  }
};
