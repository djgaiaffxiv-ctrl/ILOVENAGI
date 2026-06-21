'use strict';
// Crea un .xlsx minimo con <sheetProtection> y verifica que unprotectExcel lo elimina.
const fs = require('fs'); const path = require('path'); const os = require('os');
const AdmZip = require('adm-zip');
const tools = require('../lib/pdftools');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'siri-xls-'));
  const f = path.join(dir, 'protegido.xlsx');

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'));
  zip.addFile('xl/workbook.xml', Buffer.from('<?xml version="1.0"?><workbook><workbookProtection lockStructure="1" workbookPassword="ABCD"/><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>'));
  zip.addFile('xl/worksheets/sheet1.xml', Buffer.from('<?xml version="1.0"?><worksheet><sheetData/><sheetProtection sheet="1" password="CC3F" selectLockedCells="1"/></worksheet>'));
  zip.writeZip(f);
  console.log('Creado xlsx con proteccion.');

  const r = await tools.unprotectExcel(f, {});
  console.log('RESULTADO: ' + r.message);

  // verificar que ya no hay proteccion
  const out = new AdmZip(r.outputs[0]);
  const ws = out.getEntry('xl/worksheets/sheet1.xml').getData().toString();
  const wb = out.getEntry('xl/workbook.xml').getData().toString();
  const ok = !/sheetProtection/.test(ws) && !/workbookProtection/.test(wb);
  console.log(ok ? 'OK: proteccion eliminada y zip valido.' : 'XX: aun queda proteccion.');

  // probar rechazo de .xls
  try { await tools.unprotectExcel(path.join(dir, 'x.xls'), {}); console.log('XX: deberia rechazar .xls'); }
  catch (e) { console.log('OK: rechaza .xls (' + e.message.slice(0, 30) + '...)'); }

  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(ok ? 0 : 1);
})();
