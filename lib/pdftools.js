'use strict';
// ILOVENAGI - Implementacion de todas las herramientas PDF.
// Operaciones estructurales (unir, dividir, rotar, marca de agua, numeros...) con pdf-lib (JS puro).
// Compresion y PDF->imagen con Ghostscript. Seguridad con qpdf. Office con LibreOffice. OCR con Tesseract.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { PDFDocument, degrees, rgb, StandardFonts } = require('pdf-lib');
const AdmZip = require('adm-zip');
const deps = require('./deps');

// ---------- utilidades ----------

function tmpDir() {
  const d = path.join(os.tmpdir(), 'ilovenagi-' + Date.now() + '-' + Math.floor(Math.random() * 1e6));
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function run(cmd, args, { onLog, cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true, cwd, env: env ? { ...process.env, ...env } : process.env });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; onLog && onLog(d.toString()); });
    child.stderr.on('data', d => { err += d; onLog && onLog(d.toString()); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve({ out, err });
      else reject(new Error((err || out || ('codigo ' + code)).slice(-2000)));
    });
  });
}

function needDep(key) {
  const p = deps.locate(key);
  if (!p) {
    const lbl = deps.DEPS[key] ? deps.DEPS[key].label : key;
    const e = new Error('Falta ' + lbl + '. Pulsa "Instalar" en el panel de Componentes (arriba a la derecha).');
    e.missingDep = key;
    throw e;
  }
  return p;
}

function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

async function fileSize(p) { try { return (await fsp.stat(p)).size; } catch (_) { return 0; } }

function outName(input, suffix, ext) {
  const dir = path.dirname(input);
  const base = path.basename(input, path.extname(input));
  return path.join(dir, base + suffix + (ext || path.extname(input)));
}

// Asegura una ruta de salida que no pise un archivo existente.
function uniquePath(p) {
  if (!fs.existsSync(p)) return p;
  const dir = path.dirname(p), ext = path.extname(p), base = path.basename(p, ext);
  let i = 1;
  while (fs.existsSync(path.join(dir, base + ' (' + i + ')' + ext))) i++;
  return path.join(dir, base + ' (' + i + ')' + ext);
}

// ---------- COMPRIMIR (Ghostscript) ----------
// Presets pensados para "maxima compresion conservando calidad".
const COMPRESS_PRESETS = {
  extrema:    { dpi: 72,  q: 60, label: 'Extrema (pantalla, minimo peso)' },
  fuerte:     { dpi: 110, q: 70, label: 'Fuerte (web)' },
  recomendada:{ dpi: 150, q: 80, label: 'Recomendada (equilibrio calidad/peso)' },
  ligera:     { dpi: 200, q: 88, label: 'Ligera (alta calidad)' },
  impresion:  { dpi: 300, q: 92, label: 'Impresion (maxima calidad)' }
};

// QFactor de Ghostscript: menor = mas calidad. Mapeamos calidad 0-100 -> QFactor.
function qToQFactor(q) {
  q = Math.max(1, Math.min(100, q));
  return +(((100 - q) / 100) * 2.3 + 0.08).toFixed(3);
}

