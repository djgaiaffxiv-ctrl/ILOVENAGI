'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Icono estilo Instagram (degradado camara) para PadSnap.
const IG_ICON = `<svg class="ig" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="igGrad" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="#feda75"/><stop offset=".28" stop-color="#fa7e1e"/>
    <stop offset=".6" stop-color="#d62976"/><stop offset=".85" stop-color="#962fbf"/>
    <stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs>
  <rect x="2" y="2" width="20" height="20" rx="6" fill="none" stroke="url(#igGrad)" stroke-width="2.1"/>
  <circle cx="12" cy="12" r="5" fill="none" stroke="url(#igGrad)" stroke-width="2.1"/>
  <circle cx="17.6" cy="6.4" r="1.5" fill="url(#igGrad)"/>
</svg>`;

// ---------- definicion de herramientas ----------
// mode: 'single' (1 archivo) | 'combine' (varios -> 1 salida) | 'batch' (varios, misma opcion c/u)
const TOOLS = [
  { id:'compress', icon:'🗜️', title:'Comprimir PDF', badge:'TOP', fire:true,
    desc:'Reduce el peso al maximo conservando la calidad (motor Ghostscript).',
    accept:'pdf', mode:'batch',
    options:[
      { key:'preset', type:'chips', label:'Nivel de compresion', default:'recomendada', options:[
        {v:'extrema',label:'Extrema'},{v:'fuerte',label:'Fuerte'},
        {v:'recomendada',label:'Recomendada'},{v:'ligera',label:'Ligera'},
        {v:'impresion',label:'Impresion'},{v:'custom',label:'Personalizado'} ] },
      { key:'dpi', type:'range', label:'Resolucion imagenes (DPI)', min:36, max:400, step:2, default:150, suffix:' dpi', adv:true },
      { key:'quality', type:'range', label:'Calidad JPEG', min:30, max:98, step:1, default:80, suffix:'%', adv:true },
      { key:'grayscale', type:'checkbox', label:'Convertir a escala de grises (mas compresion)', default:false }
    ] },
  { id:'merge', icon:'🔗', title:'Unir PDF', desc:'Combina varios PDF en uno solo, en el orden que quieras.',
    accept:'pdf', mode:'combine', minFiles:2 },
  { id:'split', icon:'✂️', title:'Dividir PDF', desc:'Extrae rangos de paginas o separa en varios archivos.',
    accept:'pdf', mode:'single',
    options:[
      { key:'mode', type:'chips', label:'Modo', default:'ranges', options:[
        {v:'ranges',label:'Por rangos'},{v:'every',label:'Cada N paginas'},{v:'each',label:'1 archivo/pagina'} ] },
      { key:'ranges', type:'text', label:'Rangos (ej. 1-3,5,8-10)', placeholder:'1-3,5,8-10', default:'', showIf:{mode:'ranges'} },
      { key:'every', type:'number', label:'Paginas por archivo', default:1, min:1, showIf:{mode:'every'} }
    ] },
  { id:'rotate', icon:'🔄', title:'Rotar PDF', desc:'Gira paginas 90, 180 o 270 grados.',
    accept:'pdf', mode:'batch',
    options:[
      { key:'angle', type:'chips', label:'Angulo', default:'90', options:[
        {v:'90',label:'90°'},{v:'180',label:'180°'},{v:'270',label:'270°'} ] },
      { key:'pages', type:'text', label:'Paginas (vacio = todas)', placeholder:'1-3,5', default:'' }
    ] },
  { id:'organize', icon:'🗂️', title:'Organizar / Eliminar', desc:'Reordena o borra paginas concretas.',
    accept:'pdf', mode:'single',
    options:[
      { key:'remove', type:'text', label:'Paginas a eliminar (ej. 2,5-7)', placeholder:'2,5-7', default:'' },
      { key:'order', type:'text', label:'O nuevo orden (ej. 3,1,2,4)', placeholder:'3,1,2,4', default:'', isList:true }
    ] },
  { id:'watermark', icon:'💧', title:'Marca de agua', desc:'Anade texto en diagonal sobre cada pagina.',
    accept:'pdf', mode:'batch',
    options:[
      { key:'text', type:'text', label:'Texto', placeholder:'CONFIDENCIAL', default:'ILOVENAGI' },
      { key:'size', type:'range', label:'Tamano', min:18, max:120, step:2, default:54, suffix:'pt' },
      { key:'opacity', type:'range', label:'Opacidad', min:5, max:100, step:5, default:25, suffix:'%', pct:true },
      { key:'color', type:'color', label:'Color', default:'#ff4fa3' },
      { key:'diagonal', type:'checkbox', label:'En diagonal', default:true }
    ] },
  { id:'pagenumbers', icon:'🔢', title:'Numeros de pagina', desc:'Inserta numeracion automatica.',
    accept:'pdf', mode:'batch',
    options:[
      { key:'position', type:'select', label:'Posicion', default:'bottom-center', options:[
        {v:'bottom-center',label:'Abajo centro'},{v:'bottom-right',label:'Abajo derecha'},
        {v:'bottom-left',label:'Abajo izquierda'},{v:'top-center',label:'Arriba centro'},
        {v:'top-right',label:'Arriba derecha'},{v:'top-left',label:'Arriba izquierda'} ] },
      { key:'format', type:'text', label:'Formato ({n}=numero, {total}=total)', default:'{n} / {total}' },
      { key:'start', type:'number', label:'Empezar en', default:1, min:0 }
    ] },
  { id:'img2pdf', icon:'🖼️', title:'Imagenes a PDF', desc:'Convierte JPG/PNG en un PDF (1 pagina por imagen).',
    accept:'images', mode:'combine', minFiles:1 },
  { id:'pdf2img', icon:'📸', title:'PDF a imagenes', desc:'Exporta cada pagina como JPG o PNG (motor Ghostscript).',
    accept:'pdf', mode:'batch',
    options:[
      { key:'format', type:'chips', label:'Formato', default:'jpg', options:[{v:'jpg',label:'JPG'},{v:'png',label:'PNG'}] },
      { key:'dpi', type:'range', label:'Resolucion', min:72, max:600, step:6, default:150, suffix:' dpi' },
      { key:'quality', type:'range', label:'Calidad JPG', min:50, max:100, step:1, default:90, suffix:'%', showIf:{format:'jpg'} }
    ] },
  { id:'padsnap', icon:IG_ICON, title:'Ajustar con relleno', badge:'NUEVO', fire:true,
    desc:'Redimensiona imagenes anadiendo relleno (no recorta). Ideal para Instagram. Fondo color o desenfocado.',
    accept:'images', mode:'padsnap',
    options:[
      { key:'preset', type:'chips', label:'Tamano', default:'square', options:[
        {v:'square',label:'Cuadrado 1080'},{v:'portrait',label:'Vertical 1080×1350'},
        {v:'landscape',label:'Horizontal 1080×566'},{v:'story',label:'Story 1080×1920'},{v:'custom',label:'Personalizado'} ] },
      { key:'width', type:'number', label:'Ancho (px)', default:1080, min:1, showIf:{preset:'custom'} },
      { key:'height', type:'number', label:'Alto (px)', default:1080, min:1, showIf:{preset:'custom'} },
      { key:'bg', type:'chips', label:'Fondo', default:'blur', options:[{v:'blur',label:'Desenfocado'},{v:'color',label:'Color solido'}] },
      { key:'color', type:'color', label:'Color de fondo', default:'#ffffff', showIf:{bg:'color'} },
      { key:'blur', type:'range', label:'Intensidad de desenfoque', min:10, max:140, step:5, default:60, suffix:'px', showIf:{bg:'blur'} },
      { key:'zoom', type:'range', label:'Zoom de la imagen', min:40, max:100, step:1, default:100, suffix:'%' },
      { key:'format', type:'chips', label:'Formato', default:'jpg', options:[{v:'jpg',label:'JPG'},{v:'png',label:'PNG'}] }
    ] },
  { id:'protect', icon:'🔒', title:'Proteger PDF', desc:'Cifra con contrasena (AES-256) y restringe permisos.',
    accept:'pdf', mode:'batch',
    options:[
      { key:'password', type:'password', label:'Contrasena', placeholder:'tu contrasena', default:'' },
      { key:'noPrint', type:'checkbox', label:'Impedir impresion', default:false },
      { key:'noCopy', type:'checkbox', label:'Impedir copiar texto', default:false },
      { key:'noModify', type:'checkbox', label:'Impedir modificar', default:false }
    ] },
  { id:'unlock', icon:'🔓', title:'Desbloquear PDF', desc:'Quita la contrasena y las restricciones (motor qpdf).',
    accept:'pdf', mode:'batch',
    options:[
      { key:'password', type:'password', label:'Contrasena actual (si la tiene)', placeholder:'opcional', default:'' }
    ] },
  { id:'unprotect-excel', icon:'📊', title:'Desproteger Excel', desc:'Quita la proteccion de hojas/libro sin contrasena. Acepta todos los formatos: xlsx, xlsm, xls, xlsb y ods.',
    accept:'excel', mode:'batch' },
  { id:'textcase', icon:'🔤', title:'Mayúsculas / minúsculas', desc:'Pega texto y conviértelo a MAYÚSCULAS, minúsculas, Capitalizado o Tipo frase. Copia con un clic.',
    accept:'none', mode:'text' },
  { id:'office2pdf', icon:'📄', title:'Office a PDF', desc:'Word, Excel y PowerPoint a PDF (motor LibreOffice).',
    accept:'office', mode:'combine' },
  { id:'pdf2office', icon:'📝', title:'PDF a Office', desc:'Convierte PDF a Word, Excel o PowerPoint (aproximado).',
    accept:'pdf', mode:'combine',
    options:[
      { key:'target', type:'chips', label:'Convertir a', default:'docx', options:[
        {v:'docx',label:'Word'},{v:'xlsx',label:'Excel'},{v:'pptx',label:'PowerPoint'} ] }
    ] },
  { id:'ocr', icon:'🔍', title:'OCR (texto buscable)', desc:'Reconoce texto en PDF escaneados (motor Tesseract).',
    accept:'pdf', mode:'batch',
    options:[
      { key:'lang', type:'select', label:'Idioma', default:'spa+eng', options:[
        {v:'spa+eng',label:'Espanol + Ingles'},{v:'spa',label:'Espanol'},{v:'eng',label:'Ingles'} ] },
      { key:'dpi', type:'range', label:'Resolucion de escaneo', min:150, max:600, step:10, default:300, suffix:' dpi' }
    ] }
];

