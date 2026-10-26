// =============================================================
//  Abyssal Rift — Cloudflare Worker (ออนไลน์ 24 ชม. ฟรี)
//  - ไฟล์เกม (index.html, js, assets) เสิร์ฟผ่าน Workers Static Assets
//  - /api/* รันที่นี่ เก็บข้อมูลใน Cloudflare D1 (SQLite บนคลาวด์)
//  - API เหมือน server/server.js ทุกอย่าง → ตัวเกมไม่ต้องแก้
//  Deploy:  npx wrangler login   แล้ว   npx wrangler deploy
// =============================================================

// รางวัลประจำวันของปราสาทเจ้าเมือง (ต้องตรงกับ AR.TH_DAILY ใน js/buildings.js)
const TH_DAILY = [
  { lv: 1, silver: 2000,  gold: 0,  coupon: 0 },
  { lv: 2, silver: 4000,  gold: 10, coupon: 0 },
  { lv: 3, silver: 7000,  gold: 20, coupon: 5 },
  { lv: 4, silver: 11000, gold: 35, coupon: 10 },
  { lv: 5, silver: 16000, gold: 50, coupon: 20 },
];

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS players (
     id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
     created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL,
     th INTEGER NOT NULL DEFAULT 1, power INTEGER NOT NULL DEFAULT 0,
     daily_day TEXT, state TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_players_seen ON players(last_seen)`,
];
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  schemaReady = true;
}

// วันที่/เวลารีเซ็ตรายวันตามเขตเวลาเกม (ค่าเริ่มต้น UTC+7 = เวลาไทย)
const offMs = (env) => (Number(env.TZ_OFFSET_HOURS ?? 7)) * 3600e3;
function today(env) { const d = new Date(Date.now() + offMs(env)); return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`; }
function nextReset(env) { const d = new Date(Date.now() + offMs(env)); d.setUTCHours(24, 0, 0, 0); return d.getTime() - offMs(env); }

const pub = (p) => ({ id: p.id, name: p.name, th: p.th, power: p.power, lastSeen: p.last_seen, online: Date.now() - p.last_seen < 90e3 });
const cleanName = (s) => String(s || '').replace(/[<>&"'`\\\u0000-\u001f]/g, '').trim().slice(0, 16);
const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const thOf = (st) => Math.max(1, Math.min(5, ((st.buildings || []).find((b) => b.type === 'townhall') || {}).level || 1));
function randHex(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map((x) => x.toString(16).padStart(2, '0')).join(''); }
async function body(req) {
  const t = await req.text();
  if (t.length > 2e6) throw new Error('too large');
  return t ? JSON.parse(t) : {};
}

async function api(req, env, url) {
  const db = env.DB, now = Date.now();
  await ensureSchema(db);

  // ---- Guest Login
  if (req.method === 'POST' && url.pathname === '/api/guest') {
    const b = await body(req);
    let p = b.token ? await db.prepare('SELECT * FROM players WHERE token = ?').bind(String(b.token)).first() : null;
    let created = false;
    if (!p) {
      const id = crypto.randomUUID(), token = randHex(24);
      const name = cleanName(b.name) || 'Guest' + (1000 + Math.floor(Math.random() * 9000));
      await db.prepare('INSERT INTO players (id, token, name, created_at, last_seen) VALUES (?, ?, ?, ?, ?)').bind(id, token, name, now, now).run();
      p = await db.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
      created = true;
    } else await db.prepare('UPDATE players SET last_seen = ? WHERE id = ?').bind(now, p.id).run();
    return json(200, {
      ok: true, created, token: p.token, player: pub(p),
      state: p.state ? JSON.parse(p.state) : null,
      daily: { claimed: p.daily_day === today(env), nextReset: nextReset(env) }, serverTime: now,
    });
  }

  const h = req.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const me = token ? await db.prepare('SELECT * FROM players WHERE token = ?').bind(token).first() : null;
  if (!me) return json(401, { ok: false, error: 'ต้องเข้าสู่ระบบ' });

  // ---- บันทึกเมือง
  if (req.method === 'PUT' && url.pathname === '/api/state') {
    const b = await body(req), st = b.state;
    if (!st || typeof st !== 'object' || !Array.isArray(st.buildings)) return json(400, { ok: false, error: 'ข้อมูลไม่ถูกต้อง' });
    st.thDaily = me.daily_day || null;
    await db.prepare('UPDATE players SET state = ?, th = ?, power = ?, last_seen = ? WHERE id = ?')
      .bind(JSON.stringify(st), thOf(st), Math.max(0, Math.floor(+b.power || 0)), now, me.id).run();
    return json(200, { ok: true, serverTime: now });
  }
  if (req.method === 'POST' && url.pathname === '/api/ping') {
    await db.prepare('UPDATE players SET last_seen = ? WHERE id = ?').bind(now, me.id).run();
    return json(200, { ok: true, serverTime: now });
  }
  if (req.method === 'POST' && url.pathname === '/api/name') {
    const n = cleanName((await body(req)).name);
    if (n.length < 2) return json(400, { ok: false, error: 'ชื่อต้องยาว 2–16 ตัวอักษร' });
    await db.prepare('UPDATE players SET name = ? WHERE id = ?').bind(n, me.id).run();
    return json(200, { ok: true, name: n });
  }
  if (req.method === 'GET' && url.pathname === '/api/players') {
    const { results } = await db.prepare('SELECT id, name, th, power, last_seen FROM players ORDER BY last_seen DESC LIMIT 100').all();
    const total = (await db.prepare('SELECT COUNT(*) AS n FROM players').first()).n;
    return json(200, { ok: true, me: me.id, total, players: results.map(pub) });
  }
  // ---- รางวัลประจำวันของปราสาท (ตรวจที่เซิร์ฟเวอร์ ตามเวลาเซิร์ฟเวอร์)
  if (req.method === 'POST' && url.pathname === '/api/daily') {
    const day = today(env);
    if (me.daily_day === day) return json(409, { ok: false, error: 'รับรางวัลวันนี้ไปแล้ว', nextReset: nextReset(env) });
    const st = me.state ? JSON.parse(me.state) : null;
    if (!st) return json(409, { ok: false, error: 'ยังไม่มีข้อมูลเมือง' });
    const th = thOf(st), r = TH_DAILY[th - 1], reward = { silver: r.silver, gold: r.gold, coupon: r.coupon };
    st.res = st.res || {};
    for (const k of Object.keys(reward)) st.res[k] = (st.res[k] || 0) + reward[k];
    st.thDaily = day;
    // กันกดรับซ้ำพร้อมกัน: อัปเดตเฉพาะเมื่อยังไม่ได้รับของวันนี้
    const r2 = await db.prepare('UPDATE players SET daily_day = ?, state = ? WHERE id = ? AND (daily_day IS NULL OR daily_day != ?)')
      .bind(day, JSON.stringify(st), me.id, day).run();
    if (!r2.meta || r2.meta.changes === 0) return json(409, { ok: false, error: 'รับรางวัลวันนี้ไปแล้ว', nextReset: nextReset(env) });
    return json(200, { ok: true, th, reward, res: st.res, nextReset: nextReset(env) });
  }
  return json(404, { ok: false, error: 'not found' });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await api(req, env, url); }
      catch (e) { console.error(e); return json(500, { ok: false, error: 'server error' }); }
    }
    return env.ASSETS.fetch(req);
  },
};
