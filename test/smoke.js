'use strict';
// Prueba de humo de las operaciones pdf-lib (sin Ghostscript/qpdf).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const tools = require('../lib/pdftools');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'siri-test-'));
  const log = (m) => console.log(m);

  // Crear PDF de 5 paginas
  async function makePdf(name, n) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < n; i++) {
      const p = doc.addPage([400, 560]);
      p.drawText('Pagina ' + (i + 1), { x: 50, y: 500, size: 30, font, color: rgb(0.2, 0.1, 0.4) });
    }
    const f = path.join(dir, name);
    fs.writeFileSync(f, await doc.save());
    return f;
  }

  let pass = 0, fail = 0;
  async function t(name, fn) {
    try { const r = await fn(); pass++; log('  OK  ' + name + (r ? '  -> ' + r : '')); }
    catch (e) { fail++; log('  XX  ' + name + '  :: ' + e.message); }
  }

  const a = await makePdf('a.pdf', 5);
  const b = await makePdf('b.pdf', 3);

  await t('pdfInfo', async () => { const i = await tools.pdfInfo(a); if (i.pages !== 5) throw new Error('paginas != 5'); return i.pages + ' pag'; });
  await t('merge', async () => { const r = await tools.merge([a, b]); const i = await tools.pdfInfo(r.outputs[0]); if (i.pages !== 8) throw new Error('esperaba 8, fue ' + i.pages); return r.outputs[0]; });
  await t('split rangos', async () => { const r = await tools.split(a, { mode: 'ranges', ranges: '1-2,4' }); if (r.outputs.length !== 2) throw new Error('esperaba 2 archivos'); return r.outputs.length + ' archivos'; });
  await t('split cada 2', async () => { const r = await tools.split(a, { mode: 'every', every: 2 }); if (r.outputs.length !== 3) throw new Error('esperaba 3'); return r.outputs.length; });
  await t('split each', async () => { const r = await tools.split(a, { mode: 'each' }); if (r.outputs.length !== 5) throw new Error('esperaba 5'); return r.outputs.length; });
  await t('rotate', async () => { const r = await tools.rotate(a, { angle: 90 }); return path.basename(r.outputs[0]); });
  await t('rotate pag concretas', async () => { const r = await tools.rotate(a, { angle: 180, pages: '1,3' }); return path.basename(r.outputs[0]); });
  await t('organize remove', async () => { const r = await tools.organize(a, { remove: '2,4' }); const i = await tools.pdfInfo(r.outputs[0]); if (i.pages !== 3) throw new Error('esperaba 3, fue ' + i.pages); return i.pages + ' pag'; });
  await t('organize order', async () => { const r = await tools.organize(a, { order: [3, 1, 2] }); const i = await tools.pdfInfo(r.outputs[0]); if (i.pages !== 3) throw new Error('esperaba 3'); return i.pages; });
  await t('watermark', async () => { const r = await tools.watermark(a, { text: 'TEST', opacity: 0.3, color: '#ff0000' }); return path.basename(r.outputs[0]); });
  await t('pageNumbers', async () => { const r = await tools.pageNumbers(a, { position: 'bottom-center', format: '{n}/{total}' }); return path.basename(r.outputs[0]); });

  // imagen -> pdf (crear PNG minimo 1x1)
  await t('imagesToPdf', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const imgPath = path.join(dir, 'p.png'); fs.writeFileSync(imgPath, png);
    const r = await tools.imagesToPdf([imgPath]); const i = await tools.pdfInfo(r.outputs[0]); if (i.pages !== 1) throw new Error('esperaba 1');
    return 'ok';
  });

  log('\nResultado: ' + pass + ' OK, ' + fail + ' fallos.');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  process.exit(fail ? 1 : 0);
})();
