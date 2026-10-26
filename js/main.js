// =============================================================
//  Boot: โหลด texture → สร้างเกาะ → bake terrain → สร้างเมือง → เริ่ม Phaser → HUD
// =============================================================
(function () {
  const cfg = AR.CONFIG;
  const $ = (s) => document.querySelector(s);
  const setProgress = (p, note) => {
    $('#ld-fill').style.width = Math.round(p * 100) + '%';
    if (note) $('#ld-note').textContent = note;
  };
  function loadImage(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('โหลดไม่ได้: ' + src.slice(0, 60)));
      im.src = src;
    });
  }

  // ---------- หน้า Guest Login ----------
  function loginScreen() {
    return new Promise((resolve) => {
      const net = AR.Net, prev = net.saved();
      const mode = $('#lg-mode'), err = $('#lg-err');
      if (net.canOnline()) {
        mode.innerHTML = '🌐 ออนไลน์ · ข้อมูลเก็บบนเซิร์ฟเวอร์';
        if (prev && prev.token) {
          $('#lg-continue').style.display = ''; $('#lg-continue').textContent = `▶ เล่นต่อ: ${prev.name || 'Guest'}`;
          $('#lg-guest').style.display = 'none'; $('#lg-new').style.display = '';
        }
      } else {
        mode.innerHTML = '💾 โหมดออฟไลน์ (เปิดจากไฟล์) · เก็บข้อมูลในเบราว์เซอร์นี้เท่านั้น<br><small>เล่นออนไลน์หลายคน: รัน start-server.bat แล้วเปิด http://localhost:3000</small>';
      }
      const go = async (fresh) => {
        err.textContent = '';
        document.querySelectorAll('.lg-btn,.lg-link').forEach((b) => (b.disabled = true));
        if (!net.canOnline()) return resolve({ remote: undefined });
        try {
          const j = await net.login(fresh);
          resolve({ remote: j.state, created: j.created });
        } catch (e) {
          err.textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + e.message;
          document.querySelectorAll('.lg-btn,.lg-link').forEach((b) => (b.disabled = false));
        }
      };
      $('#lg-continue').onclick = () => go(false);
      $('#lg-guest').onclick = () => go(false);
      $('#lg-new').onclick = () => { if ($('#lg-new').dataset.arm) { net.forget(); go(true); } else { $('#lg-new').dataset.arm = 1; $('#lg-new').textContent = 'กดอีกครั้งเพื่อยืนยัน (เมืองเดิมจะไม่ถูกลบ แต่จะเข้าไม่ได้อีก)'; } };
    });
  }

  async function boot() {
    try {
      const hud = AR.hud;
      const login = await loginScreen();
      $('#login').style.display = 'none'; $('#ld-barwrap').style.display = '';
      AR.iso.init(cfg);
      setProgress(0.04, 'โหลด texture พื้น');
      const [grass, grassdirt, dirt] = await Promise.all(
        ['grass', 'grassdirt', 'dirt'].map((k) => loadImage((AR.TEXTURE_DATA && AR.TEXTURE_DATA[k]) || cfg.textures[k])));
      setProgress(0.1, 'สร้างรูปร่างเกาะ');
      await new Promise((r) => setTimeout(r, 0));
      const island = AR.buildIsland(cfg);
      setProgress(0.16, 'สร้างต้นไม้ ภูเขา อาคาร');
      await new Promise((r) => setTimeout(r, 0));
      const art = AR.createArt(cfg.seed);
      const spr = {};
      await Promise.all(Object.keys(AR.SPRITES || {}).map((k) => loadImage(AR.SPRITES[k].url).then((im) => { spr[k] = im; })));
      const bArt = AR.createBuildingArt(spr);
      if (AR.TH_ART) {
        const toC = (im) => { const c = AR.makeCanvas(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); return c; };
        bArt.townhallLv = {};
        for (const k of Object.keys(AR.TH_ART)) {
          const m = AR.TH_ART[k], im = await loadImage(m.url);
          bArt.townhallLv[k] = { img: toC(im), meta: m, scale: m.scale || 1, ax: m.bx, ay: m.by, anchor: 'TH' };
        }
        // ไอคอนในแผงข้อมูล (แดง/ฟ้า ตามเลเวล)
        for (const k of Object.keys(bArt.townhallLv)) {
          const ic = AR.makeCanvas(120, 100), ix = ic.getContext('2d'), r = bArt.townhallLv[k].img, s = Math.min(116 / r.width, 96 / r.height);
          ix.drawImage(r, (120 - r.width * s) / 2, (100 - r.height * s) / 2, r.width * s, r.height * s);
          bArt.townhallLv[k].icon = ic.toDataURL();
        }
        bArt.townhall = bArt.townhallLv.red;
      }
      if (AR.PORTAL_ART) {
        const [arch, vortex] = await Promise.all([loadImage(AR.PORTAL_ART.arch.url), loadImage(AR.PORTAL_ART.vortex.url)]);
        bArt.portal = { arch, vortex };
      }
      const city = new AR.City(island, login.remote);
      const t0 = performance.now();
      const terrain = await AR.bakeTerrain(island, { grass, grassdirt, dirt }, art,
        (p) => setProgress(0.2 + p * 0.8, `วาดพื้นเกาะ ${Math.round(p * 100)}%`));
      console.log('[AR] Phaser', Phaser.VERSION, '· terrain baked in', Math.round(performance.now() - t0), 'ms,', terrain.chunks.length, 'chunks');

      AR.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = () => Math.round(window.innerWidth * AR.dpr), H = () => Math.round(window.innerHeight * AR.dpr);
      const phaser = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game',
        width: W(), height: H(),
        transparent: true,
        scale: { mode: Phaser.Scale.NONE, zoom: 1 / AR.dpr },
        render: { antialias: true, powerPreference: 'high-performance' },
        input: { activePointers: 3 },
        disableContextMenu: true,
        banner: false,
        scene: [new AR.BgScene(), new AR.IslandScene({ island, terrain, art, bArt, city, hud })],
      });
      window.addEventListener('resize', () => {
        phaser.scale.resize(W(), H());
        phaser.scale.setZoom(1 / AR.dpr);
      });
      window.phaser = phaser;
      await new Promise((r) => (hud.game ? r() : (hud.onReady = r)));
      hud.wire(window.game);
      $('#loading').classList.add('done');
    } catch (err) {
      console.error(err);
      $('#ld-note').textContent = 'เกิดข้อผิดพลาด: ' + err.message;
    }
  }
  boot();
})();
