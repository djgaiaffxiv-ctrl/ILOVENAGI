'use strict';
// Generador GENERICO de iconos de la familia NAGI.
// Uso:  electron gen-app-icon.js "TITULO" "#ACCENT" "C:\\ruta\\base-sin-extension"
// Salida: <base>.png (256), <base>-512.png, <base>.ico (multi-tamano). Todo transparente.

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const TITLE  = process.argv[2] || 'NAGI';
const ACCENT = process.argv[3] || '#56BFC2';
const BASE   = process.argv[4];
if (!BASE) { console.error('Falta ruta base'); process.exit(1); }

const LOGO = 'C:\\Users\\Nieves\\Desktop\\Claude Code\\nagi-studio\\nagi-studio\\public\\mark-logo.png';
const logoB64 = fs.readFileSync(LOGO).toString('base64');

// Ajusta el tamano de fuente segun longitud para que nunca se salga de 512.
const fontPx = TITLE.length >= 9 ? 66 : (TITLE.length >= 7 ? 76 : 88);

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@800;900&display=swap" rel="stylesheet">
<style>
 html,body{margin:0;width:512px;height:512px;background:transparent;overflow:hidden}
 .wrap{width:512px;height:512px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
 .mark{width:296px;height:296px;object-fit:contain}
 .title{font-family:'Rubik','Segoe UI',system-ui,sans-serif;font-weight:900;font-size:${fontPx}px;letter-spacing:1.5px;color:${ACCENT};line-height:1;white-space:nowrap}
</style></head>
<body><div class="wrap">
 <img class="mark" src="data:image/png;base64,${logoB64}">
 <div class="title">${TITLE}</div>
</div></body></html>`;

function buildIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4);
  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const datas = [];
  entries.forEach((e, i) => {
    const dim = e.size >= 256 ? 0 : e.size;
    const o = 16 * i;
    dir.writeUInt8(dim, o); dir.writeUInt8(dim, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(e.buf.length, o + 8); dir.writeUInt32LE(offset, o + 12);
    offset += e.buf.length; datas.push(e.buf);
  });
  return Buffer.concat([header, dir, ...datas]);
}

async function main() {
  const win = new BrowserWindow({
    width: 512, height: 512, show: false, frame: false, transparent: true,
    backgroundColor: '#00000000', webPreferences: { offscreen: false }
  });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  try { await win.webContents.executeJavaScript('document.fonts.ready.then(()=>true)'); } catch (_) {}
  await new Promise(r => setTimeout(r, 900));

  const img = await win.webContents.capturePage();
  console.log(TITLE, '->', img.getSize().width + 'x' + img.getSize().height, 'vacia:', img.isEmpty());

  fs.writeFileSync(BASE + '-512.png', img.toPNG());
  const png256 = img.resize({ width: 256, height: 256, quality: 'best' }).toPNG();
  fs.writeFileSync(BASE + '.png', png256);

  const sizes = [256, 128, 64, 48, 32, 16];
  const entries = sizes.map(s => ({
    size: s,
    buf: s === 256 ? png256 : img.resize({ width: s, height: s, quality: 'best' }).toPNG()
  }));
  fs.writeFileSync(BASE + '.ico', buildIco(entries));
  console.log('OK ->', BASE + '.{png,ico}');
  app.quit();
}

app.disableHardwareAcceleration();
app.whenReady().then(main).catch(e => { console.error(e); app.quit(); });
