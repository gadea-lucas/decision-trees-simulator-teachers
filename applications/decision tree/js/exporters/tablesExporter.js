
// ==========================
// EXPORT TABLES
// Text, SVG and HTML format
// ==========================
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getTableRoot(which /* 'data' | 'value' */) {
  const wrapId = which === 'data' ? 'dataTable' : 'valueTable';
  const wrap = document.getElementById(wrapId);
  if (!wrap) { alert(`No se encontró #${wrapId}`); return null; }
  const table = wrap.querySelector('table') || wrap.querySelector('.table-wrapper > *') || wrap.firstElementChild || wrap;
  if (!table || !wrap.innerText.trim()) { alert(`La tabla ${which} está vacía en este paso.`); return null; }
  return table;
}

function inlineAllStyles(root) {
  const PROPS = [
    'display','position','box-sizing','width','height','min-width','min-height','max-width','max-height',
    'padding','padding-top','padding-right','padding-bottom','padding-left',
    'margin','margin-top','margin-right','margin-bottom','margin-left',
    'font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','white-space',
    'color','background','background-color',
    'border','border-top','border-right','border-bottom','border-left',
    'border-collapse','border-spacing','border-color','border-width','border-style','vertical-align'
  ];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let el = root;
  while (el) {
    const cs = getComputedStyle(el);
    const stylePairs = [];
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p);
      if (v && v !== 'normal' && v !== 'auto' && v !== '0px' && v !== 'initial') {
        stylePairs.push(`${p}:${v}`);
      }
    }
    if (stylePairs.length) el.setAttribute('style', stylePairs.join(';'));
    el = walker.nextNode();
  }
}

function collectCssForElement(rootEl) {
  let css = '';

  // 1) <style> inline
  for (const s of document.querySelectorAll('style')) {
    if (s.textContent) css += '\n' + s.textContent;
  }

  // 2) <link> same-origin + reglas relevantes
  for (const sheet of Array.from(document.styleSheets)) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;

    for (const rule of rules) {
      // Detecta @font-face y @keyframes de forma robusta
      const isFontFace = (typeof CSSFontFaceRule !== 'undefined' && rule instanceof CSSFontFaceRule) ||
                         rule.type === CSSRule.FONT_FACE_RULE ||
                         rule.cssText?.startsWith?.('@font-face');

      const isKeyframes = (typeof CSSKeyframesRule !== 'undefined' && rule instanceof CSSKeyframesRule) ||
                          rule.type === CSSRule.KEYFRAMES_RULE ||
                          rule.cssText?.startsWith?.('@keyframes');

      if (isFontFace || isKeyframes) { css += '\n' + rule.cssText; continue; }

      if (rule.selectorText) {
        const selectors = rule.selectorText.split(',').map(s => s.trim()).filter(Boolean);
        let matches = false;
        for (const sel of selectors) {
          try { if (rootEl.querySelector(sel)) { matches = true; break; } } catch {}
        }
        if (matches) css += '\n' + rule.cssText;
      }
    }
  }

  // 3) Overrides para unificar SÓLO separadores horizontales
  //    - Gris fino (ajusta el color si quieres)
  //    - Sin borde arriba del todo (primera fila)
  //    - Conserva bordes verticales existentes
  const tableSel = rootEl.matches('table') && rootEl.classList.contains('table') ? '.table' : 'table';
  css += `
/* === Export overrides: horizontal separators only === */
${tableSel} th, ${tableSel} td {
  /* no tocamos left/right; sólo verticales horizontales */
  border-top: none !important;
  border-bottom: none !important;
}

/* A partir de la segunda fila, dibuja el separador horizontal */
${tableSel} tr + tr > th,
${tableSel} tr + tr > td {
  border-top: 1px solid #bbb !important; /* gris fino */
}

/* Nunca dibujar borde por encima de la primera fila (encabezado) */
${tableSel} thead tr:first-child > th,
${tableSel} thead tr:first-child > td,
${tableSel} tbody tr:first-child > th,
${tableSel} tbody tr:first-child > td,
${tableSel} tr:first-child > th,
${tableSel} tr:first-child > td {
  border-top: none !important;
}
`;

  return css;
}

function extractCurrentRules() {
  const wrap = document.getElementById('dataTable');
  if (!wrap) return '';
  // 1) por id/clase típica
  const el = wrap.querySelector('#currentRules, .current-rules');
  if (el) return el.innerText.trim();
  // 2) por texto
  const txt = wrap.innerText || '';
  const m = txt.match(/Current rule\s*:?\s*[^\n\r]*/i);
  return m ? m[0].trim() : '';
}

function cellText(el) {
  // Reemplaza saltos por '; ', compacta espacios
  let t = el.innerText.replace(/\s*\n\s*/g, '; ').replace(/\s+/g, ' ').trim();
  return t;
}

