// Abre o zip de uma apresentação no navegador e monta os arquivos para enviar ao Supabase.
// Formatos aceitos:
//   - projeto do Claude Design: <Nome>.dc.html + support.js, deck-stage.js, image-slot.js, assets/, figma/
//     (com vários decks no mesmo projeto, a pessoa escolhe qual; isla-export.json, se existir, sugere slug e título)
//   - deck exportado como arquivo único do Claude Design ("Bundled Page"): é desempacotado em arquivos,
//     porque o formato único trava no celular
//   - página comum: index.html com as imagens ao lado
// O que o importar-deck.py faz na linha de comando, este arquivo faz aqui; os controles da Isla
// (setas, Baixar PDF, noindex, Analytics) entram na hora de servir, pelo middleware.js.

const JSZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const IGNORAR = /(^|\/)(__MACOSX|\.git|node_modules)(\/|$)|(^|\/)\.(?!image-slots\.state\.json$)[^/]*$|\.d\.ts$/;
const TIPOS = {
  html: 'text/html', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf', pdf: 'application/pdf',
};
const EXT = { 'image/png': 'png', 'image/svg+xml': 'svg', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
  'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'ttf', 'text/css': 'css', 'text/javascript': 'js', 'application/javascript': 'js' };

export const tipoDe = (p) => TIPOS[(p.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
const dir = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');
const nome = (p) => p.slice(p.lastIndexOf('/') + 1);

export const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const paraSlug = (t) => semAcento(String(t)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

let carregando;
function carregarJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  carregando ||= new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = JSZIP;
    s.onload = () => ok(window.JSZip);
    s.onerror = () => falha(new Error('Não consegui carregar o leitor de zip. Confira a internet.'));
    document.head.appendChild(s);
  });
  return carregando;
}

// "Isla × Zyla · Follow-up" → { cliente: 'Zyla', assunto: 'Follow-up' }
export function lerTitulo(t) {
  const m = String(t || '').match(/^Isla\s*×\s*(.+?)\s*·\s*(.+)$/);
  return m ? { cliente: m[1].trim(), assunto: m[2].trim() } : null;
}

async function gunzip(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

function base64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Lê o zip e lista as apresentações que dá para publicar.
export async function abrirZip(arquivo) {
  const JSZip = await carregarJSZip();
  let zip;
  try {
    zip = await JSZip.loadAsync(arquivo);
  } catch {
    throw new Error('Esse arquivo não parece um .zip válido.');
  }
  let caminhos = Object.values(zip.files).filter((f) => !f.dir).map((f) => f.name).filter((p) => !IGNORAR.test(p));
  // Zip de uma pasta: tira a pasta de fora ("Zyla/assets/x.png" → "assets/x.png").
  const raiz = caminhos.length && caminhos.every((p) => p.includes('/') && p.split('/')[0] === caminhos[0].split('/')[0]) ? caminhos[0].split('/')[0] + '/' : '';
  const entradas = new Map(caminhos.map((p) => [p.slice(raiz.length), zip.files[p]]));
  caminhos = [...entradas.keys()];

  const ler = (p) => entradas.get(p).async('string');
  const htmls = caminhos.filter((p) => /\.html?$/i.test(p));
  const candidatos = [];

  // Sugestões do isla-export.json (gerado pelo prompt de exportação do Claude Design).
  const sugestoes = {};
  for (const p of caminhos.filter((x) => nome(x) === 'isla-export.json')) {
    try {
      let itens = JSON.parse(await ler(p));
      itens = Array.isArray(itens) ? itens : itens.apresentacoes || [];
      for (const it of itens) if (it.arquivo) sugestoes[dir(p) + it.arquivo] = it;
    } catch {}
  }

  for (const p of htmls) {
    const texto = await ler(p);
    let tipo;
    if (texto.includes('__bundler/template')) tipo = 'bundle';
    else if (/\.dc\.html$/i.test(p) || texto.includes('<deck-stage')) tipo = 'deck';
    else if (nome(p).toLowerCase() === 'index.html') tipo = 'pagina';
    else continue;
    const sug = sugestoes[p];
    if (sug && sug.tipo && sug.tipo !== 'proposta') continue; // modelo, não proposta
    const titulo = sug?.titulo || (texto.match(/<title>([^<]*)<\/title>/i)?.[1] || '').trim();
    const doTitulo = lerTitulo(titulo.replace(/&amp;/g, '&'));
    candidatos.push({
      caminho: p,
      tipo,
      rotulo: p.replace(/\.dc\.html$|\.html?$/i, ''),
      // Cópias em uploads/ ou site/ do projeto ficam no fim da lista.
      secundario: /^(uploads|site)\//.test(p),
      sugestao: {
        cliente: sug?.cliente || doTitulo?.cliente || '',
        assunto: doTitulo?.assunto || '',
        slug: sug?.slug || '',
      },
    });
  }
  candidatos.sort((a, b) => a.secundario - b.secundario || a.caminho.localeCompare(b.caminho));
  if (!candidatos.length) throw new Error('Não achei nenhuma apresentação no zip (.dc.html, index.html ou HTML exportado do Claude Design).');

  const miniatura = entradas.has('.thumbnail') && candidatos.filter((c) => !c.secundario).length === 1 ? entradas.get('.thumbnail') : null;
  return { candidatos, montar: (c) => montar(c, entradas, caminhos, miniatura) };
}

// Monta { arquivos: Map(caminho → Blob), html, slides, tipo } para uma apresentação do zip.
async function montar(cand, entradas, caminhos, miniatura) {
  const arquivos = new Map();
  let html;
  let base = dir(cand.caminho);
  let disponiveis;

  if (cand.tipo === 'bundle') {
    ({ html, disponiveis } = await desempacotar(await entradas.get(cand.caminho).async('string'), arquivos));
  } else {
    html = await entradas.get(cand.caminho).async('string');
    const daPasta = caminhos.filter((p) => p.startsWith(base) && p !== cand.caminho).map((p) => p.slice(base.length));
    const outrosHtml = new Set(daPasta.filter((p) => /\.html?$/i.test(p)));
    const citado = (p) => html.includes(p) || html.includes(encodeURI(p));
    const usaFigma = html.includes('figma/');
    const escolhidos = daPasta.filter((p) => {
      if (outrosHtml.has(p) || p === 'isla-export.json' || p === '.image-slots.state.json' || /\.zip$/i.test(p)) return false;
      if (cand.tipo === 'pagina') return true;
      return citado(p) || (usaFigma && p.startsWith('figma/'));
    });
    for (const p of escolhidos) arquivos.set(p, await entradas.get(base + p).async('blob'));
    if (cand.tipo !== 'pagina') html = await imagensDosSlots(html, entradas.get(base + '.image-slots.state.json'), arquivos);
    disponiveis = new Set(arquivos.keys());
  }

  if (miniatura) arquivos.set('_miniatura.webp', await miniatura.async('blob'));
  const slides = (html.match(/<section\b[^>]*\bdata-label=/g) || []).length;
  return {
    tipo: cand.tipo === 'pagina' ? 'pagina' : 'deck',
    slides,
    arquivos,
    temMiniatura: Boolean(miniatura),
    // Chamado depois que o servidor devolve a pasta da versão no Supabase.
    finalizar: (urlBase, titulo) => {
      let h = reescrever(html, urlBase, disponiveis);
      const t = titulo.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      h = h.replace(/<title>[\s\S]*?<\/title>\n?/i, '');
      h = /<meta charset[^>]*>/i.test(h)
        ? h.replace(/<meta charset[^>]*>/i, (m) => `${m}\n<title>${t}</title>`)
        : h.replace(/<head[^>]*>/i, (m) => `${m}\n<meta charset="utf-8">\n<title>${t}</title>`);
      return h;
    },
  };
}

// Imagens arrastadas para <image-slot> no Claude Design ficam num JSON em data URL: viram arquivo + src.
async function imagensDosSlots(html, entrada, arquivos) {
  if (!entrada) return html;
  let slots;
  try { slots = JSON.parse(await entrada.async('string')); } catch { return html; }
  for (const [id, v] of Object.entries(slots || {})) {
    const u = typeof v === 'string' ? v : v && v.u;
    const m = /^data:(image\/[a-z+]+);base64,(.*)$/s.exec(u || '');
    const tag = new RegExp(`<image-slot\\b[^>]*\\bid="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`);
    if (!m || !tag.test(html)) continue;
    const p = `assets/slots/${id}.${EXT[m[1]] || 'img'}`;
    arquivos.set(p, new Blob([base64(m[2])], { type: m[1] }));
    html = html.replace(tag, (t) => t.replace(/\ssrc="[^"]*"/, '').replace('<image-slot', `<image-slot src="${p}"`));
  }
  return html;
}

// Deck "Bundled Page": recursos em base64 (alguns em gzip) num manifesto + o HTML num template.
async function desempacotar(texto, arquivos) {
  const pegar = (t) => texto.match(new RegExp(`<script type="__bundler/${t}">([\\s\\S]*?)</script>`))?.[1];
  const manifesto = JSON.parse(pegar('manifest') || '{}');
  let html = JSON.parse(pegar('template') || '""');
  if (!html) throw new Error('HTML exportado sem o conteúdo do deck.');
  const nomes = {};
  for (const [uuid, item] of Object.entries(manifesto)) {
    if (!html.includes(uuid)) continue; // React vem do unpkg: o support.js busca sozinho
    let bytes = base64(item.data);
    if (item.compressed === true || item.compressed === 'True') bytes = await gunzip(bytes);
    let p;
    if (/javascript/.test(item.mime)) {
      const js = new TextDecoder().decode(bytes);
      p = js.includes("customElements.define('deck-stage'") ? 'deck-stage.js'
        : js.includes("customElements.define('image-slot'") ? 'image-slot.js'
        : js.includes('dc-runtime') ? 'support.js' : `assets/${uuid.slice(0, 8)}.js`;
    } else {
      p = `assets/${uuid.slice(0, 8)}.${EXT[item.mime] || 'bin'}`;
    }
    arquivos.set(p, new Blob([bytes], { type: item.mime }));
    nomes[uuid] = p;
  }
  html = html.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (u) => nomes[u] || u);
  return { html, disponiveis: new Set(arquivos.keys()) };
}

// Troca caminhos relativos (assets/x.png, ./support.js) e absolutos de importações antigas (/slug/assets/x.png)
// pela pasta da versão no Supabase. Só mexe em caminhos de arquivos que vão junto.
export function reescrever(html, urlBase, disponiveis) {
  const trocar = (valor) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(valor)) return null;
    const i = valor.search(/[?#]/);
    let p = i < 0 ? valor : valor.slice(0, i);
    const resto = i < 0 ? '' : valor.slice(i);
    try { p = decodeURI(p); } catch {}
    p = p.replace(/^(\.\/)+/, '');
    if (p.startsWith('/')) {
      p = p.slice(1);
      if (!disponiveis.has(p)) p = p.slice(p.indexOf('/') + 1); // /<slug-antigo>/assets/x.png
    }
    return disponiveis.has(p) ? urlBase + encodeURI(p) + resto : null;
  };
  html = html.replace(/(\s(?:src|href|from|poster|data-src)=)(["'])([^"']+)\2/gi, (m, attr, q, v) => {
    const novo = trocar(v);
    return novo ? `${attr}${q}${novo}${q}` : m;
  });
  return html.replace(/url\((&quot;|["']?)([^"')&]+)\1\)/g, (m, q, v) => {
    const novo = trocar(v);
    return novo ? `url(${q}${novo}${q})` : m;
  });
}