async function compress(input, opts = {}, ctx = {}) {
  const gs = needDep('ghostscript');
  const preset = COMPRESS_PRESETS[opts.preset] || COMPRESS_PRESETS.recomendada;
  const dpi = parseInt(opts.dpi || preset.dpi, 10);
  const q = parseInt(opts.quality || preset.q, 10);
  const grayscale = !!opts.grayscale;
  const output = uniquePath(opts.output || outName(input, '-comprimido'));
  const qf = qToQFactor(q);

  const args = [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.6',
    '-dNOPAUSE', '-dBATCH', '-dQUIET', '-dSAFER',
    '-dDetectDuplicateImages=true',
    '-dCompressFonts=true', '-dSubsetFonts=true', '-dEmbedAllFonts=true',
    '-dDownsampleColorImages=true', '-dColorImageDownsampleType=/Bicubic', '-dColorImageResolution=' + dpi,
    '-dDownsampleGrayImages=true', '-dGrayImageDownsampleType=/Bicubic', '-dGrayImageResolution=' + dpi,
    '-dDownsampleMonoImages=true', '-dMonoImageDownsampleType=/Subsample', '-dMonoImageResolution=' + Math.max(dpi * 2, 300),
    '-dColorImageDownsampleThreshold=1.0', '-dGrayImageDownsampleThreshold=1.0',
    '-dAutoFilterColorImages=false', '-dColorImageFilter=/DCTEncode',
    '-dAutoFilterGrayImages=false', '-dGrayImageFilter=/DCTEncode'
  ];
  if (grayscale) args.push('-sColorConversionStrategy=Gray', '-dProcessColorModel=/DeviceGray');
  args.push('-sOutputFile=' + output);
  // Ajuste fino de calidad JPEG via setdistillerparams.
  const qdict = '/QFactor ' + qf + ' /Blend 1 /HSample [2 1 1 2] /VSample [2 1 1 2]';
  args.push('-c', '<< /ColorImageDict << ' + qdict + ' >> /GrayImageDict << ' + qdict + ' >> >> setdistillerparams', '-f');
  args.push(input);

  await run(gs, args, ctx);

  const before = await fileSize(input);
  const after = await fileSize(output);
  // Si Ghostscript hincho el archivo (PDFs ya optimizados), nos quedamos con el original.
  let finalOut = output, note = '';
  if (after >= before && before > 0) {
    note = ' (el original ya estaba optimizado; se copio sin cambios)';
    await fsp.copyFile(input, output);
  }
  const finalAfter = await fileSize(finalOut);
  const ratio = before ? Math.round((1 - finalAfter / before) * 100) : 0;
  return {
    outputs: [finalOut],
    message: 'Comprimido: ' + humanSize(before) + ' -> ' + humanSize(finalAfter) +
             '  (-' + Math.max(0, ratio) + '%)' + note
  };
}

// ---------- UNIR ----------
async function merge(inputs, opts = {}) {
  if (!inputs || inputs.length < 2) throw new Error('Selecciona al menos 2 PDF para unir.');
  const merged = await PDFDocument.create();
  for (const f of inputs) {
    const src = await PDFDocument.load(await fsp.readFile(f), { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  const output = uniquePath(opts.output || path.join(path.dirname(inputs[0]), 'ILOVENAGI-unido.pdf'));
  await fsp.writeFile(output, await merged.save());
  return { outputs: [output], message: 'Unidos ' + inputs.length + ' PDF -> ' + path.basename(output) };
}

// ---------- DIVIDIR ----------
// modo: 'ranges' (texto "1-3,5,8-10") | 'every' (cada N) | 'each' (1 archivo por pagina)
function parseRanges(spec, total) {
  const out = [];
  spec.split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = +m[1], b = +m[2];
      if (a > b) [a, b] = [b, a];
      const pages = [];
      for (let i = a; i <= b && i <= total; i++) if (i >= 1) pages.push(i - 1);
      if (pages.length) out.push({ name: a + '-' + b, pages });
    } else if (/^\d+$/.test(part)) {
      const n = +part;
      if (n >= 1 && n <= total) out.push({ name: '' + n, pages: [n - 1] });
    }
  });
  return out;
}

async function split(input, opts = {}) {
  const src = await PDFDocument.load(await fsp.readFile(input), { ignoreEncryption: true });
  const total = src.getPageCount();
  const dir = path.dirname(input);
  const base = path.basename(input, path.extname(input));
  let groups = [];
  if (opts.mode === 'each') {
    for (let i = 0; i < total; i++) groups.push({ name: 'pag' + (i + 1), pages: [i] });
  } else if (opts.mode === 'every') {
    const n = Math.max(1, parseInt(opts.every || 1, 10));
    for (let i = 0; i < total; i += n) {
      const pages = [];
      for (let j = i; j < Math.min(i + n, total); j++) pages.push(j);
      groups.push({ name: (i + 1) + '-' + Math.min(i + n, total), pages });
    }
  } else {
    groups = parseRanges(opts.ranges || '', total);
    if (!groups.length) throw new Error('Rango invalido. Ejemplo: 1-3,5,8-10');
  }
  const outputs = [];
  for (const g of groups) {
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(src, g.pages);
    pages.forEach(p => doc.addPage(p));
    const out = uniquePath(path.join(dir, base + '-' + g.name + '.pdf'));
    await fsp.writeFile(out, await doc.save());
    outputs.push(out);
  }
  return { outputs, message: 'Generados ' + outputs.length + ' PDF.' };
}

