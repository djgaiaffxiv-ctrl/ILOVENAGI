'use strict';
// ILOVENAGI - Gestor de dependencias externas (Ghostscript, qpdf, LibreOffice, Tesseract).
// Detecta binarios escaneando PATH + carpetas tipicas de Windows, y los autoinstala con winget.

const { spawn, spawnSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PF = process.env['ProgramFiles'] || 'C:\\Program Files';
const PF86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
const LOCAL = process.env['LOCALAPPDATA'] || '';

// Devuelve la primera ruta que exista de una lista de globs simples (sin comodines de profundidad).
function firstExisting(paths) {
  for (const p of paths) {
    try { if (p && fs.existsSync(p)) return p; } catch (_) {}
  }
  return null;
}

// Busca un .exe dentro de subcarpetas con version variable (p.ej. gs10.03.1).
function findInVersionedDir(baseDir, relExe) {
  try {
    if (!fs.existsSync(baseDir)) return null;
    const subs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(baseDir, d.name, relExe));
    return firstExisting(subs);
  } catch (_) { return null; }
}

// ¿Esta en el PATH?
function whichExe(name) {
  try {
    const r = spawnSync('where', [name], { encoding: 'utf8' });
    if (r.status === 0) {
      const line = (r.stdout || '').split(/\r?\n/).find(Boolean);
      if (line && fs.existsSync(line.trim())) return line.trim();
    }
  } catch (_) {}
  return null;
}

// Carpeta de motores empaquetados: en la app instalada -> resources/engines,
// en desarrollo -> <proyecto>/engines.
function enginesDir() {
  try {
    if (process.resourcesPath) {
      const p = path.join(process.resourcesPath, 'engines');
      if (fs.existsSync(p)) return p;
    }
  } catch (_) {}
  return path.join(__dirname, '..', 'engines');
}
function bundled(rel) {
  const p = path.join(enginesDir(), rel);
  return fs.existsSync(p) ? p : null;
}

const DEPS = {
  ghostscript: {
    label: 'Ghostscript',
    purpose: 'Compresion real de PDF y exportar PDF a imagen',
    method: 'ghostscript', // no esta en winget: instalador oficial
    bundledWith: 'ILOVENAGI',
    locate() {
      return bundled('ghostscript\\bin\\gswin64c.exe') ||
        whichExe('gswin64c') ||
        findInVersionedDir(path.join(PF, 'gs'), 'bin\\gswin64c.exe') ||
        findInVersionedDir(path.join(PF86, 'gs'), 'bin\\gswin32c.exe') ||
        whichExe('gswin32c');
    }
  },
  qpdf: {
    label: 'qpdf',
    purpose: 'Proteger / quitar contrasena / permisos',
    method: 'winget',
    wingetId: 'QPDF.QPDF',
    bundledWith: 'ILOVENAGI',
    locate() {
      return bundled('qpdf\\bin\\qpdf.exe') ||
        whichExe('qpdf') ||
        findInVersionedDir(path.join(PF, 'qpdf'), 'bin\\qpdf.exe') ||
        findInVersionedDir(path.join(PF86, 'qpdf'), 'bin\\qpdf.exe');
    }
  },
  libreoffice: {
    label: 'LibreOffice',
    purpose: 'Convertir PDF <-> Word / Excel / PowerPoint',
    method: 'winget',
    wingetId: 'TheDocumentFoundation.LibreOffice',
    locate() {
      return firstExisting([
        path.join(PF, 'LibreOffice', 'program', 'soffice.exe'),
        path.join(PF86, 'LibreOffice', 'program', 'soffice.exe')
      ]) || whichExe('soffice');
    }
  },
  tesseract: {
    label: 'Tesseract OCR',
    purpose: 'OCR: reconocer texto en PDF escaneados',
    method: 'winget',
    wingetId: 'UB-Mannheim.TesseractOCR',
    bundledWith: 'ILOVENAGI',
    locate() {
      return bundled('tesseract\\tesseract.exe') ||
        whichExe('tesseract') ||
        firstExisting([
          path.join(PF, 'Tesseract-OCR', 'tesseract.exe'),
          path.join(PF86, 'Tesseract-OCR', 'tesseract.exe'),
          LOCAL && path.join(LOCAL, 'Programs', 'Tesseract-OCR', 'tesseract.exe')
        ]);
    }
  }
};

// Cache de rutas resueltas.
const resolved = {};

function locate(key) {
  if (resolved[key] && fs.existsSync(resolved[key])) return resolved[key];
  const dep = DEPS[key];
  if (!dep) return null;
  const p = dep.locate();
  resolved[key] = p || null;
  return resolved[key];
}

function status() {
  const out = {};
  for (const key of Object.keys(DEPS)) {
    const p = locate(key);
    out[key] = {
      label: DEPS[key].label,
      purpose: DEPS[key].purpose,
      installed: !!p,
      path: p || null
    };
  }
  return out;
}