// ---------- estado ----------
let current = null;       // tool activa
let files = [];           // {path, name, size}
const optState = {};      // valores de opciones de la tool activa

// ---------- rejilla ----------
function renderGrid(){
  const grid = $('#grid');
  grid.innerHTML = '';
  TOOLS.forEach(t=>{
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<span class="ci">${t.icon}</span>
      <h3>${t.title}</h3><p>${t.desc}</p>
      ${t.badge?`<span class="badge ${t.fire?'fire':''}">${t.badge}</span>`:''}`;
    el.onclick = ()=>openTool(t);
    grid.appendChild(el);
  });
}

// ---------- abrir herramienta ----------
function openTool(t){
  current = t;
  files = [];
  for(const k in optState) delete optState[k];
  $('#home').classList.add('hidden');
  $('#toolView').classList.remove('hidden');
  $('#toolIcon').innerHTML = t.icon;
  $('#toolTitle').textContent = t.title;
  $('#toolDesc').textContent = t.desc;
  $('#dzText').textContent = acceptText(t);
  $('#result').classList.add('hidden');
  $('#logBox').classList.add('hidden');
  $('#logPre').textContent = '';
  // Herramientas de texto (sin archivos): ocultar zona de archivos y boton procesar
  const isText = t.mode === 'text';
  $('#dropzone').style.display = isText ? 'none' : '';
  $('#fileList').style.display = isText ? 'none' : '';
  document.querySelector('.run-row').style.display = isText ? 'none' : '';
  if(isText){ buildTextPanel(); }
  else { renderOptions(); renderFiles(); }
  window.scrollTo(0,0);
}

// ---------- herramienta de texto: MAYUS/minus ----------
function tcTransform(s, op){
  if(op==='upper') return s.toUpperCase();
  if(op==='lower') return s.toLowerCase();
  if(op==='title') return s.toLowerCase().replace(/[\p{L}\p{N}]+/gu, w => w.charAt(0).toUpperCase()+w.slice(1));
  if(op==='sentence') return s.toLowerCase().replace(/(^\s*[\p{L}])|([.!?…]\s*[\p{L}])/gu, m => m.toUpperCase());
  return s;
}
function buildTextPanel(){
  const box = $('#options');
  let op = 'upper';
  box.innerHTML =
    '<div class="opt-row"><label>Texto</label>'+
    '<textarea id="tcIn" class="tc-area" placeholder="Escribe o pega aquí tu texto…"></textarea></div>'+
    '<div class="opt-row"><label>Convertir a</label><div class="chips" id="tcOps">'+
      '<button class="chip active" data-op="upper">MAYÚSCULAS</button>'+
      '<button class="chip" data-op="lower">minúsculas</button>'+
      '<button class="chip" data-op="title">Capitalizar Palabras</button>'+
      '<button class="chip" data-op="sentence">Tipo frase</button>'+
    '</div></div>'+
    '<div class="opt-row"><label>Resultado</label>'+
    '<textarea id="tcOut" class="tc-area" readonly placeholder="Aquí aparece el resultado…"></textarea>'+
    '<div class="tc-actions"><button id="tcCopy" class="primary-btn">Copiar resultado</button>'+
    '<span id="tcCount" class="hint"></span></div></div>';
  const apply = () => {
    const v = $('#tcIn').value;
    $('#tcOut').value = tcTransform(v, op);
    $('#tcCount').textContent = v.length + ' caracteres';
  };
  $('#tcIn').oninput = apply;
  box.querySelectorAll('#tcOps .chip').forEach(b => b.onclick = () => {
    op = b.dataset.op;
    box.querySelectorAll('#tcOps .chip').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); apply();
  });
  $('#tcCopy').onclick = () => {
    const o = $('#tcOut'); if(!o.value) return;
    o.select(); try { document.execCommand('copy'); } catch(_){}
    window.getSelection().removeAllRanges();
    showToast('Copiado al portapapeles ✓');
  };
  apply();
}
function acceptText(t){
  const m = {pdf:'PDF', images:'imagenes JPG/PNG', excel:'hojas de cálculo (xlsx, xls, ods…)', office:'documentos de Office', any:'archivos'};
  const plural = (t.mode==='single')?'el archivo':'los archivos';
  return `Arrastra ${plural} ${m[t.accept]||''} aqui`;
}

function backHome(){
  $('#toolView').classList.add('hidden');
  $('#home').classList.remove('hidden');
}

// ---------- opciones ----------
function renderOptions(){
  const box = $('#options');
  box.innerHTML = '';
  (current.options||[]).forEach(o=>{ optState[o.key] = o.default; });
  if(current.id==='padsnap'){
    const pv=document.createElement('div'); pv.className='pad-preview'; pv.id='padPreview';
    pv.innerHTML='<div class="pv-empty">📷 Anade una imagen para ver la vista previa</div>';
    box.appendChild(pv);
  }
  (current.options||[]).forEach(o=> box.appendChild(buildOption(o)) );
  applyConditional();
  if(current.id==='compress') wireCompress();
  if(current.id==='padsnap') ensurePreviewImage();
}

function buildOption(o){
  const row = document.createElement('div');
  row.className = 'opt-row';
  row.dataset.key = o.key;

  if(o.type==='chips'){
    row.innerHTML = `<label>${o.label}</label>`;
    const chips = document.createElement('div'); chips.className='chips';
    o.options.forEach(c=>{
      const b=document.createElement('button'); b.className='chip'+(c.v===o.default?' active':''); b.textContent=c.label;
      b.onclick=()=>{ optState[o.key]=c.v; chips.querySelectorAll('.chip').forEach(x=>x.classList.remove('active')); b.classList.add('active'); applyConditional(); if(current.id==='compress') syncCompress(); if(current.id==='padsnap') updatePreview(); };
      chips.appendChild(b);
    });
    row.appendChild(chips);
  }
  else if(o.type==='range'){
    row.innerHTML = `<label>${o.label}: <b id="v_${o.key}">${o.default}${o.suffix||''}</b></label>`;
    const inp=document.createElement('input'); inp.type='range'; inp.min=o.min; inp.max=o.max; inp.step=o.step; inp.value=o.default;
    inp.oninput=()=>{ optState[o.key]=+inp.value; $('#v_'+o.key).textContent=inp.value+(o.suffix||''); };
    row.appendChild(inp);
  }
  else if(o.type==='number'){
    row.innerHTML = `<label>${o.label}</label>`;
    const inp=document.createElement('input'); inp.type='number'; inp.value=o.default; if(o.min!=null)inp.min=o.min; if(o.max!=null)inp.max=o.max;
    inp.oninput=()=>optState[o.key]=inp.value;
    row.appendChild(inp);
  }
  else if(o.type==='text'||o.type==='password'){
    row.innerHTML = `<label>${o.label}</label>`;
    const inp=document.createElement('input'); inp.type=o.type==='password'?'password':'text'; inp.placeholder=o.placeholder||''; inp.value=o.default||'';
    inp.oninput=()=>optState[o.key]=inp.value;
    row.appendChild(inp);
  }
  else if(o.type==='select'){
    row.innerHTML = `<label>${o.label}</label>`;
    const sel=document.createElement('select');
    o.options.forEach(c=>{ const op=document.createElement('option'); op.value=c.v; op.textContent=c.label; if(c.v===o.default)op.selected=true; sel.appendChild(op); });
    sel.onchange=()=>{ optState[o.key]=sel.value; applyConditional(); };
    row.appendChild(sel);
  }
  else if(o.type==='color'){
    row.className='opt-row inline';
    row.innerHTML = `<label>${o.label}</label>`;
    const inp=document.createElement('input'); inp.type='color'; inp.value=o.default;
    inp.oninput=()=>optState[o.key]=inp.value;
    row.appendChild(inp);
  }
  else if(o.type==='checkbox'){
    const lab=document.createElement('label'); lab.className='chk';
    const inp=document.createElement('input'); inp.type='checkbox'; inp.checked=!!o.default;
    inp.onchange=()=>optState[o.key]=inp.checked;
    lab.appendChild(inp); lab.appendChild(document.createTextNode(' '+o.label));
    row.appendChild(lab);
  }
  return row;
}

// muestra/oculta opciones segun showIf, y oculta avanzadas salvo en compresion personalizada
function applyConditional(){
  (current.options||[]).forEach(o=>{
    const row = $(`.opt-row[data-key="${o.key}"]`);
    if(!row) return;
    let show = true;
    if(o.showIf){ for(const k in o.showIf) if(optState[k]!==o.showIf[k]) show=false; }
    if(o.adv && current.id==='compress' && optState.preset!=='custom') show=false;
    row.style.display = show ? '' : 'none';
  });
}

// en compresion, al elegir preset actualiza sliders avanzados
const COMPRESS_VALUES = { extrema:{dpi:72,q:60}, fuerte:{dpi:110,q:70}, recomendada:{dpi:150,q:80}, ligera:{dpi:200,q:88}, impresion:{dpi:300,q:92} };
function wireCompress(){ syncCompress(); }
function syncCompress(){
  const p = optState.preset;
  if(p && p!=='custom' && COMPRESS_VALUES[p]){
    optState.dpi = COMPRESS_VALUES[p].dpi;
    optState.quality = COMPRESS_VALUES[p].q;
    const dr=$('input[type=range]'); // actualizar visual de los dos sliders
    const setR=(key,val)=>{ const row=$(`.opt-row[data-key="${key}"]`); if(row){ const i=row.querySelector('input'); if(i)i.value=val; const b=$('#v_'+key); if(b)b.textContent=val+(key==='dpi'?' dpi':'%'); } };
    setR('dpi', optState.dpi); setR('quality', optState.quality);
  }
}

// ---------- archivos ----------
function addFiles(paths){
  paths.forEach(p=>{
    if(files.some(f=>f.path===p)) return;
    files.push({ path:p, name:p.split(/[\\/]/).pop() });
  });
  if(current.mode==='single' && files.length>1) files = files.slice(-1);
  renderFiles();
}
function renderFiles(){
  const ul=$('#fileList'); ul.innerHTML='';
  files.forEach((f,idx)=>{
    const li=document.createElement('li');
    const reorder = current.mode==='combine' && files.length>1;
    li.innerHTML = `${reorder?'<span class="drag-h" draggable="true">⠿</span>':''}<span class="fi">📄</span>
      <span class="name">${f.name}</span>
      <span class="meta">${f.sizeText||''}</span>
      <button class="rm" title="Quitar">✕</button>`;
    li.querySelector('.rm').onclick=()=>{ files.splice(idx,1); renderFiles(); updateRun(); };
    if(reorder) setupDrag(li, idx);
    ul.appendChild(li);
  });
  updateRun();
  if(current && current.id==='padsnap') ensurePreviewImage();
}
function setupDrag(li, idx){
  const h=li.querySelector('.drag-h');
  h.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/idx', idx); });
  li.addEventListener('dragover', e=>e.preventDefault());
  li.addEventListener('drop', e=>{
    e.preventDefault();
    const from=+e.dataTransfer.getData('text/idx');
    if(isNaN(from)||from===idx) return;
    const [m]=files.splice(from,1); files.splice(idx,0,m); renderFiles();
  });
}
function updateRun(){
  const min = current.minFiles || 1;
  const ok = files.length>=min;
  $('#runBtn').disabled = !ok;
  $('#runHint').textContent = ok ? '' : (min>1?`Necesitas al menos ${min} archivos.`:'Anade un archivo.');
}

// ---------- PadSnap (procesado con Canvas en el renderer) ----------
const PAD_PRESETS = { square:{w:1080,h:1080}, portrait:{w:1080,h:1350}, landscape:{w:1080,h:566}, story:{w:1080,h:1920} };
function loadImage(src){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error('No se pudo leer la imagen')); i.src=src; }); }
function padDims(o){
  if(o.preset==='custom') return { W:Math.max(1,+o.width||1080), H:Math.max(1,+o.height||1080) };
  const d=PAD_PRESETS[o.preset]||PAD_PRESETS.square; return { W:d.w, H:d.h };
}
function makePaddedCanvas(img, W, H, o){
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const ctx=cv.getContext('2d');
  if(o.bg==='color'){
    ctx.fillStyle=o.color||'#ffffff'; ctx.fillRect(0,0,W,H);
  } else {
    // fondo: imagen ampliada para cubrir todo + desenfoque
    const cover=Math.max(W/img.width, H/img.height)*1.15;
    const cw=img.width*cover, ch=img.height*cover;
    ctx.filter='blur('+(o.blur||60)+'px)';
    ctx.drawImage(img,(W-cw)/2,(H-ch)/2,cw,ch);
    ctx.filter='none';
  }
  // imagen principal: encajada (contain) y centrada, escalada por zoom
  const fit=Math.min(W/img.width, H/img.height)*((o.zoom||100)/100);
  const dw=img.width*fit, dh=img.height*fit;
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh);
  return cv;
}
function renderPadded(img, W, H, o){
  const cv=makePaddedCanvas(img,W,H,o);
  return o.format==='png' ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg',0.92);
}

// ---- vista previa en vivo ----
let previewImg=null, previewPath=null;
async function ensurePreviewImage(){
  if(!current || current.id!=='padsnap'){ previewImg=null; previewPath=null; return; }
  if(!files.length){ previewImg=null; previewPath=null; updatePreview(); return; }
  if(files[0].path===previewPath && previewImg){ updatePreview(); return; }
  try{
    const rd=await window.siri.readFileB64(files[0].path);
    if(!rd.ok) throw new Error(rd.error);
    previewImg=await loadImage('data:'+rd.mime+';base64,'+rd.b64);
    previewPath=files[0].path;
  }catch(_){ previewImg=null; previewPath=null; }
  updatePreview();
}
function updatePreview(){
  if(!current || current.id!=='padsnap') return;
  const holder=$('#padPreview'); if(!holder) return;
  if(!files.length || !previewImg){
    holder.innerHTML='<div class="pv-empty">📷 Anade una imagen para ver la vista previa</div>';
    return;
  }
  const { W, H } = padDims(optState);
  const cv=makePaddedCanvas(previewImg, W, H, optState);
  cv.className='pv-canvas';
  holder.innerHTML='';
  holder.appendChild(cv);
  const lab=document.createElement('div'); lab.className='pv-label';
  lab.textContent=W+' × '+H+' px'+(files.length>1?'  ·  vista previa de la 1ª de '+files.length:'');
  holder.appendChild(lab);
}
async function processPadsnap(){
  const o={...optState};
  let W,H;
  if(o.preset==='custom'){ W=Math.max(1,+o.width||1080); H=Math.max(1,+o.height||1080); }
  else { const d=PAD_PRESETS[o.preset]||PAD_PRESETS.square; W=d.w; H=d.h; }
  const results=[];
  for(const f of files){
    try{
      const rd=await window.siri.readFileB64(f.path);
      if(!rd.ok) throw new Error(rd.error);
      const img=await loadImage('data:'+rd.mime+';base64,'+rd.b64);
      const dataUrl=renderPadded(img,W,H,o);
      const ext=o.format==='png'?'png':'jpg';
      const base=rd.name.replace(/\.[^.]+$/,'');
      const sv=await window.siri.saveDataUrl({ dir:rd.dir, base, suffix:'-padsnap', ext, dataUrl });
      if(!sv.ok) throw new Error(sv.error);
      results.push({ ok:true, outputs:[sv.path], message:rd.name+'  →  '+W+'×'+H+' px' });
    }catch(e){ results.push({ ok:false, file:f.path, error:e.message }); }
  }
  return results;
}

// ---------- ejecutar ----------
async function runTool(){
  const overlay=$('#overlay');
  $('#overlayText').textContent = (current.mode==='batch'||current.mode==='padsnap') && files.length>1 ? `Procesando ${files.length} archivos...` : 'Procesando...';
  overlay.classList.remove('hidden');
  $('#logPre').textContent=''; $('#logBox').classList.remove('hidden');
  $('#result').classList.add('hidden');

  // PadSnap se resuelve en el navegador con Canvas
  if(current.id==='padsnap'){
    try{ showResult(await processPadsnap()); }
    catch(err){ showError(err.message||String(err)); }
    finally{ overlay.classList.add('hidden'); }
    return;
  }
  const paths = files.map(f=>f.path);
  const opts = {...optState};
  if(current.id==='organize' && opts.order){ opts.order = opts.order.split(',').map(s=>s.trim()).filter(Boolean); }
  // compresion: si no es custom, no mandar dpi/quality (usa preset)
  if(current.id==='compress' && opts.preset!=='custom'){ delete opts.dpi; delete opts.quality; }
  if(current.id==='watermark' && opts.opacity!=null) opts.opacity = opts.opacity/100;

  try{
    let results;
    if(current.mode==='batch' && paths.length>1){
      const arr = await window.siri.runBatch(current.id, paths, opts);
      results = arr;
    } else {
      const r = await window.siri.run(current.id, { files: paths, options: opts });
      results = [r];
    }
    showResult(results);
  }catch(err){
    showError(err.message||String(err));
  }finally{
    overlay.classList.add('hidden');
  }
}

function showResult(results){
  const box=$('#result'); box.classList.remove('hidden','err');
  const failed = results.filter(r=>!r.ok);
  const oks = results.filter(r=>r.ok);
  const missing = failed.find(r=>r.missingDep);
  let html='';
  if(oks.length){
    html += `<h4>✅ Listo</h4>`;
    oks.forEach(r=>{
      if(r.message) html += `<div class="msg">${r.message}</div>`;
      (r.outputs||[]).slice(0,40).forEach(p=>{
        const name=p.split(/[\\/]/).pop();
        html += `<div class="out"><span class="fi">📄</span><span class="name">${name}</span>
          <span class="acts"><button class="mini" data-open="${esc(p)}">Abrir</button>
          <button class="mini" data-reveal="${esc(p)}">Ver carpeta</button></span></div>`;
      });
      if(r.openDir) html += `<div class="out"><span class="name">📁 ${r.openDir.split(/[\\/]/).pop()}</span>
        <span class="acts"><button class="mini" data-folder="${esc(r.openDir)}">Abrir carpeta</button></span></div>`;
    });
  }
  if(failed.length){
    if(!oks.length) box.classList.add('err');
    html += `<h4 style="margin-top:14px">⚠ ${failed.length} con error</h4>`;
    failed.forEach(r=>{ html += `<div class="msg">${r.file?('• '+r.file.split(/[\\/]/).pop()+': '):''}${r.error}</div>`; });
    if(missing){
      html += `<button class="primary-btn" id="installFromErr">Instalar componente necesario</button>`;
    }
  }
  box.innerHTML = `<div class="outs">${html}</div>`;
  box.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>window.siri.openPath(b.dataset.open));
  box.querySelectorAll('[data-reveal]').forEach(b=>b.onclick=()=>window.siri.reveal(b.dataset.reveal));
  box.querySelectorAll('[data-folder]').forEach(b=>b.onclick=()=>window.siri.openFolder(b.dataset.folder));
  const inst=$('#installFromErr');
  if(inst) inst.onclick=()=>{ openDeps(); if(missing) installDep(missing.missingDep); };
}
function showError(msg){
  const box=$('#result'); box.classList.remove('hidden'); box.classList.add('err');
  box.innerHTML = `<div class="outs"><h4>⚠ Error</h4><div class="msg">${msg}</div></div>`;
}
function esc(s){ return String(s).replace(/"/g,'&quot;'); }

let toastTimer=null;
function showToast(msg){
  let t=$('#toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'), 6000);
}

// ---------- dependencias ----------
async function openDeps(){
  $('#depModal').classList.remove('hidden');
  await refreshDeps();
}
async function refreshDeps(){
  const st = await window.siri.depsStatus();
  const list=$('#depList'); list.innerHTML='';
  let allCore=true;
  Object.entries(st).forEach(([key,d])=>{
    if((key==='ghostscript'||key==='qpdf') && !d.installed) allCore=false;
    const el=document.createElement('div'); el.className='dep';
    el.innerHTML = `<div class="info"><b>${d.label}</b><span>${d.purpose}</span></div>
      <span class="state ${d.installed?'on':'off'}">${d.installed?'Instalado':'No instalado'}</span>
      ${d.installed?'':`<button class="primary-btn" data-inst="${key}">Instalar</button>`}`;
    list.appendChild(el);
  });
  list.querySelectorAll('[data-inst]').forEach(b=> b.onclick=()=>installDep(b.dataset.inst));
  $('#depDot').className = 'dot ' + (allCore?'ok':'warn');
  // boton "Instalar todo" si falta alguno
  const missing = Object.entries(st).filter(([k,d])=>!d.installed).map(([k])=>k);
  if(missing.length){
    const wrap=document.createElement('div'); wrap.style.marginTop='14px';
    wrap.innerHTML = `<button id="instAll" class="primary-btn big" style="width:100%">⬇ Instalar todo (${missing.length})</button>`;
    list.appendChild(wrap);
    $('#instAll').onclick=()=>installAll(missing);
  }
}
let installing=false;
async function installDep(key){
  if(installing) return; installing=true;
  const log=$('#depLog'); log.classList.remove('hidden');
  const btns=$$('#depList [data-inst], #instAll'); btns.forEach(b=>b.disabled=true);
  log.textContent += '\n— Instalando '+key+' —\n';
  const r = await window.siri.installDep(key);
  log.textContent += (r.ok ? '✔ '+r.message : '✘ '+r.message) + '\n';
  installing=false;
  await refreshDeps();
  return r;
}
async function installAll(keys){
  if(installing) return;
  for(const key of keys){ await installDep(key); }
  showToast('Componentes instalados ✓');
}

// ---------- eventos ----------
function setupDropzone(){
  const dz=$('#dropzone');
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag');}));
  dz.addEventListener('drop',e=>{
    const dropped=[];
    for(const f of e.dataTransfer.files){ const p=window.siri.pathFor(f); if(p) dropped.push(p); }
    if(dropped.length) addFiles(dropped);
  });
  $('#pickBtn').onclick=async()=>{ const p=await window.siri.pickFiles(current.accept); if(p.length) addFiles(p); };
}

function init(){
  renderGrid();
  setupDropzone();
  $('#backBtn').onclick=backHome;
  $('#runBtn').onclick=runTool;
  // vista previa PadSnap: un solo listener para todas las opciones
  $('#options').addEventListener('input', ()=>updatePreview());
  $('#options').addEventListener('change', ()=>updatePreview());
  $('#btnComponents').onclick=openDeps;
  // controles de ventana
  $('#winMin').onclick=()=>window.siri.winMinimize();
  $('#winMax').onclick=()=>window.siri.winMaximize();
  $('#winClose').onclick=()=>window.siri.winClose();
  window.siri.onWinState(max=>document.body.classList.toggle('maximized', !!max));
  $('#depClose').onclick=()=>$('#depModal').classList.add('hidden');
  $('#depModal').addEventListener('click',e=>{ if(e.target.id==='depModal') $('#depModal').classList.add('hidden'); });
  window.siri.onUpdate(d=>{
    if(d.state==='available') showToast('⬇ Descargando actualizacion '+(d.version||'')+'...');
    else if(d.state==='downloading') showToast('⬇ Actualizacion: '+d.percent+'%');
    else if(d.state==='ready') showToast('✅ Actualizacion '+(d.version||'')+' lista. Reinicia para aplicarla.');
  });
  window.siri.onLog(line=>{ const pre=$('#logPre'); pre.textContent += line; pre.scrollTop=pre.scrollHeight; });
  window.siri.onDepLog(({line})=>{ const log=$('#depLog'); log.classList.remove('hidden'); log.textContent += line+'\n'; log.scrollTop=log.scrollHeight; });
  refreshDeps();
}
document.addEventListener('DOMContentLoaded', init);
