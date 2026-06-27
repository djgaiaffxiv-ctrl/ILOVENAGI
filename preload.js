'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('siri', {
  // Selector nativo de archivos.
  pickFiles: (kind) => ipcRenderer.invoke('pick-files', kind),
  // Resolver la ruta real de un File arrastrado (Electron >=32 quita File.path).
  pathFor: (file) => { try { return webUtils.getPathForFile(file); } catch (_) { return null; } },

  run: (tool, payload) => ipcRenderer.invoke('run', tool, payload),
  runBatch: (tool, files, options) => ipcRenderer.invoke('run-batch', tool, files, options),
  pdfInfo: (file) => ipcRenderer.invoke('pdf-info', file),

  depsStatus: () => ipcRenderer.invoke('deps:status'),
  installDep: (key) => ipcRenderer.invoke('deps:install', key),

  reveal: (p) => ipcRenderer.invoke('reveal', p),
  openPath: (p) => ipcRenderer.invoke('open-path', p),
  openFolder: (p) => ipcRenderer.invoke('open-folder', p),

  // PadSnap: leer imagen como base64 y guardar el resultado del canvas
  readFileB64: (file) => ipcRenderer.invoke('read-file-b64', file),
  saveDataUrl: (payload) => ipcRenderer.invoke('save-data-url', payload),
  // Quitar fondo: enviar tensor (ArrayBuffer) y recibir mascara
  bgInfer: (buf) => ipcRenderer.invoke('bg-infer', buf),

  // controles de ventana (frameless)
  winMinimize: () => ipcRenderer.invoke('win:minimize'),
  winMaximize: () => ipcRenderer.invoke('win:maximize'),
  winClose: () => ipcRenderer.invoke('win:close'),
  onWinState: (cb) => ipcRenderer.on('win-state', (e, max) => cb(max)),

  onLog: (cb) => ipcRenderer.on('log', (e, line) => cb(line)),
  onDepLog: (cb) => ipcRenderer.on('dep-log', (e, data) => cb(data)),
  onUpdate: (cb) => ipcRenderer.on('update', (e, data) => cb(data))
});