// ---- descarga HTTPS con seguimiento de redirecciones ----
function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ilovenagi', ...(headers || {}) } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve(httpsGet(res.headers.location, headers));
      }
      resolve(res);
    }).on('error', reject);
  });
}

function fetchJson(url) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await httpsGet(url, { Accept: 'application/vnd.github+json' });
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
      res.on('error', reject);
    } catch (e) { reject(e); }
  });
}

function download(url, dest, onLog) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await httpsGet(url);
      if (res.statusCode !== 200) return reject(new Error('Descarga fallo (HTTP ' + res.statusCode + ')'));
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let got = 0, lastPct = -1;
      const file = fs.createWriteStream(dest);
      res.on('data', d => {
        got += d.length;
        if (total) {
          const pct = Math.floor(got / total * 100);
          if (pct !== lastPct && pct % 5 === 0) { lastPct = pct; onLog && onLog('Descargando... ' + pct + '%'); }
        }
      });
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
      file.on('error', reject);
    } catch (e) { reject(e); }
  });
}

// Instala Ghostscript desde el instalador oficial (no esta en winget).
async function installGhostscript(onLog) {
  try {
    onLog && onLog('Buscando ultima version de Ghostscript...');
    let url = null;
    try {
      const rel = await fetchJson('https://api.github.com/repos/ArtifexSoftware/ghostpdl-downloads/releases/latest');
      const asset = (rel.assets || []).find(a => /w64.*\.exe$/i.test(a.name));
      if (asset) url = asset.browser_download_url;
    } catch (_) { onLog && onLog('API no disponible, usando version conocida.'); }
    if (!url) url = 'https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/gs10071/gs10071w64.exe';
    const installer = path.join(os.tmpdir(), 'ilovenagi-gs-setup.exe');
    onLog && onLog('Descargando instalador (~62 MB)...');
    await download(url, installer, onLog);
    onLog && onLog('Instalando Ghostscript (acepta el aviso de Windows / UAC)...');
    await new Promise((res, rej) => {
      // Elevar con UAC: instalar en Program Files requiere permisos de administrador.
      const ps = 'Start-Process -FilePath "' + installer + '" -ArgumentList "/S" -Verb RunAs -Wait';
      const ch = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true });
      let err = '';
      ch.stderr.on('data', d => err += d);
      ch.on('error', rej);
      ch.on('close', (code) => code === 0 ? res() : rej(new Error(err.trim() || ('UAC cancelado o codigo ' + code))));
    });
    try { fs.unlinkSync(installer); } catch (_) {}
    resolved.ghostscript = null;
    const p = locate('ghostscript');
    if (p) { onLog && onLog('Ghostscript listo.'); return { ok: true, path: p, message: 'Ghostscript instalado correctamente.' }; }
    return { ok: false, message: 'Ghostscript se descargo pero no se detecto. Reinicia ILOVENAGI.' };
  } catch (e) {
    return { ok: false, message: 'Error instalando Ghostscript: ' + e.message };
  }
}

// Instala una dependencia (winget o descarga directa). onLog(line) recibe progreso.
function install(key, onLog) {
  const dep = DEPS[key];
  if (!dep) return Promise.resolve({ ok: false, message: 'Dependencia desconocida: ' + key });
  if (dep.method === 'ghostscript') return installGhostscript(onLog);
  return new Promise((resolve) => {
    onLog && onLog('Instalando ' + dep.label + ' con winget (' + dep.wingetId + ')...');
    const args = ['install', '--id', dep.wingetId, '-e',
      '--accept-source-agreements', '--accept-package-agreements',
      '--silent', '--disable-interactivity'];
    let child;
    try {
      child = spawn('winget', args, { windowsHide: true });
    } catch (e) {
      return resolve({ ok: false, message: 'No se pudo ejecutar winget: ' + e.message });
    }
    let buf = '';
    const onData = (d) => {
      const s = d.toString();
      buf += s;
      // winget pinta barras de progreso con \r; mandamos lineas legibles.
      s.split(/\r?\n/).forEach(line => { const t = line.trim(); if (t) onLog && onLog(t); });
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (e) => resolve({ ok: false, message: 'winget fallo: ' + e.message }));
    child.on('close', (code) => {
      // Volver a localizar (PATH puede no haberse refrescado, por eso escaneamos carpetas).
      resolved[key] = null;
      const p = locate(key);
      const already = /already installed|ya esta instalad/i.test(buf);
      if (p || code === 0 || already) {
        onLog && onLog(dep.label + ' listo.');
        resolve({ ok: true, path: p, message: dep.label + ' instalado correctamente.' });
      } else {
        resolve({ ok: false, code, message: dep.label + ' no se pudo instalar (codigo ' + code + '). Revisa el log.' });
      }
    });
  });
}

module.exports = { DEPS, status, locate, install };
