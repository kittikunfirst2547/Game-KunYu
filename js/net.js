// =============================================================
//  Network: Guest Login + บันทึกเมืองลงฐานข้อมูลบนเซิร์ฟเวอร์
//  - เปิดผ่านเซิร์ฟเวอร์ (http://...) → ออนไลน์ เก็บข้อมูลใน Database
//  - เปิดจากไฟล์ (file://) หรือเซิร์ฟเวอร์ไม่ตอบ → โหมดออฟไลน์ (เก็บในเบราว์เซอร์)
// =============================================================
window.AR = window.AR || {};

AR.Net = {
  online: false,
  token: null,
  player: null,
  daily: null,
  KEY: 'abyssal-rift-guest',

  canOnline() { return location.protocol === 'http:' || location.protocol === 'https:'; },
  saved() { try { return JSON.parse(localStorage.getItem(this.KEY)) || null; } catch (e) { return null; } },
  remember() { try { localStorage.setItem(this.KEY, JSON.stringify({ token: this.token, name: this.player.name })); } catch (e) { /* ignore */ } },
  forget() { try { localStorage.removeItem(this.KEY); } catch (e) { /* ignore */ } },

  async req(method, url, body) {
    const r = await fetch(url, {
      method, headers: Object.assign({ 'Content-Type': 'application/json' }, this.token ? { Authorization: 'Bearer ' + this.token } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({ ok: false, error: 'bad response' }));
    if (!r.ok && j.ok !== false) j.ok = false;
    return j;
  },

  // Guest Login: ใช้ token เดิม (เมืองเดิม) หรือสร้าง Guest ใหม่
  async login(fresh) {
    const prev = fresh ? null : this.saved();
    const j = await this.req('POST', '/api/guest', { token: prev && prev.token });
    if (!j.ok) throw new Error(j.error || 'login failed');
    this.online = true; this.token = j.token; this.player = j.player; this.daily = j.daily;
    this.remember();
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => this.req('POST', '/api/ping').catch(() => {}), 30000);
    window.addEventListener('beforeunload', () => this.flush());
    return j;
  },

  // บันทึกแบบหน่วงเวลา (รวมหลายการเปลี่ยนแปลงเป็นครั้งเดียว)
  queueSave(getPayload) {
    if (!this.online) return;
    this.getPayload = getPayload;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 1500);
  },
  flush() {
    if (!this.online || !this.getPayload) return;
    clearTimeout(this.saveTimer);
    const body = JSON.stringify(this.getPayload());
    this.getPayload = null;
    // keepalive ให้ส่งได้แม้กำลังปิดหน้า
    fetch('/api/state', { method: 'PUT', keepalive: body.length < 60000, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.token }, body })
      .then((r) => { this.setStatus(r.ok); }).catch(() => this.setStatus(false));
  },
  setStatus(ok) {
    const el = document.getElementById('net');
    if (el) { el.classList.toggle('bad', !ok); el.title = ok ? 'บันทึกบนเซิร์ฟเวอร์แล้ว' : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — จะลองใหม่ตอนบันทึกครั้งถัดไป'; }
  },
  claimDaily() { return this.req('POST', '/api/daily'); },
  players() { return this.req('GET', '/api/players'); },
  rename(name) { return this.req('POST', '/api/name', { name }); },
};
