'use strict';
// Descarga y reensambla un modelo de IMG.LY (chunks por hash) en un solo .onnx.
// Uso: node tools/fetch-bgmodel.js /models/isnet_fp16 engines/models/isnet-fp16.onnx
const fs = require('fs'), path = require('path'), https = require('https');
const BASE = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';
const KEY = process.argv[2] || '/models/isnet_fp16';
const OUT = process.argv[3] || 'engines/models/isnet-fp16.onnx';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ilovenagi' } }, (r) => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location) {
        r.resume(); return resolve(get(r.headers.location));
      }
      if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode + ' ' + url)); }
      const bufs = []; r.on('data', d => bufs.push(d)); r.on('end', () => resolve(Buffer.concat(bufs))); r.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  process.stdout.write('Manifiesto... ');
  const res = JSON.parse((await get(BASE + 'resources.json')).toString());
  const entry = res[KEY];
  if (!entry) throw new Error('No existe la clave ' + KEY);
  const chunks = entry.chunks;
  console.log(chunks.length + ' chunks');
  const parts = [];
  for (let i = 0; i < chunks.length; i++) {
    const b = await get(BASE + chunks[i].hash);
    parts.push(b);
    process.stdout.write('\r  descargado ' + (i + 1) + '/' + chunks.length);
  }
  console.log('');
  const out = Buffer.concat(parts);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out);
  console.log('Guardado ' + OUT + ' (' + (out.length / 1048576).toFixed(1) + ' MB)');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