function verticalDividerRule(table) {
  // Ámbito del selector (igual que en exportTableHTML)
  const scope = (table.matches('table') && table.classList.contains('table')) ? '.table' : 'table';

  // Identificar filas del "body" (excluyendo header)
  const hasThead = !!table.querySelector('thead');
  const bodyRowSel = hasThead ? 'tbody tr' : 'tr:not(:first-child)';

  // Tomamos una fila de ejemplo del body para deducir estilos
  const sampleRow = table.querySelector(`${bodyRowSel}`);
  if (!sampleRow) return '';

  const firstCell = sampleRow.querySelector('th,td');
  const lastCell  = sampleRow.querySelector('th:last-child,td:last-child');

  // Estilos detectados (con fallbacks)
  const csFirst = firstCell ? getComputedStyle(firstCell) : null;
  const csLast  = lastCell  ? getComputedStyle(lastCell)  : null;

  // Borde a la derecha de la PRIMERA celda
  let rightW   = Math.max(1, parseFloat(csFirst?.borderRightWidth || '0') || 1);
  let rightCol = csFirst?.borderRightColor || '#000';

  // Borde a la izquierda de la ÚLTIMA celda
  let leftW    = Math.max(1, parseFloat(csLast?.borderLeftWidth || '0') || 1);
  let leftCol  = csLast?.borderLeftColor || '#000';

  // Regla final: sólo body; no tocar header
  // (si no hay <thead>, excluimos la primera fila con :not(:first-child))
  return `
${scope} ${bodyRowSel} > th:first-child,
${scope} ${bodyRowSel} > td:first-child { border-right: ${rightW}px solid ${rightCol} !important; }

${scope} ${bodyRowSel} > th:last-child,
${scope} ${bodyRowSel} > td:last-child  { border-left:  ${leftW}px  solid ${leftCol}  !important; }
`;
}


// =================
// Export to SVG
// =================

function sanitizeCss(cssText) {
  // 1) elimina reglas problemáticas (filtros, expresiones, etc.)
  let cleaned = cssText
    .replace(/progid:[^;]+;?/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/behavior\s*:[^;]+;?/gi, '')
    .replace(/-ms-filter\s*:[^;]+;?/gi, '')
    .replace(/filter\s*:[^;]+;?/gi, '')
    .replace(/url\(["']?javascript:[^"')]+["']?\)/gi, '')
    .replace(/<!--|-->/g, '') // limpia comentarios XML
    .trim();

  // 2) escapa caracteres ilegales para XML
  cleaned = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return cleaned;
}

function exportTableSVG(which, filename) {
  const table = getTableRoot(which);
  if (!table) return;

  // === 1) Clonar tabla y estilos ===
  const tableClone = table.cloneNode(true);
  inlineAllStyles(tableClone);

  // asegurar colapso de bordes (igual que en HTML export)
  const s = tableClone.getAttribute('style') || '';
  if (!/border-collapse/.test(s)) {
    tableClone.setAttribute('style', s + (s ? ';' : '') + 'border-collapse:collapse;border-spacing:0;');
  }

  // === 2) Obtener el CSS aplicado + verticalDividerRule ===
  const css = collectCssForElement(table);
  const extra = verticalDividerRule(table);
  const sanitized = sanitizeCss((css || '') + (extra || ''));
  const fullCss = `<style>${sanitized}</style>`;


  // === 3) Construir el contenido XHTML del foreignObject ===
  const htmlContent = `
    <div xmlns="http://www.w3.org/1999/xhtml"
         style="font-family:system-ui,Segoe UI,Roboto,Arial,Helvetica,sans-serif;
                color:#111; background:#fff; display:inline-block;">
      ${fullCss}
      ${tableClone.outerHTML}
    </div>
  `;

  // === 4) Medidas reales ===
  const rect = table.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);

  // === 5) Construir SVG con el HTML incrustado ===
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${width}" height="${height}"
         viewBox="0 0 ${width} ${height}">
      <foreignObject x="0" y="0" width="100%" height="100%">
        ${htmlContent}
      </foreignObject>
    </svg>
  `;

  // === 6) Descargar ===
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename || `${which}-table.svg`);
}

// =================
// Export to HTML
// =================

function exportTableHTML(which, filename) {
  const table = getTableRoot(which);
  if (!table) return;

  const tableClone = table.cloneNode(true);
  
  // 1) estilos computados inline (conservar bordes verticales)
  inlineAllStyles(tableClone);

  // asegura colapso de bordes (lo que usa Bootstrap)
  if (tableClone.tagName.toLowerCase() === 'table') {
    const s = tableClone.getAttribute('style') || '';
    if (!/border-collapse/.test(s)) {
      tableClone.setAttribute('style', s + (s ? ';' : '') + 'border-collapse:collapse; border-spacing:0;');
    }
  }

  // 2) reglas CSS que aplican (por si hay otras decoraciones)
  const css = collectCssForElement(table);

  const extra = verticalDividerRule(table);
  const styleBlock = `<style>${css || ''}${extra || ''}</style>`;


  const title = which === 'data' ? 'Data Table' : 'Value Table';
  const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${styleBlock}
</head>
<body style="margin:16px;font-family:system-ui,Segoe UI,Roboto,Arial,Helvetica,sans-serif">
  <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
  ${tableClone.outerHTML}
</body></html>`;

  downloadBlob(new Blob([html], { type:'text/html;charset=utf-8'}), filename || `${which}-table.html`);
}