// ---------- ROTAR ----------
async function rotate(input, opts = {}) {
  const angle = parseInt(opts.angle || 90, 10);
  const doc = await PDFDocument.load(await fsp.readFile(input), { ignoreEncryption: true });
  const pageSel = opts.pages ? new Set(parseRanges(opts.pages, doc.getPageCount()).flatMap(g => g.pages)) : null;
  doc.getPages().forEach((pg, i) => {
    if (pageSel && !pageSel.has(i)) return;
    const cur = pg.getRotation().angle || 0;
    pg.setRotation(degrees((cur + angle) % 360));
  });
  const output = uniquePath(opts.output || outName(input, '-rotado'));
  await fsp.writeFile(output, await doc.save());
  return { outputs: [output], message: 'Rotado ' + angle + ' grados.' };
}

// ---------- ORGANIZAR (reordenar / eliminar) ----------
// order: array de numeros de pagina 1-based en el orden deseado (las omitidas se eliminan)
async function organize(input, opts = {}) {
  const src = await PDFDocument.load(await fsp.readFile(input), { ignoreEncryption: true });
  const total = src.getPageCount();
  let order;
  if (Array.isArray(opts.order) && opts.order.length) {
    order = opts.order.map(n => parseInt(n, 10) - 1).filter(i => i >= 0 && i < total);
  } else if (opts.remove) {
    const rm = new Set(parseRanges(opts.remove, total).flatMap(g => g.pages));
    order = [];
    for (let i = 0; i < total; i++) if (!rm.has(i)) order.push(i);
  } else {
    throw new Error('Indica el nuevo orden o las paginas a eliminar.');
  }
  if (!order.length) throw new Error('El resultado no tendria paginas.');
  const doc = await PDFDocument.create();
  const pages = await doc.copyPages(src, order);
  pages.forEach(p => doc.addPage(p));
  const output = uniquePath(opts.output || outName(input, '-organizado'));
  await fsp.writeFile(output, await doc.save());
  return { outputs: [output], message: 'PDF reorganizado: ' + order.length + ' paginas.' };
}

// ---------- MARCA DE AGUA ----------
async function watermark(input, opts = {}) {
  const text = opts.text || 'ILOVENAGI';
  const doc = await PDFDocument.load(await fsp.readFile(input), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = parseInt(opts.size || 48, 10);
  const opacity = Math.max(0.05, Math.min(1, parseFloat(opts.opacity || 0.25)));
  const col = hexToRgb(opts.color || '#ff4fa3');
  const diag = opts.diagonal !== false;
  doc.getPages().forEach(pg => {
    const { width, height } = pg.getSize();
    const tw = font.widthOfTextAtSize(text, size);
    pg.drawText(text, {
      x: width / 2 - tw / 2,
      y: height / 2 - size / 2,
      size, font,
      color: rgb(col.r, col.g, col.b),
      opacity,
      rotate: diag ? degrees(45) : degrees(0)
    });
  });
  const output = uniquePath(opts.output || outName(input, '-marca'));
  await fsp.writeFile(output, await doc.save());
  return { outputs: [output], message: 'Marca de agua aplicada.' };
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return { r: 1, g: 0.3, b: 0.6 };
  return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 };
}

