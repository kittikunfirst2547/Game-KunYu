# รันใหม่ทุกครั้งที่เปลี่ยนไฟล์ assets/terrain/*.webp
#   python tools/embed_textures.py
# จะสร้าง assets/terrain/textures.js (ฝังภาพเป็น data URL ให้ WebGL ใช้ได้ตอนเปิดจาก file://)
import base64, os
root = os.path.join(os.path.dirname(__file__), '..', 'assets', 'terrain')
lines = ["// สร้างอัตโนมัติด้วย tools/embed_textures.py — อย่าแก้ด้วยมือ",
         "window.AR = window.AR || {};", "AR.TEXTURE_DATA = {"]
for name in ['grass', 'grassdirt', 'dirt']:
    with open(os.path.join(root, name + '.webp'), 'rb') as f:
        lines.append(f"  {name}: 'data:image/webp;base64,{base64.b64encode(f.read()).decode()}',")
lines.append("};")
with open(os.path.join(root, 'textures.js'), 'w', encoding='utf-8') as f:
    f.write("\n".join(lines) + "\n")
print('ok: assets/terrain/textures.js')
