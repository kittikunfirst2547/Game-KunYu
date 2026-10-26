// =============================================================
//  Abyssal Rift — Game Server (ไม่ต้อง npm install)
//  - เสิร์ฟไฟล์เกม (index.html, js, assets) ผ่าน http
//  - REST API: Guest Login, บันทึกเมือง, รายชื่อผู้เล่น, รางวัลประจำวันของปราสาท
//  - ฐานข้อมูล: SQLite (node:sqlite ใน Node 22.13+) → ถ้าไม่มี ใช้ไฟล์ JSON แทน
//
//  เริ่ม:  node server/server.js            (หรือดับเบิลคลิก start-server.bat)
//  ตั้งค่า: PORT=3000  DB_FILE=server/data/abyssal.db
// =============================================================
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PORT = +process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// -------------------------------------------------------------
//  รางวัลประจำวันของปราสาทเจ้าเมือง [ยืนยันแล้ว: เลเวลมีผลต่อคุณภาพ/จำนวน]
//  ตัวเลขด้านล่างเป็นค่าเริ่มต้น — แก้ได้ (ต้องตรงกับ AR.TH_DAILY ใน js/buildings.js)
// -------------------------------------------------------------
const TH_DAILY = [
  { lv: 1, silver: 2000,  gold: 0,  coupon: 0 },
  { lv: 2, silver: 4000,  gold: 10, coupon: 0 },
  { lv: 3, silver: 7000,  gold: 20, coupon: 5 },
  { lv: 4, silver: 11000, gold: 35, coupon: 10 },
  { lv: 5, silver: 16000, gold: 50, coupon: 20 },
];

// -------------------------------------------------------------
//  Database layer
// -------------------------------------------------------------
function openDb() {
  try {
    process.removeAllListeners('warning');
    const { DatabaseSync } = require('node:sqlite');
    const file = process.env.DB_FILE || path.join(DATA_DIR, 'abyssal.db');
    const db = new DatabaseSync(file);
    db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id          TEXT PRIMARY KEY,
        token       TEXT UNIQUE NOT NULL,
        name        TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        last_seen   INTEGER NOT NULL,
        th          INTEGER NOT NULL DEFAULT 1,
        power       INTEGER NOT NULL DEFAULT 0,
        daily_day   TEXT,
        state       TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_players_seen ON players(last_seen);`);
    const st = {
      byToken: db.prepare('SELECT * FROM players WHERE token = ?'),
      insert: db.prepare('INSERT INTO players (id, token, name, created_at, last_seen) VALUES (?, ?, ?, ?, ?)'),
      seen: db.prepare('UPDATE players SET last_seen = ? WHERE id = ?'),
      save: db.prepare('UPDATE players SET state = ?, th = ?, power = ?, last_seen = ? WHERE id = ?'),
      rename: db.prepare('UPDATE players SET name = ? WHERE id = ?'),
      daily: db.prepare('UPDATE players SET daily_day = ?, state = ? WHERE id = ?'),
      list: db.prepare('SELECT id, name, th, power, last_seen FROM players ORDER BY last_seen DESC LIMIT 100'),
      count: db.prepare('SELECT COUNT(*) AS n FROM players'),
    };
    return {
      kind: 'SQLite (' + path.relative(ROOT, file) + ')',
      byToken: (t) => st.byToken.get(t),
      create: (p) => st.insert.run(p.id, p.token, p.name, p.created_at, p.last_seen),
      touch: (id, t) => st.seen.run(t, id),
      save: (id, state, th, power, t) => st.save.run(state, th, power, t, id),
      rename: (id, n) => st.rename.run(n, id),
      setDaily: (id, day, state) => st.daily.run(day, state, id),
      list: () => st.list.all(),
      count: () => st.count.get().n,
    };
  } catch (e) {
    // ---- JSON fallback (Node รุ่นเก่า) ----
    const file = path.join(DATA_DIR, 'abyssal.json');
    let data = { players: {} };
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { /* new file */ }
    let timer = null;
    const flush = () => { clearTimeout(timer); timer = setTimeout(() => fs.writeFileSync(file, JSON.stringify(data)), 300); };
    const all = () => Object.values(data.players);
    return {
      kind: 'JSON file (' + path.relative(ROOT, file) + ') — อัป Node เป็น 22.13+ เพื่อใช้ SQLite',
      byToken: (t) => all().find((p) => p.token === t),
      create: (p) => { data.players[p.id] = { ...p, th: 1, power: 0, daily_day: null, state: null }; flush(); },
      touch: (id, t) => { data.players[id].last_seen = t; flush(); },
      save: (id, state, th, power, t) => { Object.assign(data.players[id], { state, th, power, last_seen: t }); flush(); },
      rename: (id, n) => { data.players[id].name = n; flush(); },
      setDaily: (id, day, state) => { Object.assign(data.players[id], { daily_day: day, state }); flush(); },
      list: () => all().sort((a, b) => b.last_seen - a.last_seen).slice(0, 100),
      count: () => all().length,
    };
  }
}
const db = openDb();

// -------------------------------------------------------------
//  helpers
// -------------------------------------------------------------
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const nextReset = () => { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); };
const pub = (p) => ({ id: p.id, name: p.name, th: p.th, power: p.power, lastSeen: p.last_seen, online: Date.now() - p.last_seen < 90e3 });
const cleanName = (s) => String(s || '').replace(/[<>&"'`\\\u0000-\u001f]/g, '').trim().slice(0, 16);

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req, limit = 2e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function auth(req) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  return t ? db.byToken(t) : null;
}

