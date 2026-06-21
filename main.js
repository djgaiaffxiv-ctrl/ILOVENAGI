'use strict';
// ILOVENAGI - Proceso principal de Electron.

const { app, BrowserWindow, ipcMain, dialog, shell, webContents } = require('electron');
const path = require('path');
const fs = require('fs');
const deps = require('./lib/deps');
const tools = require('./lib/pdftools');

let win;

// ---------- Auto-actualizacion (electron-updater + GitHub Releases) ----------
function initAutoUpdate() {
  if (!app.isPackaged) return; // solo en la app instalada
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (_) { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  const send = (ch, data) => { try { win && win.webContents.send(ch, data); } catch (_) {} };
  autoUpdater.on('update-available', (i) => send('update', { state: 'available', version: i.version }));
  autoUpdater.on('download-progress', (p) => send('update', { state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('error', (e) => send('update', { state: 'error', message: String(e && e.message || e) }));
  autoUpdater.on('update-downloaded', async (i) => {
    send('update', { state: 'ready', version: i.version });
    const r = await dialog.showMessageBox(win, {
      type: 'info', buttons: ['Reiniciar ahora', 'Mas tarde'], defaultId: 0, cancelId: 1,
      title: 'Actualizacion lista',
      message: 'ILOVENAGI ' + i.version + ' se ha descargado.',
      detail: 'Se instalara al reiniciar la aplicacion.'
    });
    if (r.response === 0) autoUpdater.quitAndInstall();
  });
  // comprobar al arrancar y cada 2 horas
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 2 * 60 * 60 * 1000);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#0b0717',
    title: 'ILOVENAGI',
    frame: false,               // ventana sin marco: barra de titulo propia (premium)
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.on('maximize', () => win.webContents.send('win-state', true));
  win.on('unmaximize', () => win.webContents.send('win-state', false));
}

app.whenReady().then(() => {
  createWindow();
  initAutoUpdate();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// Envia progreso a la ventana.
function sendLog(line) { try { win && win.webContents.send('log', line); } catch (_) {} }

// ---------- IPC: dependencias ----------
ipcMain.handle('deps:status', () => deps.status());

ipcMain.handle('deps:install', async (e, key) => {
  return deps.install(key, (line) => { win.webContents.send('dep-log', { key, line }); });
});

// ---------- IPC: controles de ventana (frameless) ----------
ipcMain.handle('win:minimize', () => { win && win.minimize(); });
ipcMain.handle('win:maximize', () => { if (!win) return false; if (win.isMaximized()) { win.unmaximize(); return false; } win.maximize(); return true; });
ipcMain.handle('win:close', () => { win && win.close(); });
ipcMain.handle('win:isMaximized', () => win ? win.isMaximized() : false);

// ---------- IPC: lectura/guardado de imagenes (PadSnap) ----------
ipcMain.handle('read-file-b64', async (e, file) => {
  try {
    const buf = await fs.promises.readFile(file);
    const ext = path.extname(file).toLowerCase().replace('.', '');
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { ok: true, b64: buf.toString('base64'), mime, name: path.basename(file), dir: path.dirname(file), ext };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('save-data-url', async (e, { dir, base, suffix, ext, dataUrl }) => {
  try {
    const comma = dataUrl.indexOf(',');
    const buf = Buffer.from(dataUrl.slice(comma + 1), 'base64');
    let out = path.join(dir, base + (suffix || '') + '.' + ext);
    let i = 1;
    while (fs.existsSync(out)) { out = path.join(dir, base + (suffix || '') + ' (' + (i++) + ').' + ext); }
    await fs.promises.writeFile(out, buf);
    return { ok: true, path: out };
  } catch (err) { return { ok: false, error: err.message }; }
});

// ---------- IPC: selector de archivos ----------
ipcMain.handle('pick-files', async (e, kind) => {
  const filters = {
    pdf: [{ name: 'PDF', extensions: ['pdf'] }],
    images: [{ name: 'Imagenes', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    excel: [{ name: 'Excel', extensions: ['xlsx', 'xlsm'] }],
    office: [{ name: 'Office', extensions: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'txt'] }],
    any: [{ name: 'Todos', extensions: ['*'] }]
  };
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: filters[kind] || filters.any
  });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle('reveal', (e, p) => { try { shell.showItemInFolder(p); } catch (_) {} });
ipcMain.handle('open-path', (e, p) => { try { shell.openPath(p); } catch (_) {} });
ipcMain.handle('open-folder', (e, p) => { try { shell.openPath(p); } catch (_) {} });

// ---------- IPC: ejecutar herramienta ----------
const ctx = () => ({ onLog: sendLog });

ipcMain.handle('run', async (e, tool, payload) => {
  try {
    const f = payload.files || [];
    const o = payload.options || {};
    let res;
    switch (tool) {
      case 'compress':     res = await tools.compress(f[0], o, ctx()); break;
      case 'merge':        res = await tools.merge(f, o); break;
      case 'split':        res = await tools.split(f[0], o); break;
      case 'rotate':       res = await tools.rotate(f[0], o); break;
      case 'organize':     res = await tools.organize(f[0], o); break;
      case 'watermark':    res = await tools.watermark(f[0], o); break;
      case 'pagenumbers':  res = await tools.pageNumbers(f[0], o); break;
      case 'img2pdf':      res = await tools.imagesToPdf(f, o); break;
      case 'pdf2img':      res = await tools.pdfToImages(f[0], o, ctx()); break;
      case 'protect':      res = await tools.protect(f[0], o, ctx()); break;
      case 'unlock':       res = await tools.unlock(f[0], o, ctx()); break;
      case 'office2pdf':   res = await tools.officeToPdf(f, o, ctx()); break;
      case 'pdf2office':   res = await tools.pdfToOffice(f, o, ctx()); break;
      case 'ocr':          res = await tools.ocr(f[0], o, ctx()); break;
      case 'unprotect-excel': res = await tools.unprotectExcel(f[0], o); break;
      default: throw new Error('Herramienta desconocida: ' + tool);
    }
    return { ok: true, ...res };
  } catch (err) {
    return { ok: false, error: err.message, missingDep: err.missingDep || null };
  }
});

ipcMain.handle('pdf-info', async (e, file) => {
  try { return { ok: true, ...(await tools.pdfInfo(file)) }; }
  catch (err) { return { ok: false, error: err.message }; }
});

// Para procesado por lotes que comparte opciones (compresion de varios PDF a la vez).
ipcMain.handle('run-batch', async (e, tool, files, options) => {
  const results = [];
  for (const file of files) {
    try {
      let res;
      if (tool === 'compress') res = await tools.compress(file, options, ctx());
      else if (tool === 'pdf2img') res = await tools.pdfToImages(file, options, ctx());
      else if (tool === 'rotate') res = await tools.rotate(file, options);
      else if (tool === 'watermark') res = await tools.watermark(file, options);
      else if (tool === 'pagenumbers') res = await tools.pageNumbers(file, options);
      else if (tool === 'protect') res = await tools.protect(file, options, ctx());
      else if (tool === 'unlock') res = await tools.unlock(file, options, ctx());
      else if (tool === 'ocr') res = await tools.ocr(file, options, ctx());
      else if (tool === 'unprotect-excel') res = await tools.unprotectExcel(file, options);
      else throw new Error('Lote no soportado para ' + tool);
      results.push({ file, ok: true, ...res });
    } catch (err) {
      results.push({ file, ok: false, error: err.message, missingDep: err.missingDep || null });
    }
  }
  return results;
});
