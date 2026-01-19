
// ==========================
// EXPORT TREE
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

function getTreeSvg() {
  let svg = document.getElementById('svgDT');

  // Fallbacks
  if (!svg || svg.tagName.toLowerCase() !== 'svg') {
    svg = document.querySelector('#svgDT svg') ||
          document.querySelector('#treeContainer svg') ||
          document.querySelector('svg');
  }

  if (!svg) {
    alert('The SVG for the tree was not found. Has the tree already been built?');
  }
  return svg;
}

function cloneSvgWithNamespaces(svg) {
  const clonedSvg = svg.cloneNode(true);
  clonedSvg.setAttribute('version', '1.1');
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  return clonedSvg;
}

function svgToString(svg) {

  function copyComputedStyles(el) {
    const computed = window.getComputedStyle(el);
    const inline = [
      'fill',
      'stroke',
      'stroke-width',
      'font-size',
      'font-family',
      'font-weight',
      'text-anchor',
      'opacity',
      'fill-opacity',
      'stroke-opacity'
    ].map(p => `${p}:${computed.getPropertyValue(p)}`).join(';');
    el.setAttribute('style', inline);
    for (const child of el.children) copyComputedStyles(child);
  };

  const svgCloned = cloneSvgWithNamespaces(svg);
  copyComputedStyles(svgCloned);

  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgCloned);

  // Añade cabecera XML
  if (!source.match(/^<\?xml/)) {
    source = `<?xml version="1.0" standalone="no"?>\n` + source;
  }
  return source;
}

// =====================
// Export SVG
// =====================

async function embedFontIntoSvg(svgClone, familyName, fontUrl) {
  try {
    const res = await fetch(fontUrl, { cache: 'force-cache' });
    const buf = await res.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.setAttribute('type', 'text/css');
    styleEl.textContent =
      `@font-face{font-family:'${familyName}';src:url(data:font/woff2;base64,${b64}) format('woff2');font-weight:normal;font-style:normal;font-display:block;}
       text,tspan{font-family:'${familyName}', Arial, Helvetica, sans-serif;}`;
    svgClone.insertBefore(styleEl, svgClone.firstChild);
  } catch (e) {
    // Si falla (CORS/ruta), al menos fija una pila de fallbacks
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `text,tspan{font-family:Arial, Helvetica, sans-serif;}`;
    svgClone.insertBefore(styleEl, svgClone.firstChild);
  }
}

function pruneHiddenElements(originalSvg, svgClone) {
  originalSvg.querySelectorAll('g[id]').forEach(g => {
    if (getComputedStyle(g).display === 'none') {
      svgClone.querySelector(`[id="${g.id}"]`)?.remove();
    }
  });
  originalSvg.querySelectorAll('use[id]').forEach(u => {
    if (getComputedStyle(u).display === 'none') {
      svgClone.querySelector(`[id="${u.id}"]`)?.remove();
    }
  });
}

function collectCssForSvg(svg) {
  let css = '';

  document.querySelectorAll('style').forEach(s => {
    if (s.textContent) css += '\n' + s.textContent;
  });

  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try {
      rules = sheet.cssRules; // CORS
    } catch {
      continue; // skip cross-origin leafs
    }
    if (!rules) continue;

    for (const rule of rules) {
      if (rule.type === CSSRule.FONT_FACE_RULE) {
        css += '\n' + rule.cssText;
        continue;
      }
      if (rule.type === CSSRule.KEYFRAMES_RULE) {
        css += '\n' + rule.cssText;
        continue;
      }
      if (rule.type === CSSRule.STYLE_RULE && rule.selectorText) {
        const selectors = rule.selectorText.split(',').map(s => s.trim()).filter(Boolean);
        let matches = false;
        for (const sel of selectors) {
          try {
            if (svg.querySelector(sel)) { matches = true; break; }
          } catch {
            // Ignore
          }
        }
        if (matches) css += '\n' + rule.cssText;
      }
    }
  }
  return css;
}

async function exportSvg(filename = 'decision-tree.svg') {
  const svg = getTreeSvg();
  if (!svg) return;

  const clone = svg.cloneNode(true);
  clone.setAttribute('version', '1.1');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  pruneHiddenElements(svg, clone);
  // Styles
  const css = collectCssForSvg(svg);
  if (css?.trim()) { const st = document.createElementNS('http://www.w3.org/2000/svg','style'); st.textContent = css; clone.insertBefore(st, clone.firstChild); }
  // Font
  await embedFontIntoSvg(clone, 'Inter', 'assets/fonts/Inter-Regular.woff2');

  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}


// =====================
// Export HTML
// =====================
function exportStandaloneHtml(filename = 'decision-tree.html') {
  const svg = getTreeSvg();
  if (!svg) return;
  const serializer = new XMLSerializer();
  let svgMarkup = serializer.serializeToString(svg);

  if (!svgMarkup.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgMarkup = serializer.serializeToString(svg);
  }
  if (!svgMarkup.includes('xmlns:xlink=')) {
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    svgMarkup = serializer.serializeToString(svg);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Decision Tree ID3</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: white;
      text-align: center;
      margin: 0;
      padding: 20px;
    }
    .svg-container {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-top: 20px;
    }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <h1>Decision Tree ID3</h1>
  <div class="svg-container">
    ${svgMarkup}
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, filename);
}

