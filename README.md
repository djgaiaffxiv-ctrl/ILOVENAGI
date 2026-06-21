# ILOVESIRI 💗

Suite PDF de escritorio (Electron) que hace **todo lo de iLovePDF pero mejor**: sin marcas de agua, sin límites de tamaño y **100% local** (nada se sube a internet). Estética gacha-neón.

## Arrancar

Doble clic en **`ILOVESIRI.bat`** (la primera vez instala dependencias solo).
O desde terminal:

```
npm install
npm start
```

## Herramientas

| Herramienta | Motor | Notas |
|---|---|---|
| 🗜️ Comprimir PDF | Ghostscript | Compresión real con control de DPI/calidad. Lote. |
| 🔗 Unir | pdf-lib | Reordenable arrastrando. |
| ✂️ Dividir | pdf-lib | Rangos, cada N, o 1 por página. |
| 🔄 Rotar | pdf-lib | 90/180/270, páginas concretas. Lote. |
| 🗂️ Organizar/Eliminar | pdf-lib | Reordenar o borrar páginas. |
| 💧 Marca de agua | pdf-lib | Texto, color, opacidad, diagonal. Lote. |
| 🔢 Números de página | pdf-lib | Posición y formato. Lote. |
| 📐 Ajustar con relleno (PadSnap) | Canvas | Redimensiona imágenes con padding (no recorta) a tamaños de redes; fondo color o desenfocado, zoom, lote. |
| 📊 Desproteger Excel | adm-zip | Quita protección de hojas/libro de .xlsx/.xlsm sin contraseña. |
| 🖼️ Imágenes a PDF | pdf-lib | JPG/PNG. |
| 📸 PDF a imágenes | Ghostscript | JPG/PNG, DPI configurable. Lote. |
| 🔒 Proteger | qpdf | AES-256 + permisos. Lote. |
| 🔓 Desbloquear | qpdf | Quita contraseña/restricciones. Lote. |
| 📄 Office a PDF | LibreOffice | Word/Excel/PPT → PDF. |
| 📝 PDF a Office | LibreOffice | Aproximado. |
| 🔍 OCR | Ghostscript + Tesseract | PDF escaneado → texto buscable. |

## Componentes (autoinstalación)

Los motores externos se instalan **solos** con `winget` al pulsar **⚙ Componentes** o cuando una herramienta los necesita:

- **Ghostscript** — `ArtifexSoftware.GhostScript` (compresión + PDF→imagen + OCR)
- **qpdf** — `qpdf.qpdf` (seguridad)
- **LibreOffice** — `TheDocumentFoundation.LibreOffice` (Office)
- **Tesseract OCR** — `UB-Mannheim.TesseractOCR` (OCR)

> Tras instalar un componente puede hacer falta cerrar y reabrir ILOVESIRI si no se detecta al instante.

## Sobre la compresión

El nivel **Recomendada** suele igualar o superar a iLovePDF. Para máximo ahorro usa **Extrema** o el modo **Personalizado** (DPI + calidad JPEG + escala de grises). Si el PDF ya estaba optimizado, ILOVESIRI lo detecta y no lo agranda.