// ---------- NUMEROS DE PAGINA ----------
async function pageNumbers(input, opts = {}) {
  const doc = await PDFDocument.load(await fsp.readFile(input), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = parseInt(opts.size || 11, 10);
  const pos = opts.position || 'bottom-center';
  const fmt = opts.format || '{n} / {total}';
  const start = parseInt(opts.start || 1, 10);
  const pages = doc.getPages();
  const total = pages.length;
  pages.forEach((pg, i) => {
    const label = fmt.replace('{n}', start + i).replace('{total}', total);
    const { width } = pg.getSize();
    const tw = font.widthOfTextAtSize(label, size);
    let x = width / 2 - tw / 2, y = 24;
    if (pos.includes('top')) y = pg.getSize().height - 28;
    if (pos.includes('left')) x = 36;
    if (pos.includes('right')) x = width - tw - 36;
    pg.drawText(label, { x, y, size, font, color: rgb(0.15, 0.15, 0.15) });
  });
  const output = uniquePath(opts.output || outName(input, '-numerado'));
  await fsp.writeFile(output, await doc.save());
  return { outputs: [output], message: 'Numeros de pagina anadidos.' };
}

// ---------- IMAGENES -> PDF ----------
async function imagesToPdf(inputs, opts = {}) {
  if (!inputs || !inputs.length) throw new Error('Selecciona imagenes (JPG/PNG).');
  const doc = await PDFDocument.create();
  for (const f of inputs) {
    const bytes = await fsp.readFile(f);
    const ext = path.extname(f).toLowerCase();
    let img;
    if (ext === '.png') img = await doc.embedPng(bytes);
    else if (ext === '.jpg' || ext === '.jpeg') img = await doc.embedJpg(bytes);
    else continue;
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  if (doc.getPageCount() === 0) throw new Error('No habia imagenes JPG/PNG validas.');
  const output = uniquePath(opts.output || path.join(path.dirname(inputs[0]), 'ILOVENAGI-imagenes.pdf'));
  await fsp.writeFile(output, await doc.save());
  return { outputs: [output], message: doc.getPageCount() + ' imagenes -> PDF.' };
}

// ---------- PDF -> IMAGENES (Ghostscript) ----------
async function pdfToImages(input, opts = {}, ctx = {}) {
  const gs = needDep('ghostscript');
  const fmt = (opts.format || 'jpg').toLowerCase();
  const dpi = parseInt(opts.dpi || 150, 10);
  const dir = path.dirname(input);
  const base = path.basename(input, path.extname(input));
  const outDir = uniquePath(path.join(dir, base + '-imagenes'));
  fs.mkdirSync(outDir, { recursive: true });
  const device = fmt === 'png' ? 'png16m' : 'jpeg';
  const ext = fmt === 'png' ? 'png' : 'jpg';
  const pattern = path.join(outDir, base + '-%03d.' + ext);
  const args = ['-sDEVICE=' + device, '-r' + dpi, '-dNOPAUSE', '-dBATCH', '-dQUIET', '-dSAFER'];
  if (device === 'jpeg') args.push('-dJPEGQ=' + parseInt(opts.quality || 90, 10));
  args.push('-sOutputFile=' + pattern, input);
  await run(gs, args, ctx);
  const files = fs.readdirSync(outDir).map(f => path.join(outDir, f));
  return { outputs: files, openDir: outDir, message: files.length + ' imagenes en ' + path.basename(outDir) };
}

// ---------- SEGURIDAD (qpdf) ----------
async function protect(input, opts = {}, ctx = {}) {
  const qpdf = needDep('qpdf');
  const pass = opts.password;
  if (!pass) throw new Error('Escribe una contrasena.');
  const owner = opts.ownerPassword || pass;
  const output = uniquePath(opts.output || outName(input, '-protegido'));
  const enc = ['--encrypt', pass, owner, '256'];
  if (opts.noPrint) enc.push('--print=none');
  if (opts.noCopy) enc.push('--extract=n');
  if (opts.noModify) enc.push('--modify=none');
  enc.push('--');
  await run(qpdf, [...enc, input, output], ctx);
  return { outputs: [output], message: 'PDF protegido con contrasena.' };
}

async function unlock(input, opts = {}, ctx = {}) {
  const qpdf = needDep('qpdf');
  const output = uniquePath(opts.output || outName(input, '-desbloqueado'));
  const args = ['--decrypt'];
  if (opts.password) args.push('--password=' + opts.password);
  args.push(input, output);
  await run(qpdf, args, ctx);
  return { outputs: [output], message: 'Contrasena/restricciones eliminadas.' };
}

// ---------- OFFICE <-> PDF (LibreOffice) ----------
function sofficeBin() { return needDep('libreoffice'); }

async function officeToPdf(inputs, opts = {}, ctx = {}) {
  const soffice = sofficeBin();
  const outputs = [];
  for (const f of inputs) {
    const dir = path.dirname(f);
    await run(soffice, ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', dir, f], ctx);
    const out = path.join(dir, path.basename(f, path.extname(f)) + '.pdf');
    if (fs.existsSync(out)) outputs.push(out);
  }
  if (!outputs.length) throw new Error('No se genero ningun PDF.');
  return { outputs, message: 'Convertidos ' + outputs.length + ' archivo(s) a PDF.' };
}

async function pdfToOffice(inputs, opts = {}, ctx = {}) {
  const soffice = sofficeBin();
  const target = opts.target || 'docx'; // docx | xlsx | pptx
  const filterMap = {
    docx: 'docx:MS Word 2007 XML:Writer',
    xlsx: 'xlsx:Calc MS Excel 2007 XML',
    pptx: 'pptx:Impress MS PowerPoint 2007 XML'
  };
  const conv = (target === 'docx') ? 'docx' : (target === 'xlsx' ? 'xlsx' : 'pptx');
  const outputs = [];
  for (const f of inputs) {
    const dir = path.dirname(f);
    await run(soffice, ['--headless', '--norestore', '--infilter=writer_pdf_import',
      '--convert-to', conv, '--outdir', dir, f], ctx);
    const out = path.join(dir, path.basename(f, path.extname(f)) + '.' + target);
    if (fs.existsSync(out)) outputs.push(out);
  }
  if (!outputs.length) throw new Error('No se genero el archivo de Office. La conversion de PDF a Office es aproximada.');
  return { outputs, message: 'Convertidos ' + outputs.length + ' PDF a ' + target.toUpperCase() + ' (resultado aproximado).' };
}

// ---------- OCR (Ghostscript + Tesseract) ----------
async function ocr(input, opts = {}, ctx = {}) {
  const gs = needDep('ghostscript');
  const tesseract = needDep('tesseract');
  const lang = opts.lang || 'spa+eng';
  const dpi = parseInt(opts.dpi || 300, 10);
  const work = tmpDir();
  ctx.onLog && ctx.onLog('Rasterizando paginas a ' + dpi + ' dpi...');
  const pat = path.join(work, 'p-%04d.png');
  await run(gs, ['-sDEVICE=png16m', '-r' + dpi, '-dNOPAUSE', '-dBATCH', '-dQUIET', '-dSAFER',
    '-sOutputFile=' + pat, input], ctx);
  const imgs = fs.readdirSync(work).filter(f => f.endsWith('.png')).sort().map(f => path.join(work, f));
  if (!imgs.length) throw new Error('No se pudieron extraer paginas.');
  // Si Tesseract es el empaquetado, sus idiomas estan en <dir>/tessdata
  const tessData = path.join(path.dirname(tesseract), 'tessdata');
  const tessEnv = fs.existsSync(tessData) ? { TESSDATA_PREFIX: tessData } : undefined;
  const pdfParts = [];
  for (let i = 0; i < imgs.length; i++) {
    ctx.onLog && ctx.onLog('OCR pagina ' + (i + 1) + '/' + imgs.length + '...');
    const outBase = path.join(work, 'ocr-' + i);
    await run(tesseract, [imgs[i], outBase, '-l', lang, 'pdf'], { onLog: ctx.onLog, env: tessEnv });
    pdfParts.push(outBase + '.pdf');
  }
  // Unir las paginas OCR en un solo PDF con texto buscable.
  const merged = await PDFDocument.create();
  for (const part of pdfParts) {
    const src = await PDFDocument.load(await fsp.readFile(part));
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  const output = uniquePath(opts.output || outName(input, '-OCR'));
  await fsp.writeFile(output, await merged.save());
  try { fs.rmSync(work, { recursive: true, force: true }); } catch (_) {}
  return { outputs: [output], message: 'OCR completado: PDF con texto buscable (' + lang + ').' };
}

// ---------- DESPROTEGER EXCEL ----------
// Quita la proteccion de hojas/libro (sheetProtection, workbookProtection, fileSharing)
// de archivos .xlsx/.xlsm. Esto NO descifra un Excel con contrasena de APERTURA (eso requiere la clave),
// sino que elimina el "candado" de edicion de hojas que pide contrasena para modificar.
// Acepta TODOS los formatos de hoja de calculo: .xlsx .xlsm .xltx .xltm (zip OOXML),
// .ods .ots (zip ODF) y .xls .xlsb (binario antiguo -> se convierte a .xlsx con LibreOffice).
async function unprotectExcel(input, opts = {}, ctx = {}) {
  const ext = path.extname(input).toLowerCase();
  const buf = await fsp.readFile(input);
  // ¿es un zip? (xlsx/xlsm/ods empiezan por "PK\x03\x04")
  const isZip = buf.length > 3 && buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04;

  let work = input, outExt = ext, note = '', cleanup = null;
  if (!isZip) {
    // .xls / .xlsb (formato binario antiguo): convertir a .xlsx con LibreOffice y luego desproteger
    const soffice = needDep('libreoffice');
    const dir = tmpDir();
    ctx.onLog && ctx.onLog('Convirtiendo ' + (ext || 'archivo') + ' a .xlsx con LibreOffice...');
    await run(soffice, ['--headless', '--norestore', '--convert-to', 'xlsx', '--outdir', dir, input], ctx);
    const conv = path.join(dir, path.basename(input, path.extname(input)) + '.xlsx');
    if (!fs.existsSync(conv)) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
      throw new Error('No se pudo abrir/convertir ese Excel (formato no reconocido o cifrado con contrasena de apertura).'); }
    work = conv; outExt = '.xlsx'; note = ' (convertido a .xlsx)'; cleanup = dir;
  }

  let zip;
  try { zip = new AdmZip(work); }
  catch (e) { if (cleanup) { try { fs.rmSync(cleanup, { recursive: true, force: true }); } catch (_) {} }
    throw new Error('No se pudo abrir el archivo (¿cifrado con contrasena de apertura? eso requiere la clave).'); }

  let removed = 0;
  // OOXML (Excel)
  const reSheet = /<sheetProtection[^>]*\/>/g, reBook = /<workbookProtection[^>]*\/>/g, reShare = /<fileSharing[^>]*\/>/g;
  // ODF (LibreOffice/.ods)
  const reOdfProt = /\s*table:protected="[^"]*"/g, reOdfKey = /\s*table:protection-key="[^"]*"/g, reOdfAlg = /\s*table:protection-key-digest-algorithm="[^"]*"/g;
  zip.getEntries().forEach(entry => {
    const name = entry.entryName;
    if (!name.endsWith('.xml')) return;
    let xml = entry.getData().toString('utf8');
    const before = xml;
    xml = xml.replace(reSheet, () => { removed++; return ''; })
             .replace(reBook, () => { removed++; return ''; })
             .replace(reShare, () => { removed++; return ''; })
             .replace(reOdfProt, () => { removed++; return ''; })
             .replace(reOdfKey, '').replace(reOdfAlg, '');
    if (xml !== before) zip.updateFile(entry.entryName, Buffer.from(xml, 'utf8'));
  });

  const base = path.basename(input, path.extname(input));
  const output = uniquePath(opts.output || path.join(path.dirname(input), base + '-desprotegido' + outExt));
  zip.writeZip(output);
  if (cleanup) { try { fs.rmSync(cleanup, { recursive: true, force: true }); } catch (_) {} }
  return {
    outputs: [output],
    message: removed
      ? 'Desprotegido: se quitaron ' + removed + ' bloqueo(s) de hoja/libro' + note + '.'
      : 'No se encontro proteccion de hoja/libro' + note + ' (puede que solo tenga contrasena de apertura, que requiere la clave).'
  };
}

// ---------- info paginas (para el organizador del UI) ----------
async function pdfInfo(input) {
  const doc = await PDFDocument.load(await fsp.readFile(input), { ignoreEncryption: true });
  return { pages: doc.getPageCount(), size: await fileSize(input) };
}

module.exports = {
  COMPRESS_PRESETS, humanSize,
  compress, merge, split, rotate, organize, watermark, pageNumbers,
  imagesToPdf, pdfToImages, protect, unlock, officeToPdf, pdfToOffice, ocr, pdfInfo,
  unprotectExcel
};
