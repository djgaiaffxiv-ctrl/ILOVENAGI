'use strict';
// Instala Ghostscript (camino real de la app) y prueba compresion + PDF->imagen.
const fs = require('fs'); const path = require('path'); const os = require('os');
const { PDFDocument } = require('pdf-lib');
const deps = require('../lib/deps');
const tools = require('../lib/pdftools');

(async () => {
  const log = m => console.log(m);
  log('Estado inicial: ' + JSON.stringify(deps.status().ghostscript.installed));
  if (!deps.locate('ghostscript')) {
    log('Instalando Ghostscript...');
    const r = await deps.install('ghostscript', l => process.stdout.write('.'));
    log('\n' + JSON.stringify(r));
  } else log('Ghostscript ya presente: ' + deps.locate('ghostscript'));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'siri-gs-'));
  // PDF con una imagen PNG embebida (para que la compresion tenga algo que recomprimir)
  const big = path.join(dir, 'img.pdf');
  const doc = await PDFDocument.create();
  // PNG gradiente 600x600 generado a mano
  const W = 600, H = 600;
  const zlib = require('zlib');
  const raw = Buffer.alloc((W * 3 + 1) * H);
  let o = 0;
  for (let y = 0; y < H; y++) { raw[o++] = 0; for (let x = 0; x < W; x++) { raw[o++] = x % 256; raw[o++] = y % 256; raw[o++] = (x + y) % 256; } }
  const idat = zlib.deflateSync(raw);
  function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0); return Buffer.concat([len, t, data, crc]); }
  function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
  const img = await doc.embedPng(png);
  for (let i = 0; i < 4; i++) { const p = doc.addPage([W, H]); p.drawImage(img, { x: 0, y: 0, width: W, height: H }); }
  fs.writeFileSync(big, await doc.save());
  log('PDF de prueba: ' + tools.humanSize(fs.statSync(big).size));

  try {
    const r = await tools.compress(big, { preset: 'recomendada' }, { onLog: () => {} });
    log('COMPRESS: ' + r.message);
  } catch (e) { log('COMPRESS XX: ' + e.message); }

  try {
    const r = await tools.compress(big, { preset: 'extrema', grayscale: true }, { onLog: () => {} });
    log('COMPRESS extrema+gris: ' + r.message);
  } catch (e) { log('COMPRESS extrema XX: ' + e.message); }

  try {
    const r = await tools.pdfToImages(big, { format: 'jpg', dpi: 100 }, { onLog: () => {} });
    log('PDF->IMG: ' + r.message);
  } catch (e) { log('PDF->IMG XX: ' + e.message); }

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
})();
