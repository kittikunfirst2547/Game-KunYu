// =============================================================
//  Project Abyssal Rift — Island Map config
//  ปรับค่าทั้งหมดของเกาะได้ที่ไฟล์นี้ (หน่วย "ช่อง" = 1 tile)
// =============================================================
window.AR = window.AR || {};

AR.CONFIG = {
  seed: 1337,               // เปลี่ยน seed = รูปร่างขอบเกาะ/ต้นไม้เปลี่ยน

  // ---- Isometric tile (2:1) ----
  tileW: 128,
  tileH: 64,

  // ---- Grid ที่ใช้วางสิ่งปลูกสร้าง ----
  gridSize: 96,             // 96 x 96 ช่อง (ศูนย์กลาง = 48,48) — เผื่อสนามรบด้านหน้า

  // ---- รูปร่างเกาะ ----
  plateau: {
    radius: 30,             // รัศมีที่ราบ (ช่อง)
    squareness: 3.4,        // 2 = วงรี, สูง = สี่เหลี่ยมขนมเปียกปูนมุมมน
    noiseAmp: 2.0,          // ความขรุขระของขอบ
  },
  battlefieldDepth: 16,     // ยืดสนามรบหน้าป้อม (ช่อง) — การต่อสู้กับบอสทั้งหมดเกิดที่นี่
  rimWidth: 10,            // ป่า/ภูเขาด้านหลังเกาะ (ช่อง)
  ledge: { front: 5.6, back: 1.0 },   // ชั้นล่างริมแม่น้ำ
  cliffHeight: 150,         // ความสูงหน้าผา (px)
  river: { inner: 1.6, outer: 3.4 },// ระยะแม่น้ำจากตีนผา (ช่อง)
  underside: { min: 200, max: 900 },  // ความลึกใต้เกาะลอยฟ้า (px)

  // ---- สะพาน + Rift Portal (ทางเข้าของบอส PVB) ----
  bridge: { axis: 'u', offset: 0, width: 3, length: 11, deckDrop: 34 }, // axis 'u' = สนามรบ/สะพานอยู่ขวาล่าง, 'v' = ซ้ายล่าง
  portal: { radius: 4.3, gap: 1.3, side: 4.3, scale: 1.0, spin: 0.7 }, // scale = ขนาดซุ้ม, spin = ความเร็วหมุนของวงวน (rad/วินาที)

  // ---- ผังเมือง ----
  layout: {
    coreRadius: 7.5,        // ใจกลางเมือง (ปราสาทเจ้าเมือง 8x8 อยู่กลาง)
    wallRadius: 20.5,        // แนวกำแพง (ยิ่งมาก พื้นที่ในเมืองยิ่งกว้าง)
    plazaRadius: 6.0,
    roadHalfWidth: 1.0,
  },

  zones: {
    core:        { name: 'ใจกลางเมือง',          color: '#ffd166', unlockTH: 1,  buildable: true  },
    city:        { name: 'เขตเมืองชั้นใน',        color: '#06d6a0', unlockTH: 1,  buildable: true  },
    wall:        { name: 'แนวกำแพง/ป้อม',        color: '#adb5bd', unlockTH: 1,  buildable: true, only: 'wall' },
    battlefield: { name: 'สนามรบ (บอสบุก)',       color: '#ef476f', unlockTH: 1,  buildable: true, only: 'defense' },
    expA:        { name: 'เขตขยาย A',            color: '#4cc9f0', unlockTH: 2,  buildable: true  },
    expB:        { name: 'เขตขยาย B',            color: '#b388ff', unlockTH: 3,  buildable: true  },
    expC:        { name: 'เขตขยาย C',            color: '#f8961e', unlockTH: 4,  buildable: true  },
  },

  // ---- Render ----
  chunkSize: 2040,         // อย่าใช้ขนาดยกกำลัง 2 (Phaser จะตั้ง wrap = REPEAT แล้วเกิดเส้นที่ขอบ)
  maskScale: 5,             // ความละเอียด splat mask (1/4)
  textureScale: 1.0,        // ขนาดลายพื้น
  textures: {
    grass:     'assets/terrain/grass.webp',
    grassdirt: 'assets/terrain/grassdirt.webp',
    dirt:      'assets/terrain/dirt.webp',
  },
};