// =================
// Export to TXT
// =================
function exportTableTXT(which, filename) {
  const table = getTableRoot(which);
  if (!table) return;

  const headerLines = [];
  if (which === 'data') {
    const rules = extractCurrentRules();
    if (rules) headerLines.push(rules);
  }

  const trs = Array.from(table.querySelectorAll('tr'));
  if (!trs.length) {
    const plain = (headerLines.length ? headerLines.join('\n')+'\n\n' : '') + (table.innerText||'');
    downloadBlob(new Blob([plain], {type:'text/plain;charset=utf-8'}), filename || `${which}-table.txt`);
    return;
  }

  // Construye grid con rowspan/colspan
  const grid = [];
  let maxCols = 0;
  const pending = []; // {row,col,rowsLeft,text}

  trs.forEach((tr, rIdx) => {
    if (!grid[rIdx]) grid[rIdx] = [];
    let cIdx = 0;

    // avanza por columnas saltando ocupadas por rowspans activos
    function nextFreeCol() {
      while (grid[rIdx][cIdx] != null) cIdx++;
    }

    // coloca cells heredadas por rowspan de filas anteriores
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      if (p.rowsLeft > 0) {
        if (!grid[rIdx][p.col]) grid[rIdx][p.col] = p.text;
        p.rowsLeft--;
      }
    }

    const cells = Array.from(tr.querySelectorAll('th,td'));
    for (const td of cells) {
      nextFreeCol();
      const colSpan = parseInt(td.getAttribute('colspan') || '1', 10);
      const rowSpan = parseInt(td.getAttribute('rowspan') || '1', 10);
      const text = cellText(td);

      // escribe este bloque en el grid (repetimos el texto en columnas del colspan)
      for (let k = 0; k < colSpan; k++) {
        grid[rIdx][cIdx + k] = text;
      }
      // propaga a filas siguientes si hay rowspan
      if (rowSpan > 1) {
        pending.push({ col: cIdx, rowsLeft: rowSpan - 1, text });
      }

      cIdx += colSpan;
      if (cIdx > maxCols) maxCols = cIdx;
    }

    // limpia pendings agotados
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i].rowsLeft <= 0) pending.splice(i,1);
  });

  // rellena huecos vacíos con ''
  grid.forEach(r => { for (let i=0;i<maxCols;i++) if (r[i]==null) r[i]=''; });

  // calcula anchos y compone tabla con | y padding monoespaciado
  const widths = Array(maxCols).fill(0);
  grid.forEach(r => r.forEach((v,i)=>{ if((v||'').length>widths[i]) widths[i]=(v||'').length; }));

  const sep = '+' + widths.map(w => '-'.repeat(w+2)).join('+') + '+';
  const lines = [];
  if (headerLines.length) { lines.push(...headerLines, ''); }
  lines.push(sep);
  grid.forEach((row, idx) => {
    const cells = row.map((v,i)=>' '+(v||'') + ' '.repeat(widths[i]- (v||'').length) + ' ');
    lines.push('|' + cells.join('|') + '|');
    if (idx === 0) lines.push(sep); // separador tras cabecera
  });
  lines.push(sep);

  const blob = new Blob([lines.join('\n')], {type:'text/plain;charset=utf-8'});
  downloadBlob(blob, filename || `${which}-table.txt`);
}


// =================
// WIRE BUTTONS
// =================
function wireTableExportButtons() {
  // Table 1: Data
  document.getElementById('btnExportDataTxt') ?.addEventListener('click', () => exportTableTXT ('data','data-table.txt'));
  document.getElementById('btnExportDataSvg') ?.addEventListener('click', () => exportTableSVG ('data','data-table.svg'));
  document.getElementById('btnExportDataHtml')?.addEventListener('click', () => exportTableHTML('data','data-table.html'));
  // Table 2: Value
  document.getElementById('btnExportValueTxt') ?.addEventListener('click', () => exportTableTXT ('value','value-table.txt'));
  document.getElementById('btnExportValueSvg') ?.addEventListener('click', () => exportTableSVG ('value','value-table.svg'));
  document.getElementById('btnExportValueHtml')?.addEventListener('click', () => exportTableHTML('value','value-table.html'));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireTableExportButtons);
else wireTableExportButtons();