// -------------------------------------------------------------
//  API
// -------------------------------------------------------------
async function api(req, res, url) {
  const now = Date.now();
  // ---- Guest Login: ส่ง token เดิมมา → เข้าเมืองเดิม · ไม่มี/ไม่เจอ → สร้าง Guest ใหม่
  if (req.method === 'POST' && url.pathname === '/api/guest') {
    const body = await readBody(req);
    let p = body.token ? db.byToken(String(body.token)) : null;
    let created = false;
    if (!p) {
      const id = crypto.randomUUID();
      const token = crypto.randomBytes(24).toString('hex');
      const name = cleanName(body.name) || 'Guest' + (1000 + crypto.randomInt(9000));
      db.create({ id, token, name, created_at: now, last_seen: now });
      p = db.byToken(token); created = true;
    } else db.touch(p.id, now);
    return json(res, 200, {
      ok: true, created, token: p.token, player: pub(p),
      state: p.state ? JSON.parse(p.state) : null,
      daily: { claimed: p.daily_day === today(), nextReset: nextReset() }, serverTime: now,
    });
  }
  const me = auth(req);
  if (!me) return json(res, 401, { ok: false, error: 'ต้องเข้าสู่ระบบ' });

  // ---- บันทึกเมือง
  if (req.method === 'PUT' && url.pathname === '/api/state') {
    const body = await readBody(req);
    const st = body.state;
    if (!st || typeof st !== 'object' || !Array.isArray(st.buildings)) return json(res, 400, { ok: false, error: 'ข้อมูลไม่ถูกต้อง' });
    const th = Math.max(1, Math.min(5, (st.buildings.find((b) => b.type === 'townhall') || {}).level || 1));
    st.thDaily = me.daily_day || null;   // สิทธิ์รับรางวัลเก็บที่เซิร์ฟเวอร์ ไคลเอนต์แก้ไม่ได้
    db.save(me.id, JSON.stringify(st), th, Math.max(0, +body.power || 0), now);
    return json(res, 200, { ok: true, serverTime: now });
  }
  // ---- heartbeat (บอกว่าออนไลน์)
  if (req.method === 'POST' && url.pathname === '/api/ping') { db.touch(me.id, now); return json(res, 200, { ok: true, serverTime: now }); }

  // ---- เปลี่ยนชื่อ
  if (req.method === 'POST' && url.pathname === '/api/name') {
    const n = cleanName((await readBody(req)).name);
    if (n.length < 2) return json(res, 400, { ok: false, error: 'ชื่อต้องยาว 2–16 ตัวอักษร' });
    db.rename(me.id, n);
    return json(res, 200, { ok: true, name: n });
  }
  // ---- รายชื่อผู้เล่น (ใช้ต่อกับ PVB ภายหลัง)
  if (req.method === 'GET' && url.pathname === '/api/players') {
    return json(res, 200, { ok: true, me: me.id, total: db.count(), players: db.list().map(pub) });
  }
  // ---- รางวัลประจำวันของปราสาทเจ้าเมือง (ตรวจและให้ที่เซิร์ฟเวอร์ ตามเวลาเซิร์ฟเวอร์)
  if (req.method === 'POST' && url.pathname === '/api/daily') {
    if (me.daily_day === today()) return json(res, 409, { ok: false, error: 'รับรางวัลวันนี้ไปแล้ว', nextReset: nextReset() });
    const st = me.state ? JSON.parse(me.state) : null;
    if (!st) return json(res, 409, { ok: false, error: 'ยังไม่มีข้อมูลเมือง' });
    const th = Math.max(1, Math.min(5, (st.buildings.find((b) => b.type === 'townhall') || {}).level || 1));
    const r = TH_DAILY[th - 1], reward = { silver: r.silver, gold: r.gold, coupon: r.coupon };
    st.res = st.res || {};
    for (const k of Object.keys(reward)) st.res[k] = (st.res[k] || 0) + reward[k];
    st.thDaily = today();
    db.setDaily(me.id, today(), JSON.stringify(st));
    return json(res, 200, { ok: true, th, reward, res: st.res, nextReset: nextReset() });
  }
  return json(res, 404, { ok: false, error: 'not found' });
}

// -------------------------------------------------------------
//  static files
// -------------------------------------------------------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.resolve(ROOT, '.' + rel);
  if (!file.startsWith(ROOT + path.sep) || file.startsWith(path.join(ROOT, 'server') + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(file, (err, s) => {
    if (err || !s.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': s.size, 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { ok: false, error: 'server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
  console.log('\n  ABYSSAL RIFT server พร้อมแล้ว');
  console.log('  ฐานข้อมูล : ' + db.kind + ' · ผู้เล่น ' + db.count() + ' คน');
  console.log('  เล่นบนเครื่องนี้ : http://localhost:' + PORT);
  for (const ip of ips) console.log('  ผู้เล่นอื่นในวง LAN/Wi-Fi เดียวกัน : http://' + ip + ':' + PORT);
  console.log('  (กด Ctrl+C เพื่อปิดเซิร์ฟเวอร์)\n');
});
