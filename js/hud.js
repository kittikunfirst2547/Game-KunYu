// =============================================================
//  HUD — จัดตำแหน่งตามภาพตัวอย่าง
//  บนซ้าย: โปรไฟล์ · บนกลาง: ทรัพยากร · บนขวา: ไอคอน/เมนู, แถบบอส, มินิแมพ
//  ซ้าย: สร้าง/ฮีโร่/วิจัย/ผลิต/จัดการ · ขวา: ภารกิจ/กิจกรรม
//  ล่าง: แผนที่โลก, แถบปาร์ตี้ (1–5), สกิล Q W E R
// =============================================================
window.AR = window.AR || {};

(function () {
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => Math.floor(n).toLocaleString('en-US');
  AR.fmtCost = (cost) => Object.keys(cost).filter((k) => cost[k] > 0).map((k) => `${AR.RES[k].icon} ${fmt(cost[k])}`).join(' · ') || 'ฟรี';
  const fmtTime = (s) => (s >= 60 ? `${Math.floor(s / 60)}น. ${s % 60}วิ` : `${s}วิ`);

  // ---------------- chibi portraits (procedural, ภาพชั่วคราว) ----------------
  const portraitCache = new Map();
  AR.portrait = function (h) {
    const key = h.id + h.hair + h.cls;
    if (portraitCache.has(key)) return portraitCache.get(key);
    const S = 32, c = AR.makeCanvas(S, S), x = c.getContext('2d');
    const cls = AR.HERO_CLASSES[h.cls] || { color: '#5a4a8a' };
    const g = x.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, cls.color); g.addColorStop(1, '#1a1428');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    const px = (col, a, b, w, hh) => { x.fillStyle = col; x.fillRect(a, b, w, hh); };
    const ell = (col, cx, cy, rx, ry) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); };
    ell(h.hair, 16, 17, 12, 13);                       // ผมด้านหลัง
    px(h.hair, 5, 17, 4, 12); px(h.hair, 23, 17, 4, 12);
    px(cls.color, 7, 28, 18, 4); px('#e3b866', 14, 28, 4, 4); // ไหล่/เกราะ
    ell('#ffe2cc', 16, 20, 8.5, 8);                    // หน้า
    x.fillStyle = h.hair;                               // หน้าม้า
    x.beginPath(); x.moveTo(6, 16); x.lineTo(26, 16); x.lineTo(26, 13); x.lineTo(16, 7); x.lineTo(6, 13); x.closePath(); x.fill();
    for (const [bx, by] of [[8, 16], [12, 18], [16, 17], [20, 18], [24, 16]]) { x.beginPath(); x.moveTo(bx - 2.5, 15); x.lineTo(bx + 2.5, 15); x.lineTo(bx, by + 1.5); x.closePath(); x.fill(); }
    px('rgba(255,255,255,0.35)', 10, 10, 6, 1); px('rgba(255,255,255,0.35)', 9, 11, 2, 1);
    px('#1a1020', 10, 19, 4, 1); px('#1a1020', 18, 19, 4, 1);   // ขอบตา
    px(h.eye, 10, 20, 4, 4); px(h.eye, 18, 20, 4, 4);
    px('#fff', 11, 20, 1, 1); px('#fff', 19, 20, 1, 1);
    px('rgba(255,120,140,0.6)', 8, 24, 2, 1); px('rgba(255,120,140,0.6)', 22, 24, 2, 1);
    px('#b0505a', 15, 25, 2, 1);
    const big = AR.makeCanvas(64, 64), bx = big.getContext('2d');
    bx.imageSmoothingEnabled = false; bx.drawImage(c, 0, 0, 64, 64);
    const url = big.toDataURL();
    portraitCache.set(key, url);
    return url;
  };

  const SKILLS = [
    { key: 'Q', name: 'ฟันพายุ', icon: '⚔', color: '#3a7bd5', cd: 6 },
    { key: 'W', name: 'ระเบิดเพลิง', icon: '🔥', color: '#e0602a', cd: 10 },
    { key: 'E', name: 'ฟื้นฟูหมู่', icon: '✚', color: '#3fbf5a', cd: 12 },
    { key: 'R', name: 'อุกกาบาต', icon: '☄', color: '#b0602a', cd: 20 },
  ];
  const GROUPS = [
    { key: 'all', name: 'ทั้งหมด' },
    { key: 'city', name: 'เมือง', match: ['city', 'decor'] },
    { key: 'prod', name: 'ผลิต', match: ['prod'] },
    { key: 'hero', name: 'ฮีโร่', match: ['hero'] },
    { key: 'defense', name: 'ป้องกัน', match: ['defense'] },
  ];
  const GROUP_COLOR = { core: '#ffd166', city: '#e6d6b3', decor: '#6cc3ee', prod: '#9ed05a', hero: '#b388ff', defense: '#c9ccd2' };

  const hud = {
    game: null, drawerOpen: false, group: 'all', panelSig: '', drawerSig: '', confirm: null,
    party: 0, modalKind: null, skillCd: [0, 0, 0, 0], skillHint: false,

    ready(scene) { this.game = scene; window.game = scene; if (this.onReady) this.onReady(); },

    // ================= panels: cell / building =================
    showCell(info, pinned) {
      this.panelSig = '';
      const el = $('#cell');
      if (!info) { el.classList.remove('show'); el.innerHTML = ''; return; }
      el.classList.add('show');
      const clear = info.clear && pinned
        ? `<button class="act" data-act="clear" data-x="${info.gx}" data-y="${info.gy}">🪓 เคลียร์ (${AR.fmtCost(info.clear)})</button>` : '';
      el.innerHTML = `
        <div class="head"><span class="coord">ช่อง (${info.gx}, ${info.gy})</span>${pinned ? '<button class="x" data-act="close">✕</button>' : ''}</div>
        <div class="kv">
          <span>โซน</span><span><i class="dot" style="background:${info.color}"></i>${info.zone}</span>
          <span>ปลดล็อก</span><span>Town Hall Lv.${info.unlockTH}</span>
          <span>พื้น</span><span>${info.terrain}</span>
          <span>สถานะ</span><span class="${info.ok ? 'ok' : 'bad'}">${info.status}</span>
        </div>${clear ? `<div class="acts">${clear}</div>` : ''}`;
    },
    showBuilding(info, pinned) {
      const sig = JSON.stringify([info, pinned, this.confirm]);
      if (sig === this.panelSig) return;
      this.panelSig = sig;
      const el = $('#cell');
      el.classList.add('show');
      let body = '';
      if (!info.done) {
        body += `<div class="prog"><div style="width:${Math.round(info.progress * 100)}%" class="${info.upgrading ? 'up' : ''}"></div></div>
          <div class="row-s">${info.upgrading ? 'กำลังอัปเกรด' : 'กำลังก่อสร้าง'} · เหลือ ${fmtTime(info.remain)}</div>`;
      }
      if (info.prod) body += `<div class="row-s">ผลิต <b>⚪ ${fmt(info.prod)}</b> / นาที</div>`;
      if (info.type === 'fortress') {
        const F = info.fortress;
        body += `<div class="thg"><span>เลเวล</span><b>${info.level}/${F.max}</b>
          <span>เงื่อนไขอัป Lv.${info.level + 1}</span><b>${F.needTH ? `ปราสาทเจ้าเมือง Lv.${F.needTH} <i class="${F.th >= F.needTH ? 'up' : 'bad'}">${F.th >= F.needTH ? '✓ ผ่าน' : '✗ ปัจจุบัน Lv.' + F.th}</i>` : 'เลเวลสูงสุดแล้ว'}</b></div>`;
      }
      if (info.type === 'camp') body += `<div class="row-s">ค่ายของ <b>ปาร์ตี้ ${info.campParty}</b> · ฮีโร่ ${info.campHeroes}/${AR.rules.heroesPerCamp}${info.done && !info.campActive ? ' · <span class="bad">รอปลดล็อกจากปราสาท</span>' : ''}</div>`;
      if (info.type === 'townhall') {
        const n = info.nextRow, cur = AR.TOWN_HALL[info.level - 1];
        const d = (k, unit) => (n && n[k] !== cur[k] ? ` <i class="up">→ ${n[k]}${unit || ''}</i>` : '');
        body += `<div class="thg">
          <span>ปาร์ตี้สูงสุด</span><b>${info.parties}/5${d('parties')}</b>
          <span>ฮีโร่ในปาร์ตี้</span><b>${info.heroCap} ตัว${d('heroes', ' ตัว')}</b>
          <span>Hero Party Camp</span><b>${info.campCount}/${info.camps}${d('camps')}</b>
          <span>ปาร์ตี้ใช้งานได้</span><b>${info.active} <small class="muted">(มีค่ายรองรับ)</small></b>
          <span>ป้องกันเมือง (PVB)</span><b>${info.shield} ชม./วัน${d('shield', ' ชม.')}</b></div>`;
        const dr = this.game.city.dailyReady();
        body += `<div class="thdaily"><span>🎁 รางวัลประจำวัน: ${AR.fmtCost(this.game.city.thDailyReward())}</span>${dr ? '<button class="act gold" data-act="thdaily">รับ</button>' : '<em>รับแล้ววันนี้</em>'}</div>`;
        if (n && n.art !== AR.TOWN_HALL[info.level - 1].art) body += `<div class="row-s muted">Lv.${info.level + 1}: เปลี่ยนเป็นปราสาทหลังใหญ่ (หลังคาฟ้า)</div>`;
        if (info.nextUnlock && info.nextUnlock.length) body += `<div class="row-s muted">Lv.${info.level + 1} ปลดล็อก: ${info.nextUnlock.join(', ')}</div>`;
      }
      let acts = '';
      if (pinned) {
        const u = info.upgrade;
        if (!info.done) acts += `<button class="act gold" data-act="speed">⚡ เร่งให้เสร็จ (${AR.fmtCost(info.speedCost)})</button>`;
        else if (u.max) acts += `<button class="act" disabled>เลเวลสูงสุดแล้ว</button>`;
        else if (u.blocked) acts += `<button class="act" disabled>⬆ ${u.blocked}</button>`;
        else acts += `<button class="act ${u.affordable ? 'gold' : 'poor'}" data-act="upgrade">⬆ อัปเกรด Lv.${info.level + 1} · ${AR.fmtCost(u.cost)} · ${fmtTime(u.time)}</button>`;
        if (info.canMove) acts += `<button class="act" data-act="move">✥ ย้าย</button>`;
        if (info.canDemolish) {
          const c = this.confirm === info.id;
          acts += `<button class="act ${c ? 'danger' : ''}" data-act="demolish">${c ? 'ยืนยันรื้อ?' : '🗑 รื้อ'} <small>คืน ${AR.fmtCost(info.refund)}</small></button>`;
        }
      }
      el.innerHTML = `
        <div class="bp-head">
          <img src="${info.icon}" alt="">
          <div><div class="bp-name">${info.name} <span class="lv">Lv.${info.level}</span></div>
          <div class="bp-sub">${info.type === 'fortress' ? 'ซุ้มประตู 6 ช่อง' : info.size + '×' + info.size} · ${info.desc}</div></div>
          ${pinned ? '<button class="x" data-act="close">✕</button>' : ''}
        </div>${body}${acts ? `<div class="acts">${acts}</div>` : ''}`;
    },

    // ================= build drawer =================
    toggleDrawer(force) {
      this.drawerOpen = force === undefined ? !this.drawerOpen : force;
      $('#drawer').classList.toggle('open', this.drawerOpen);
      document.body.classList.toggle('drawer-open', this.drawerOpen);
      document.querySelector('[data-nav="build"]').classList.toggle('on', this.drawerOpen);
      this.drawerSig = '';
      if (this.drawerOpen) this.renderDrawer();
    },
    renderDrawer() {
      const g = this.game, city = g.city;
      const grp = GROUPS.find((x) => x.key === this.group);
      const cards = AR.BUILD_ORDER.filter((k) => !grp.match || grp.match.includes(AR.BUILDINGS[k].group)).map((k) => {
        const d = AR.BUILDINGS[k], st = city.canStart(k);
        const locked = city.th < d.unlockTH;
        const sel = g.mode === 'place' && g.placeType === k;
        return `<button class="card ${st.ok ? '' : 'dis'} ${locked ? 'locked' : ''} ${sel ? 'sel' : ''}" data-build="${k}" title="${st.ok ? d.desc : st.reason}">
          <img src="${g.bArt[k].icon}" alt="">
          <div class="nm">${d.name}</div>
          <div class="meta"><span>${d.size}×${d.size}</span><span>${city.count(k)}/${city.limit(k)}</span></div>
          <div class="cost">${AR.fmtCost(d.cost)}</div>
          ${locked ? `<div class="lock">🔒 TH ${d.unlockTH}</div>` : ''}
        </button>`;
      }).join('');
      const tabs = GROUPS.map((x) => `<button class="tab ${x.key === this.group ? 'on' : ''}" data-group="${x.key}">${x.name}</button>`).join('');
      const html = `<div class="dr-head"><div class="tabs">${tabs}</div><div class="dr-hint">คลิกพื้นเพื่อวาง · คลิกขวา/Esc ยกเลิก</div><button class="x" data-close-drawer>✕</button></div><div class="cards">${cards}</div>`;
      if (html !== this.drawerSig) {
        const old = $('#drawer .cards'), sc = old ? old.scrollLeft : 0;
        $('#drawer').innerHTML = html; this.drawerSig = html;
        $('#drawer .cards').scrollLeft = sc;
      }
    },
    setMode(g) {
      const m = $('#modebar');
      if (g.mode === 'view') m.classList.remove('show');
      else {
        const d = AR.BUILDINGS[g.placeType];
        m.innerHTML = `<img src="${g.bArt[g.placeType].icon}" alt=""><span>${g.mode === 'move' ? 'กำลังย้าย' : 'กำลังวาง'}: <b>${d.name}</b> ${d.size}×${d.size}</span><button data-act="cancel">✕ ยกเลิก</button>`;
        m.classList.add('show');
      }
      document.body.classList.toggle('building', g.mode !== 'view');
      if (this.drawerOpen) this.renderDrawer();
    },

    // ================= top: profile + resources =================
    renderTop(g) {
      const city = g.city, r = city.state.res, th = city.th, p = city.state.player;
      $('#plv').textContent = p.lv;
      $('#pname').textContent = p.name;
      $('#pexp').style.width = Math.round((p.exp / city.expNeed(p.lv)) * 100) + '%';
      $('#ppow').textContent = fmt(city.power());
      const prod = city.productionPerMin();
      const html = `
        <span class="pill"><i class="ci silver"></i><b>${fmt(r.silver)}</b>${prod ? `<small>+${fmt(prod)}/น.</small>` : ''}</span>
        <span class="pill"><i class="ci gold"></i><b>${fmt(r.gold)}</b><button class="plus" data-shop="gold">+</button></span>
        <span class="pill"><i class="ci gem">💎</i><b>${fmt(r.coupon)}</b><button class="plus" data-shop="coupon">+</button></span>
        ${this.protPill(city)}
        <span class="pill th" data-act="select-th" title="ปราสาทเจ้าเมือง · ป้องกันเมือง ${AR.rules.shieldHours(th)} ชม./วัน"><i class="ci">🏰</i>Lv <b>${th}</b></span>
        <span class="pill" title="ปาร์ตี้ที่ใช้งานได้ (มีค่ายรองรับ) / สิทธิ์จากปราสาท · ฮีโร่ในปาร์ตี้สูงสุด ${city.heroCapacity()} ตัว"><i class="ci">⚔</i><b>${city.activeParties()}/${AR.rules.partySlots(th)}</b></span>`;
      if (html !== this.resSig) { $('#res').innerHTML = html; this.resSig = html; }
      // badges
      $('#bdg-quest').style.display = city.questList().some((q) => q.done && !q.claimed) ? '' : 'none';
      $('#bdg-event').style.display = city.dailyReady() ? '' : 'none';
      $('#bdg-research').style.display = th >= 2 && !city.count('research') ? '' : 'none';
    },

    // ================= City Protection =================
    fmtHMS(ms) { const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; },
    protPill(city) {
      const p = city.protState(), rem = city.protRemainingMs();
      const txt = p.on ? this.fmtHMS(rem) : city.protAllowanceMs() <= 0 ? '—' : rem > 0 ? 'ปิด' : 'หมด';
      return `<span class="pill prot ${p.on ? 'on' : ''}" data-act="protect" title="City Protection · คลิกเพื่อเปิด/ปิด"><i class="ci">🛡</i><b>${txt}</b></span>`;
    },
    // ================= party bar =================
    renderParty(g) {
      const city = g.city;
      const tabs = [0, 1, 2, 3, 4].map((i) => {
        const st = city.partyState(i);
        const icon = st.state === 'needTH' ? '🔒' : st.state === 'needCamp' ? '⛺' : i + 1;
        return `<button class="ptab ${i === this.party ? 'on' : ''} ${st.state !== 'active' ? 'locked' : ''} ${st.state}" data-party="${i}" title="${st.reason || 'ปาร์ตี้ ' + (i + 1)}">${icon}</button>`;
      }).join('');
      const pst = city.partyState(this.party);
      const ids = city.state.parties[this.party] || [];
      const cards = pst.state !== 'active' && !ids.length
        ? `<button class="pnote" data-party-note="${pst.state}">${pst.state === 'needCamp' ? '⛺ ' : '🔒 '}${pst.reason}${pst.state === 'needCamp' && city.canStart('camp').ok ? ' · <u>สร้างค่าย</u>' : ''}</button>`
        : [0, 1, 2, 3].map((k) => {
        const h = city.hero(ids[k]);
        if (!h) return `<button class="hcard empty" data-hero-empty="1" title="เพิ่มฮีโร่"><span>＋</span></button>`;
        const cls = AR.HERO_CLASSES[h.cls];
        return `<button class="hcard" data-hero="${h.id}" title="${h.name} · ${cls.name} Lv.${h.lv}">
          <img src="${AR.portrait(h)}" alt=""><i class="hcls" style="background:${cls.color}">${cls.icon}</i>
          <span class="hlv">Lv.${h.lv}</span>
          <span class="hbar hp"><i style="width:100%"></i></span><span class="hbar mp"><i style="width:${70 + (h.id * 13) % 30}%"></i></span>
        </button>`;
      }).join('');
      const html = tabs + '|' + cards;
      if (html === this.partySig) return;
      this.partySig = html;
      $('#ptabs').innerHTML = tabs;
      $('#pcards').innerHTML = cards;
    },

    // ================= skills =================
    renderSkills() {
      $('#skills').innerHTML = SKILLS.map((s, i) => `
        <button class="skill" data-skill="${i}" title="${s.name}" style="--c:${s.color}">
          <span class="si">${s.icon}</span><span class="cd" id="cd-${i}"></span><kbd>${s.key}</kbd>
        </button>`).join('');
    },
    skill(i) {
      const s = SKILLS[i], now = performance.now();
      if (this.skillCd[i] > now) return;
      this.skillCd[i] = now + s.cd * 1000;
      const btn = document.querySelector(`[data-skill="${i}"]`);
      btn.classList.add('fire'); setTimeout(() => btn.classList.remove('fire'), 300);
      if (!this.skillHint) { this.skillHint = true; this.toast(`${s.name}! (สกิลจะมีผลจริงเมื่อมีระบบต่อสู้)`, 'info'); }
    },
    tickSkills() {
      const now = performance.now();
      SKILLS.forEach((s, i) => {
        const el = document.getElementById('cd-' + i); if (!el) return;
        const left = this.skillCd[i] - now;
        if (left > 0) { el.style.setProperty('--p', (left / (s.cd * 1000)) * 360 + 'deg'); el.textContent = Math.ceil(left / 1000); el.classList.add('on'); }
        else if (el.classList.contains('on')) { el.classList.remove('on'); el.textContent = ''; }
      });
    },

    // ================= minimap =================
    initMinimap(g) {
      const cv = $('#mm'), b = g.terrain.bounds;
      const W = cv.width, H = cv.height;
      const s = Math.min(W / (b.x1 - b.x0), H / (b.y1 - b.y0)) * 0.98;
      const ox = (W - (b.x1 - b.x0) * s) / 2 - b.x0 * s, oy = (H - (b.y1 - b.y0) * s) / 2 - b.y0 * s;
      const base = AR.makeCanvas(W, H), bx = base.getContext('2d');
      bx.fillStyle = '#0c0a18'; bx.fillRect(0, 0, W, H);
      bx.imageSmoothingQuality = 'high';
      for (const c of g.terrain.chunks) bx.drawImage(c.canvas, c.x * s + ox, c.y * s + oy, c.w * s, c.h * s);
      this.mm = { cv, ctx: cv.getContext('2d'), base, s, ox, oy };
      const toWorld = (e) => {
        const r = cv.getBoundingClientRect();
        const mx = ((e.clientX - r.left) / r.width) * W, my = ((e.clientY - r.top) / r.height) * H;
        return { x: (mx - ox) / s, y: (my - oy) / s };
      };
      let down = false;
      cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); const w = toWorld(e); g.moveTo(w.x, w.y); });
      cv.addEventListener('pointermove', (e) => { if (down) { const w = toWorld(e); g.moveTo(w.x, w.y); } });
      cv.addEventListener('pointerup', () => { down = false; });
    },
    drawMinimap(g) {
      const m = this.mm; if (!m) return;
      const x = m.ctx, P = (wx, wy) => ({ x: wx * m.s + m.ox, y: wy * m.s + m.oy });
      x.drawImage(m.base, 0, 0);
      for (const b of g.city.state.buildings) {
        const d = AR.BUILDINGS[b.type], p = P(...Object.values(AR.iso.toWorld(b.x + d.size / 2, b.y + d.size / 2)));
        x.fillStyle = GROUP_COLOR[d.group] || '#fff';
        const r = Math.max(1.5, d.size * 1.1);
        x.fillRect(p.x - r / 2, p.y - r / 2, r, r);
      }
      const pc = P(g.island.platform.center.x, g.island.platform.center.y);
      const t = performance.now() / 300;
      x.fillStyle = `rgba(255,60,80,${0.6 + 0.4 * Math.sin(t)})`;
      x.beginPath(); x.arc(pc.x, pc.y - 3, 6, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff'; x.font = '9px sans-serif'; x.textAlign = 'center'; x.fillText('☠', pc.x, pc.y);
      const v = g.cameras.main.worldView, a = P(v.x, v.y);
      x.strokeStyle = '#fff'; x.lineWidth = 1.5;
      x.strokeRect(a.x, a.y, v.width * m.s, v.height * m.s);
    },

    // ================= modal windows =================
    openModal(kind) {
      this.modalKind = kind;
      $('#modal').classList.add('show');
      this.renderModal();
    },
    closeModal() { this.modalKind = null; $('#modal').classList.remove('show'); this.modalSig = ''; },
    renderModal() {
      const g = this.game, city = g.city, k = this.modalKind;
      if (!k) return;
      let title = '', body = '';
      if (k === 'hero') {
        title = '🧝 ฮีโร่ · จัดปาร์ตี้';
        const stOf = (i) => city.partyState(i).state;
        const tabs = [0, 1, 2, 3, 4].map((i) => `<button class="tab ${i === this.party ? 'on' : ''}" data-mparty="${i}">${stOf(i) === 'needTH' ? '🔒 ' : stOf(i) === 'needCamp' ? '⛺ ' : ''}ปาร์ตี้ ${i + 1}</button>`).join('');
        const ids = city.state.parties[this.party] || [];
        const pst = city.partyState(this.party), locked = pst.state !== 'active';
        const slotHtml = [0, 1, 2, 3].map((s) => {
          const h = city.hero(ids[s]);
          return h ? `<button class="hslot" data-unassign="${h.id}" title="คลิกเพื่อนำออก"><img src="${AR.portrait(h)}"><b>${h.name}</b><small>${AR.HERO_CLASSES[h.cls].icon} Lv.${h.lv}</small></button>`
            : `<div class="hslot empty">${locked ? '🔒' : 'ว่าง'}</div>`;
        }).join('');
        const where = (id) => city.state.parties.findIndex((p) => p.includes(id));
        const roster = city.state.heroes.map((h) => {
          const w = where(h.id), cls = AR.HERO_CLASSES[h.cls];
          return `<button class="hro ${w >= 0 ? 'inp' : ''}" data-assign="${h.id}"><img src="${AR.portrait(h)}"><span><b>${h.name}</b><small>${cls.icon} ${cls.name} · Lv.${h.lv} · ⚔ ${fmt(city.heroPower(h))}</small></span>${w >= 0 ? `<em>P${w + 1}</em>` : ''}</button>`;
        }).join('');
        body = `<div class="tabs">${tabs}</div>
          <div class="hint-s">${locked ? pst.reason : 'คลิกฮีโร่ด้านล่างเพื่อใส่ปาร์ตี้ · คลิกช่องเพื่อนำออก · ค่าย 1 แห่งรองรับ 4 ฮีโร่'}</div>
          <div class="hint-s muted">ปาร์ตี้ใช้งานได้ ${city.activeParties()}/${AR.rules.partySlots(city.th)} (สิทธิ์จากปราสาท Lv.${city.th}) · ค่าย ${city.campsBuilt()}/${city.campsAllowed()} · ฮีโร่ในปาร์ตี้สูงสุด ${city.heroCapacity()} ตัว</div>
          <div class="hslots">${slotHtml}</div><div class="roster">${roster}</div>
          <div class="hint-s muted">* ฮีโร่ชุดนี้เป็นข้อมูลตัวอย่างสำหรับทดสอบ UI</div>`;
      } else if (k === 'prod') {
        title = '📦 การผลิต';
        const list = city.state.buildings.filter((b) => AR.BUILDINGS[b.type].prod);
        body = list.length ? `<div class="lst">${list.map((b) => {
          const d = AR.BUILDINGS[b.type];
          return `<button class="li" data-focus="${b.id}"><img src="${g.bArt[b.type].icon}"><span><b>${d.name} Lv.${b.level}</b><small>${b.done || b.upgrading ? `⚪ +${fmt(d.prod * b.level)} / นาที` : 'กำลังก่อสร้าง'}</small></span></button>`;
        }).join('')}</div><div class="sum">รวม ⚪ +${fmt(city.productionPerMin())} / นาที</div>`
          : '<div class="hint-s">ยังไม่มีอาคารผลิต — สร้างฟาร์ม โรงไม้ หรือเหมืองหิน</div>';
      } else if (k === 'manage') {
        title = '🏛 จัดการเมือง';
        const by = {};
        for (const b of city.state.buildings) (by[b.type] = by[b.type] || []).push(b);
        body = `<div class="lst">${Object.keys(by).map((t) => {
          const d = AR.BUILDINGS[t], arr = by[t];
          return `<button class="li" data-focus="${arr[0].id}"><img src="${g.bArt[t].icon}"><span><b>${d.name}</b><small>${arr.length}/${city.limit(t)} หลัง · เลเวล ${Math.min(...arr.map((b) => b.level))}–${Math.max(...arr.map((b) => b.level))}</small></span></button>`;
        }).join('')}</div>`;
      } else if (k === 'quest') {
        title = '📜 ภารกิจ';
        body = `<div class="lst">${city.questList().map((q) => `
          <div class="li q ${q.claimed ? 'claimed' : ''}"><span><b>${q.name}</b><small>${Math.min(q.cur, q.need)}/${q.need} · รางวัล ${AR.fmtCost(q.reward)}</small>
          <i class="qbar"><i style="width:${Math.min(100, (q.cur / q.need) * 100)}%"></i></i></span>
          ${q.claimed ? '<em>รับแล้ว</em>' : `<button class="act ${q.done ? 'gold' : ''}" data-claim="${q.id}" ${q.done ? '' : 'disabled'}>รับรางวัล</button>`}</div>`).join('')}</div>`;
      } else if (k === 'event') {
        title = '🎁 กิจกรรม';
        const ready = city.dailyReady();
        body = `<div class="lst">
          <div class="li q"><span><b>🏰 รางวัลประจำวันปราสาทเจ้าเมือง (Lv.${city.th})</b><small>${AR.fmtCost(city.thDailyReward())} · ปราสาทเลเวลสูงขึ้นได้รางวัลมากขึ้น</small></span>
            ${ready ? '<button class="act gold" data-daily="1">รับรางวัล</button>' : '<em>รับแล้ววันนี้</em>'}</div>
          <div class="li q"><span><b>บอสบุก: Abyssal Drake</b><small>ป้องกันเมืองจากบอสที่ผู้เล่นอื่นส่งมา (PVB) — เร็ว ๆ นี้</small></span><em>เร็ว ๆ นี้</em></div>
          <div class="li q"><span><b>ล่ามอนสเตอร์ (PvE)</b><small>ส่งปาร์ตี้ออกล่าจากกิลด์นักล่า — เร็ว ๆ นี้</small></span><em>เร็ว ๆ นี้</em></div>
        </div>`;
      } else if (k === 'protect') {
        title = '🛡 City Protection';
        const p = city.protState(), allow = city.protAllowanceMs(), used = Math.min(allow, city.protUsedMs()), rem = city.protRemainingMs();
        const inBattle = !!(g.battle && g.battle.active);
        let btn;
        if (p.on) btn = '<button class="act" data-prot="off">⏸ ปิดการป้องกัน (เก็บเวลาที่เหลือไว้)</button>';
        else if (allow <= 0) btn = `<button class="act" disabled>ปราสาท Lv.${city.th} ไม่มีเวลาป้องกัน — อัปเป็น Lv.2</button>`;
        else if (rem <= 0) btn = `<button class="act" disabled>ใช้ครบแล้ว — รีเซ็ตในอีก ${this.fmtHMS(city.nextResetMs() - Date.now())}</button>`;
        else if (inBattle) btn = '<button class="act" disabled>เปิดระหว่างต่อสู้ PVB ไม่ได้</button>';
        else btn = `<button class="act gold" data-prot="on">🛡 เปิดการป้องกัน (เหลือ ${this.fmtHMS(rem)})</button>`;
        const pct = allow ? (used / allow) * 100 : 0;
        body = `<div class="prot-box ${p.on ? 'on' : ''}">
            <div class="prot-st">${p.on ? '🛡 กำลังป้องกันเมือง' : 'ปิดอยู่'}</div>
            <div class="prot-time">${this.fmtHMS(rem)}</div><div class="hint-s muted">เวลาที่เหลือของวันนี้</div>
            <div class="prog"><div style="width:${pct}%" class="up"></div></div>
            <div class="thg"><span>สิทธิ์ต่อวัน (ปราสาท Lv.${city.th})</span><b>${AR.rules.shieldHours(city.th)} ชม.</b>
            <span>ใช้ไปแล้ว</span><b>${this.fmtHMS(used)}</b>
            <span>รีเซ็ตรอบใหม่ใน</span><b>${this.fmtHMS(city.nextResetMs() - Date.now())}</b></div>
            <div class="acts">${btn}</div></div>
          <div class="hint-s muted">• เวลาลดลงเฉพาะตอนเปิด (ลดต่อแม้ออฟไลน์) · ปิดแล้วเวลาที่เหลือถูกเก็บไว้ใช้ภายหลัง<br>• เปิดระหว่างต่อสู้ PVB ไม่ได้ · ใช้ครบสิทธิ์ของวันแล้วต้องรอรอบรีเซ็ต<br>• สิทธิ์ต่อวัน: Lv.1 0 ชม. · Lv.2 2 ชม. · Lv.3 4 ชม. · Lv.4 6 ชม. · Lv.5 8 ชม.</div>`;
      } else if (k === 'players') {
        title = '👥 ผู้เล่น';
        const net = AR.Net;
        if (!net.online) body = '<div class="hint-s">โหมดออฟไลน์ — รัน <b>start-server.bat</b> แล้วเปิดเกมผ่าน <b>http://localhost:3000</b> เพื่อเล่นออนไลน์และเห็นผู้เล่นคนอื่น</div>';
        else {
          const L = this.playerList;
          if (!L || Date.now() - L.t > 5000) { this.playerList = { t: Date.now(), loading: true, rows: (L && L.rows) || [] }; net.players().then((j) => { this.playerList = { t: Date.now(), rows: j.ok ? j.players : [], total: j.total, me: j.me }; this.modalSig = ''; this.renderModal(); }); }
          const P = this.playerList, ago = (t) => { const s = (Date.now() - t) / 1000; return s < 90 ? 'ออนไลน์' : s < 3600 ? Math.floor(s / 60) + ' นาทีที่แล้ว' : s < 86400 ? Math.floor(s / 3600) + ' ชม.ที่แล้ว' : Math.floor(s / 86400) + ' วันที่แล้ว'; };
          body = `<div class="hint-s">ชื่อของคุณ: <input id="nm" class="nm-in" maxlength="16" value="${(net.player.name || '').replace(/"/g, '')}"> <button class="act" data-rename="1">บันทึกชื่อ</button></div>
            <div class="hint-s muted">ผู้เล่นทั้งหมด ${P.total || P.rows.length} คน${P.loading ? ' · กำลังโหลด…' : ''} · ให้เพื่อนในวง Wi-Fi เดียวกันเปิดลิงก์ที่หน้าต่างเซิร์ฟเวอร์แสดง</div>
            <div class="lst">${P.rows.map((p) => `<div class="li q"><i class="odot ${p.online ? 'on' : ''}"></i><span><b>${p.name}${p.id === P.me ? ' (คุณ)' : ''}</b><small>🏰 ปราสาท Lv.${p.th} · ⚔ ${fmt(p.power)} · ${ago(p.lastSeen)}</small></span></div>`).join('')}</div>`;
        }
      } else if (k === 'mail') {
        title = '✉ จดหมาย';
        body = `<div class="lst"><div class="li q"><span><b>ยินดีต้อนรับสู่ Abyssal Rift</b><small>เริ่มจากสร้างฟาร์ม อัป Town Hall และจัดปาร์ตี้ฮีโร่ในหอฮีโร่ เพื่อเตรียมรับมือบอสที่จะบุกผ่านสะพานจาก Rift Portal</small></span></div></div>`;
      } else if (k === 'news') {
        title = '📢 ประกาศ';
        body = `<div class="lst"><div class="li q"><span><b>อัปเดต v0.3</b><small>เกาะใหญ่ขึ้น (58×58 ช่อง) · สนามรบย้ายมาด้านขวาล่าง · เมืองเริ่มต้นมีกำแพงรอบเมือง · HUD ใหม่</small></span></div></div>`;
      }
      const html = `<div class="mh"><b>${title}</b><button class="x" data-close-modal>✕</button></div><div class="mb">${body}</div>`;
      if (html !== this.modalSig) { $('#modal-box').innerHTML = html; this.modalSig = html; }
    },

    // ================= misc =================
    refresh(g) { this.tick(g); },
    tick(g) {
      this.renderTop(g);
      this.renderParty(g);
      this.drawMinimap(g);
      $('#bossbar').classList.toggle('show', !!g.show.boss);
      if (g.selectedB && g.city.byId(g.selectedB)) this.showBuilding(g.buildingInfo(g.selectedB), true);
      if (this.drawerOpen) this.renderDrawer();
      if (this.modalKind) this.renderModal();
    },
    toast(msg, kind) {
      const box = $('#toasts'), t = document.createElement('div');
      t.className = `toast ${kind || ''}`;
      t.textContent = msg;
      box.appendChild(t);
      setTimeout(() => t.classList.add('hide'), 2600);
      setTimeout(() => t.remove(), 3100);
      while (box.children.length > 4) box.firstChild.remove();
    },
    tip(text) {
      const el = $('#tip');
      if (!text) { el.style.display = 'none'; return; }
      if (el.textContent !== text) el.textContent = text;
      el.style.display = 'block';
    },
    syncToggles(show) {
      document.querySelectorAll('[data-toggle]').forEach((b) => b.classList.toggle('on', !!show[b.dataset.toggle]));
      $('#legend').classList.toggle('show', !!show.zones);
      $('#bossbar').classList.toggle('show', !!show.boss);
    },
    buildLegend(cfg) {
      const rows = Object.values(cfg.zones).map((z) =>
        `<div class="row"><span class="sw" style="background:${z.color}"></span>${z.name}<span class="th">TH ${z.unlockTH}</span></div>`).join('');
      $('#legend').innerHTML = `<h4>โซนบนเกาะ</h4>${rows}
        <div class="row" style="margin-top:6px"><span class="sw" style="background:#ffd166;opacity:.5"></span>ปราสาทเจ้าเมือง 8×8</div>
        <div class="row"><span class="sw" style="background:#ff4664"></span>เส้นทางบอส (PVB)</div>`;
    },

    // ================= wiring =================
    wire(game) {
      const city = game.city;
      document.body.classList.toggle('online', AR.Net.online);
      $('#avatar').src = AR.portrait({ id: 0, hair: '#f1d36b', eye: '#3a6fd0', cls: 'warrior' });
      this.renderSkills();
      this.initMinimap(game);
      this.buildLegend(game.cfg);
      document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => game.toggle(b.dataset.toggle)));
      $('#btn-fit').onclick = () => game.fitView();
      $('#btn-town').onclick = () => game.focusTown();
      $('#btn-gate').onclick = () => game.focusGate();
      $('#btn-export').onclick = () => game.exportJSON();
      $('#zin').onclick = () => game.zoomAt(game.W / 2, game.H / 2, game.camState.zoom * 1.25);
      $('#zout').onclick = () => game.zoomAt(game.W / 2, game.H / 2, game.camState.zoom / 1.25);
      $('#btn-world').onclick = () => { game.fitView(); this.toast('แผนที่โลกยังไม่เปิด — แสดงภาพรวมทั้งเกาะแทน', 'info'); };
      let resetArm = 0;
      $('#btn-reset').onclick = (e) => {
        if (Date.now() - resetArm < 3000) { city.reset(); location.reload(); return; }
        resetArm = Date.now(); e.currentTarget.textContent = 'กดอีกครั้งเพื่อยืนยัน';
        setTimeout(() => { $('#btn-reset').textContent = '↺ รีเซ็ตเมือง'; }, 3000);
      };
      // top icons
      document.querySelectorAll('[data-top]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.top;
        if (k === 'menu') { $('#menu').classList.toggle('show'); return; }
        if (k === 'mail') { b.querySelector('.dot') && b.querySelector('.dot').remove(); this.openModal('mail'); return; }
        if (k === 'news') return this.openModal('news');
        if (k === 'calendar') return this.openModal('event');
        if (k === 'players') return this.openModal('players');
      }));
      document.addEventListener('pointerdown', (e) => {
        if (!e.target.closest('#menu') && !e.target.closest('[data-top="menu"]')) $('#menu').classList.remove('show');
      });
      // left / right nav
      document.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.nav;
        if (k === 'build') return this.toggleDrawer();
        if (k === 'research') {
          const r = city.state.buildings.find((x) => x.type === 'research');
          if (r) game.focusBuilding(r.id);
          else this.toast(city.th >= 2 ? 'ยังไม่มีหอวิจัย — สร้างได้จากเมนู "สร้าง"' : 'หอวิจัยปลดล็อกที่ Town Hall Lv.2', 'info');
          return;
        }
        this.openModal(k);
      }));
      $('#drawer').addEventListener('click', (e) => {
        if (e.target.closest('[data-close-drawer]')) return this.toggleDrawer(false);
        const t = e.target.closest('[data-build],[data-group]');
        if (!t) return;
        if (t.dataset.group) { this.group = t.dataset.group; this.renderDrawer(); return; }
        game.startBuild(t.dataset.build);
      });
      $('#res').addEventListener('click', (e) => {
        if (e.target.closest('[data-shop]')) return this.toast('ร้านค้า — เร็ว ๆ นี้', 'info');
        if (e.target.closest('[data-act="protect"]')) return this.openModal('protect');
        if (e.target.closest('[data-act="select-th"]')) game.focusBuilding(city.townHall.id);
      });
      $('#modebar').addEventListener('click', (e) => { if (e.target.closest('[data-act="cancel"]')) game.exitBuild(); });
      $('#cell').addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b || b.disabled) return;
        const act = b.dataset.act;
        if (act === 'close') game.deselect();
        if (act === 'thdaily') { b.disabled = true; city.claimDaily().then((r) => { this.toast(r.ok ? `🏰 รางวัลประจำวัน Lv.${r.th}: ` + AR.fmtCost(r.reward) : r.reason, r.ok ? 'gold' : 'bad'); this.panelSig = ''; this.tick(game); }); return; }
        if (act === 'upgrade') game.upgradeSelected();
        if (act === 'speed') game.speedUpSelected();
        if (act === 'move') game.startMove();
        if (act === 'clear') game.clearCell(+b.dataset.x, +b.dataset.y);
        if (act === 'demolish') {
          if (this.confirm === game.selectedB) { this.confirm = null; game.demolishSelected(); }
          else { this.confirm = game.selectedB; game.refreshSelection(); setTimeout(() => { this.confirm = null; }, 3000); }
        }
      });
      // party bar
      $('#partybar').addEventListener('click', (e) => {
        const t = e.target.closest('[data-party]');
        if (t) {
          const i = +t.dataset.party;
          this.party = i; this.partySig = ''; this.renderParty(game);
          const st = city.partyState(i);
          if (st.state !== 'active') this.toast(st.reason, 'bad');
          return;
        }
        if (e.target.closest('[data-party-note="needCamp"]')) { if (city.canStart('camp').ok) game.startBuild('camp'); else this.toast(city.canStart('camp').reason, 'bad'); return; }
        if (e.target.closest('[data-hero],[data-hero-empty]')) this.openModal('hero');
      });
      $('#skills').addEventListener('click', (e) => { const s = e.target.closest('[data-skill]'); if (s) this.skill(+s.dataset.skill); });
      // modal
      $('#modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal' || e.target.closest('[data-close-modal]')) return this.closeModal();
        if (e.target.closest('[data-rename]')) {
          const v = document.getElementById('nm').value;
          AR.Net.rename(v).then((j) => {
            if (!j.ok) return this.toast(j.error, 'bad');
            AR.Net.player.name = j.name; AR.Net.remember(); city.state.player.name = j.name; city.save();
            this.playerList = null; this.modalSig = ''; this.toast('เปลี่ยนชื่อเป็น ' + j.name, 'ok'); this.tick(game);
          });
          return;
        }
        const pb = e.target.closest('[data-prot]');
        if (pb) {
          const r = city.setProtection(pb.dataset.prot === 'on', !!(game.battle && game.battle.active));
          if (!r.ok) this.toast(r.reason, 'bad');
          this.modalSig = ''; this.tick(game); return;
        }
        const t = e.target.closest('[data-mparty],[data-assign],[data-unassign],[data-focus],[data-claim],[data-daily]');
        if (!t) return;
        if (t.dataset.mparty !== undefined) this.party = +t.dataset.mparty;
        if (t.dataset.assign) {
          const r = city.assignHero(this.party, +t.dataset.assign);
          if (!r.ok) this.toast(r.reason, 'bad');
        }
        if (t.dataset.unassign) city.unassignHero(+t.dataset.unassign);
        if (t.dataset.focus) { this.closeModal(); game.focusBuilding(+t.dataset.focus); return; }
        if (t.dataset.claim) { const r = city.claimQuest(t.dataset.claim); if (r.ok) this.toast('ได้รับ ' + AR.fmtCost(r.reward), 'gold'); }
        if (t.dataset.daily) { t.disabled = true; city.claimDaily().then((r) => { this.toast(r.ok ? `🏰 รางวัลประจำวัน Lv.${r.th}: ` + AR.fmtCost(r.reward) : r.reason, r.ok ? 'gold' : 'bad'); this.modalSig = ''; this.panelSig = ''; this.tick(game); }); return; }
        this.partySig = ''; this.tick(game);
      });
      window.addEventListener('pointermove', (e) => {
        const t = $('#tip');
        t.style.left = e.clientX + 16 + 'px'; t.style.top = e.clientY + 18 + 'px';
      });
      const loop = () => { this.tickSkills(); requestAnimationFrame(loop); };
      loop();
      this.syncToggles(game.show);
      this.tick(game);
    },
  };

  AR.hud = hud;
})();