// =====================
// Export Text
// =====================

function getTreeData() {
  if (window.currentTreeData) return window.currentTreeData;
  if (window.decisionTree?.data) return window.decisionTree.data;
  if (window.hRoot?.data) return window.hRoot.data;

  alert('No se encontró la data del árbol. Expón una variable global con el árbol.');
  return null;
}

function getLabelValues() {
  try {
    const csv = JSON.parse(sessionStorage.getItem('csvData')) || {};
    return csv['csvLabelValues'] || csv['csvLV'] || []; // compat
  } catch { return []; }
}

function f2(x) { 
  if (x == null || x === '') return '';
  const n = Number(x);
  return Number.isFinite(n) ? n.toFixed(2) : String(x);
}

function treeToPrettyText(node, prefix = '', branchLabel = null, labelValues = []) {
  const lines = [];
  const pad = (s) => s ? ` [${s}]` : '';
  const lv0 = labelValues[0] ?? 'class0';
  const lv1 = labelValues[1] ?? 'class1';

  function writeNode(n, pref, label, isLast) {
    const connector = label !== null ? (isLast ? "└─ " : "├─ ") : "";
    const nextPref = pref + (isLast ? "   " : "│  ");

    if (label !== null) {
      lines.push(`${pref}${connector}branch: ${label}`);
    }

    if (!n || n.isLeaf) {
      const id = n?.id ?? '?';
      const lb = n?.label ?? 'LABEL?';
      const nv = n?.nodeValues ?? {};
      lines.push(
        `${nextPref}Leaf ${id}:${pad(n?.attribute)} ` +
        `label=${lb} | n=${nv.n} | ${lv0}=${nv.class1} | ${lv1}=${nv.class2} | entropy=${f2(nv.entropy)}`
      );
      return;
    }

    const nv = n.nodeValues ?? {};
    lines.push(`${nextPref}Node ${n.id}: ${n.attribute} | n=${nv.n} | entropy=${f2(nv.entropy)}`);

    const children = n.children ?? [];
    children.forEach((child, i) => {
      writeNode(child, nextPref, child.prevBranchVal ?? null, i === children.length - 1);
    });
  }

  writeNode(node, prefix, branchLabel, true);
  return lines.join('\n');
}

function nodeIdToUseId(treeNodeId) {
  const num = String(treeNodeId).slice(1);
  return (treeNodeId[0] === 'n' ? 'useNode' : 'useLeaf') + num;
}
function getVisibleUseIds() {
  const set = new Set();
  document.querySelectorAll('use[id^="useNode"], use[id^="useLeaf"]').forEach(u => {
    const g = u.closest('g');
    const gVisible = !g || getComputedStyle(g).display !== 'none';
    const uVisible = getComputedStyle(u).display !== 'none';
    if (gVisible && uVisible) set.add(u.id);
  });
  return set;
}

function cloneLite(node) {
  return {
    id: node.id,
    attribute: node.attribute ?? null,
    nodeValues: node.nodeValues ? {
      class1: node.nodeValues.class1,
      class2: node.nodeValues.class2,
      n:      node.nodeValues.n,
      entropy:node.nodeValues.entropy
    } : null,
    isLeaf: !!node.isLeaf,
    label: node.label ?? null,
    prevBranchVal: node.prevBranchVal ?? null,
    children: []
  };
}

function cloneVisibleSubtree(node, visibleIds) {
  if (!node || !node.id) return null;
  const useId = nodeIdToUseId(node.id);
  if (!visibleIds.has(useId)) return null;

  const out = cloneLite(node);
  for (const child of (node.children || [])) {
    const c = cloneVisibleSubtree(child, visibleIds);
    if (c) out.children.push(c);
  }
  return out;
}

function exportText(filename = 'decision-tree.txt') {
  const full = getTreeData();
  if (!full) return;

  const labelValues = getLabelValues();
  const visibleIds = getVisibleUseIds();
  const current = cloneVisibleSubtree(full, visibleIds) || full;

  const header = [
    'Decision Tree (text export)',
    `Scope: ${current === full ? 'full tree' : 'current step only'}`,
    `Classes: ${labelValues.join(' , ') || '(unknown)'}`,
    'Fields: Node/Leaf id | attribute | n | class counts | entropy | (branch labels shown above each child)',
    ''
  ].join('\n');

  const text = header + treeToPrettyText(current, '', null, labelValues);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, filename);
}


//////////////////////////////////////////////////////
function wireExportButtons() {
  document.getElementById('btnExportHtml')?.addEventListener('click', () => exportStandaloneHtml());
  document.getElementById('btnExportSvg')?.addEventListener('click', () => exportSvg());
  document.getElementById('btnExportTxt')?.addEventListener('click', () => exportText());
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireExportButtons);
} else {
  wireExportButtons();
}
//////////////////////////////////////////////////////









