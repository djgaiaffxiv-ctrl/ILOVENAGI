const { app, nativeImage } = require('electron');
const path = require('path');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  try {
    const ort = require('onnxruntime-node');
    const model = path.join(__dirname, '..', 'engines', 'models', 'isnet-fp16.onnx');
    const s = await ort.InferenceSession.create(model);

    // cargar imagen de prueba y redimensionar a 1024 (mismo preproceso que el renderer)
    const imgPath = process.argv.find(a => a.endsWith('.png')) ||
      'C:\\Users\\Nieves\\AppData\\Local\\Temp\\claude\\C--Users-Nieves-Desktop-Claude-Code\\81be73f2-4d29-4ab9-ac92-a2a9692c48a5\\scratchpad\\test-taza.png';
    const ni = nativeImage.createFromPath(imgPath).resize({ width: 1024, height: 1024, quality: 'best' });
    const bmp = ni.toBitmap(); // BGRA
    const S = 1024, plane = S * S;
    const inp = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      inp[i]         = bmp[i * 4 + 2] / 255 - 0.5; // R
      inp[plane + i] = bmp[i * 4 + 1] / 255 - 0.5; // G
      inp[2*plane+i] = bmp[i * 4 + 0] / 255 - 0.5; // B
    }
    const t = Date.now();
    const r = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', inp, [1, 3, S, S]) });
    const o = r[s.outputNames[0]].data;
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < o.length; i++) { if (o[i] < mn) mn = o[i]; if (o[i] > mx) mx = o[i]; }
    const norm = i => (o[i] - mn) / ((mx - mn) || 1);
    const at = (x, y) => norm(y * S + x);
    // sujeto (centro de la taza) vs fondo (esquina cielo)
    const cup = (at(512, 540) + at(470, 430) + at(560, 430)) / 3;
    const sky = (at(60, 60) + at(960, 60) + at(60, 600)) / 3;
    console.log('RB_TEST cup=' + cup.toFixed(3) + ' sky=' + sky.toFixed(3) + ' ms=' + (Date.now() - t) +
      ' -> ' + (cup > 0.6 && sky < 0.2 ? 'OK (sujeto detectado, fondo fuera)' : 'REVISAR'));
  } catch (e) {
    console.log('RB_TEST_FAIL ' + e.message);
  }
  app.quit();
});
