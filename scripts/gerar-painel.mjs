#!/usr/bin/env node
// Gera o painel (site/index.html) com todas as apresentações de site/<slug>/.
// O painel é protegido por senha pelo middleware.js; as propostas continuam abertas.
//
// Uso:
//   node scripts/gerar-painel.mjs                       # gera o painel e as miniaturas que faltam
//   node scripts/gerar-painel.mjs --refazer-miniaturas  # tira todas as miniaturas de novo
//   node scripts/gerar-painel.mjs --sem-miniaturas      # só a lista
//
// Miniaturas: usa o Google Chrome do Mac em modo headless e o `sips` (macOS).
// Ficam em site/_painel/thumbs/<slug>.jpg. Pastas que começam com "_" não entram na lista.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(RAIZ, 'site');
const THUMBS = path.join(SITE, '_painel', 'thumbs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = new Set(process.argv.slice(2));
const comMiniaturas = !args.has('--sem-miniaturas');
const refazer = args.has('--refazer-miniaturas');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function dataDaPasta(slug) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', `site/${slug}`], { cwd: RAIZ, encoding: 'utf8' }).trim();
    if (out) return out;
  } catch {}
  return fs.statSync(path.join(SITE, slug, 'index.html')).mtime.toISOString();
}

function lerApresentacoes() {
  return fs.readdirSync(SITE, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !/^[._]/.test(d.name) && fs.existsSync(path.join(SITE, d.name, 'index.html')))
    .map((d) => {
      const slug = d.name;
      const html = fs.readFileSync(path.join(SITE, slug, 'index.html'), 'utf8');
      const titulo = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || slug).trim();
      const deck = html.includes('deck-stage');
      const slides = deck ? (html.match(/<section\b[^>]*\bdata-label=/g) || []).length : 0;
      return { slug, titulo, tipo: deck ? 'deck' : 'pagina', slides, atualizado: dataDaPasta(slug) };
    })
    .sort((a, b) => b.atualizado.localeCompare(a.atualizado));
}

// Servidor local mínimo: as páginas usam caminhos absolutos (/<slug>/...), então file:// não serve.
function servirSite() {
  const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp4': 'video/mp4' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = path.join(SITE, p);
    if (!f.startsWith(SITE)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    else if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
    if (!fs.existsSync(f)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function gerarMiniaturas(lista) {
  if (!fs.existsSync(CHROME)) { console.log('Chrome não encontrado: miniaturas puladas.'); return; }
  fs.mkdirSync(THUMBS, { recursive: true });
  const pendentes = lista.filter((a) => {
    const t = path.join(THUMBS, `${a.slug}.jpg`);
    if (refazer || !fs.existsSync(t)) return true;
    return fs.statSync(path.join(SITE, a.slug, 'index.html')).mtimeMs > fs.statSync(t).mtimeMs;
  });
  if (!pendentes.length) return;
  const server = await servirSite();
  const porta = server.address().port;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'painel-'));
  for (const a of pendentes) {
    const png = path.join(tmp, `${a.slug}.png`);
    try {
      // async: o servidor roda neste mesmo processo, então o Chrome não pode bloquear o event loop.
      await new Promise((ok, falha) => {
        execFile(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1600,900',
          '--virtual-time-budget=12000', `--screenshot=${png}`, `http://127.0.0.1:${porta}/${a.slug}`],
          { timeout: 90000 }, (err) => (fs.existsSync(png) ? ok() : falha(err || new Error('sem screenshot'))));
      });
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '-Z', '960', png, '--out', path.join(THUMBS, `${a.slug}.jpg`)], { stdio: 'ignore' });
      console.log(`miniatura: ${a.slug}`);
    } catch (e) {
      console.log(`miniatura falhou (${a.slug}): ${e.message}`);
    }
  }
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

function removerMiniaturasOrfas(lista) {
  if (!fs.existsSync(THUMBS)) return;
  const vivos = new Set(lista.map((a) => `${a.slug}.jpg`));
  for (const f of fs.readdirSync(THUMBS)) if (!vivos.has(f)) fs.rmSync(path.join(THUMBS, f));
}

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' });

function card(a, i) {
  const thumb = path.join(THUMBS, `${a.slug}.jpg`);
  const temThumb = fs.existsSync(thumb);
  const v = temThumb ? Math.round(fs.statSync(thumb).mtimeMs / 1000) : 0;
  const meta = a.tipo === 'deck' ? `Deck${a.slides ? ` · ${a.slides} slides` : ''}` : 'Página';
  const busca = `${a.titulo} ${a.slug}`.toLowerCase();
  return `
      <article class="card" data-tipo="${a.tipo}" data-busca="${esc(busca)}" style="--i:${i}">
        <a class="thumb" href="/${esc(a.slug)}" target="_blank" rel="noopener" aria-label="Abrir ${esc(a.titulo)}">
          ${temThumb
            ? `<img src="/_painel/thumbs/${esc(a.slug)}.jpg?v=${v}" alt="" loading="lazy" decoding="async">`
            : `<span class="thumb-vazio">${esc(a.titulo)}</span>`}
        </a>
        <div class="corpo">
          <span class="eyebrow">${meta}</span>
          <h2>${esc(a.titulo)}</h2>
          <p class="meta"><span class="slug">/${esc(a.slug)}</span><span class="sep">·</span>atualizada em ${fmtData.format(new Date(a.atualizado))}</p>
          <div class="acoes">
            <a class="btn btn-primario" href="/${esc(a.slug)}" target="_blank" rel="noopener">Abrir</a>
            <button class="btn btn-ghost" type="button" data-copiar="${esc(a.slug)}">Copiar link</button>
          </div>
        </div>
      </article>`;
}

function pagina(lista) {
  const decks = lista.filter((a) => a.tipo === 'deck').length;
  const paginas = lista.length - decks;
  const n = (q, um, varios) => `${q} ${q === 1 ? um : varios}`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#0A0A0A">
  <title>Isla · Biblioteca de apresentações</title>
  <!-- Gerado por scripts/gerar-painel.mjs. Não edite à mão: rode o script de novo. -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@300;400;500&display=swap">
  <style>
    :root {
      --ink: #0A0A0A; --ink-2: #141414; --ink-3: #1F1F1F; --porcelain: #F5F5F2; --grey-1: #A3A3A3; --grey-2: #6B6B6B;
      --line: rgb(245 245 242 / .10); --line-strong: rgb(245 245 242 / .18);
      --ease: cubic-bezier(0.16, 1, 0.3, 1); --gutter: 16px; --container: 1320px;
    }
    @media (min-width: 768px) { :root { --gutter: 32px; } }
    @media (min-width: 1280px) { :root { --gutter: 48px; } }
    * { box-sizing: border-box; margin: 0; }
    html { background: var(--ink); color: var(--porcelain); color-scheme: dark; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
    body { min-height: 100svh; font: 400 16px/1.6 "Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif; overflow-x: clip; background: var(--ink); }
    ::selection { background: var(--porcelain); color: var(--ink); }
    :focus-visible { outline: 1px solid var(--porcelain); outline-offset: 4px; border-radius: 4px; }
    a { color: inherit; text-decoration: none; }

    .bg { position: fixed; inset: 0; z-index: -1; pointer-events: none; }
    .bg svg { width: 100%; height: 100%; }
    .grain { position: fixed; inset: -10%; z-index: 100; pointer-events: none; opacity: .045; animation: grain 1.2s steps(6) infinite;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
    @keyframes grain { 0%{transform:translate(0,0)} 33%{transform:translate(-3%,2%)} 66%{transform:translate(2%,-3%)} 100%{transform:translate(0,0)} }

    .container { width: 100%; max-width: calc(var(--container) + var(--gutter) * 2); margin-inline: auto; padding-inline: var(--gutter); }
    header { padding-top: clamp(72px, 12vw, 152px); padding-bottom: 48px; }
    .eyebrow { display: inline-flex; align-items: center; gap: 12px; font-size: 11px; font-weight: 500; letter-spacing: .22em; text-transform: uppercase; color: var(--grey-1); }
    header .eyebrow::before { content: ""; width: 24px; height: 1px; background: var(--grey-2); }
    h1 { font-family: "Instrument Serif", "Times New Roman", serif; font-weight: 400; font-size: clamp(44px, 6.4vw, 96px); line-height: .98; letter-spacing: -0.025em; margin-top: 24px; max-width: 14ch; text-wrap: balance; }
    h1 em { font-style: italic; }
    .lede { margin-top: 24px; max-width: 56ch; color: var(--grey-1); font-size: clamp(17px, 1.35vw, 20px); line-height: 1.55; text-wrap: pretty; }

    .barra { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding-block: 24px; border-top: 1px solid var(--line); }
    .busca { flex: 1 1 280px; min-width: 0; position: relative; }
    .busca input { width: 100%; height: 44px; padding: 0 18px 0 44px; border-radius: 999px; border: 1px solid var(--line); color: var(--porcelain);
      font: inherit; font-size: 15px; background: rgb(20 20 20 / .55); backdrop-filter: blur(20px); transition: border-color .6s var(--ease); }
    .busca input::placeholder { color: var(--grey-2); }
    .busca input:focus { outline: none; border-color: var(--line-strong); }
    .busca svg { position: absolute; z-index: 1; left: 16px; top: 50%; translate: 0 -50%; color: var(--grey-2); pointer-events: none; }
    .filtros { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip { appearance: none; cursor: pointer; height: 44px; padding: 0 18px; border-radius: 999px; border: 1px solid var(--line); background: transparent;
      color: var(--grey-1); font: inherit; font-size: 14px; transition: background .6s var(--ease), color .6s var(--ease), border-color .6s var(--ease); }
    .chip span { color: var(--grey-2); margin-left: 6px; font-variant-numeric: tabular-nums; }
    .chip:hover { border-color: var(--line-strong); color: var(--porcelain); }
    .chip[aria-pressed="true"] { background: var(--porcelain); border-color: var(--porcelain); color: var(--ink); }
    .chip[aria-pressed="true"] span { color: rgb(10 10 10 / .5); }

    .grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 24px; padding-block: 8px 128px; }
    .card { display: flex; flex-direction: column; border-radius: 20px; overflow: hidden; border: 1px solid var(--line);
      background: linear-gradient(180deg, rgb(245 245 242 / .045), rgb(245 245 242 / .015)); background-color: rgb(20 20 20 / .55);
      box-shadow: inset 0 1px 0 0 rgb(245 245 242 / .09), 0 30px 60px -30px rgb(0 0 0 / .8);
      opacity: 0; translate: 0 24px; animation: entra 1.1s var(--ease) forwards; animation-delay: calc(var(--i) * 60ms + 150ms); }
    @keyframes entra { to { opacity: 1; translate: 0 0; } }
    .card[hidden] { display: none; }
    .thumb { position: relative; display: block; aspect-ratio: 16 / 9; overflow: hidden; background: var(--ink-3); border-bottom: 1px solid var(--line); }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 1.2s var(--ease), filter 1.2s var(--ease); filter: saturate(.9); }
    .thumb:hover img { transform: scale(1.03); filter: saturate(1); }
    .thumb-vazio { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; text-align: center;
      font-family: "Instrument Serif", serif; font-style: italic; font-size: 28px; color: var(--grey-1); }
    .corpo { display: flex; flex-direction: column; gap: 10px; padding: 24px; flex: 1; }
    .corpo h2 { font-family: "Instrument Serif", "Times New Roman", serif; font-weight: 400; font-size: clamp(26px, 2.2vw, 32px); line-height: 1.1; letter-spacing: -0.01em; text-wrap: balance; }
    .meta { font-size: 13px; color: var(--grey-1); display: flex; flex-wrap: wrap; column-gap: 8px; }
    .meta .slug { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; color: var(--porcelain); opacity: .8; }
    .meta .sep { color: var(--grey-2); }
    .acoes { display: flex; gap: 10px; margin-top: auto; padding-top: 14px; }
    .btn { appearance: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 40px; padding: 0 20px;
      border-radius: 999px; font: 500 14px/1 "Inter Tight", system-ui, sans-serif; transition: box-shadow .6s var(--ease), background .6s var(--ease), border-color .6s var(--ease), color .6s var(--ease); }
    .btn-primario { background: var(--porcelain); color: var(--ink); border: 1px solid var(--porcelain); }
    .btn-primario:hover { box-shadow: 0 0 32px rgb(245 245 242 / .28); }
    .btn-ghost { background: transparent; color: var(--porcelain); border: 1px solid var(--line-strong); }
    .btn-ghost:hover { border-color: rgb(245 245 242 / .4); }
    .btn-ghost.ok { color: var(--grey-1); }

    .vazio { grid-column: 1 / -1; padding: 96px 0; text-align: center; color: var(--grey-1); }
    .vazio em { font-family: "Instrument Serif", serif; font-size: 28px; color: var(--porcelain); display: block; margin-bottom: 8px; }
    footer { padding-bottom: 48px; font-size: 13px; color: var(--grey-2); }

    @media (prefers-reduced-motion: reduce) { .card { animation: none; opacity: 1; translate: none; } .grain { animation: none; } }
  </style>
</head>
<body>
  <div class="bg" aria-hidden="true">
    <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" fill="none" stroke="rgb(245 245 242 / .05)">
      <g transform="translate(980 120)"><ellipse rx="120" ry="80"/><ellipse rx="230" ry="155"/><ellipse rx="350" ry="236"/><ellipse rx="480" ry="324"/><ellipse rx="620" ry="420"/><ellipse rx="780" ry="530"/></g>
    </svg>
  </div>
  <div class="grain" aria-hidden="true"></div>

  <header class="container">
    <span class="eyebrow">Isla · Propostas</span>
    <h1>Biblioteca de <em>apresentações.</em></h1>
    <p class="lede">${n(lista.length, 'apresentação no ar', 'apresentações no ar')}. Só o time da Isla vê esta página; cada cliente recebe apenas o próprio link.</p>
  </header>

  <main class="container">
    <div class="barra">
      <label class="busca">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" id="busca" placeholder="Buscar por cliente ou link" autocomplete="off" aria-label="Buscar apresentações">
      </label>
      <div class="filtros" role="group" aria-label="Filtrar por tipo">
        <button class="chip" type="button" data-filtro="todas" aria-pressed="true">Todas<span>${lista.length}</span></button>
        <button class="chip" type="button" data-filtro="deck" aria-pressed="false">Decks<span>${decks}</span></button>
        <button class="chip" type="button" data-filtro="pagina" aria-pressed="false">Páginas<span>${paginas}</span></button>
      </div>
    </div>

    <section class="grade" id="grade">${lista.map(card).join('')}
      <p class="vazio" id="vazio" hidden><em>Nada por aqui.</em>Nenhuma apresentação combina com essa busca.</p>
    </section>
  </main>

  <footer class="container">Atualizado em ${fmtData.format(new Date())}. Para atualizar: <code>node scripts/gerar-painel.mjs</code> e push.</footer>

  <script>
    (function () {
      var cards = [].slice.call(document.querySelectorAll('.card'));
      var busca = document.getElementById('busca');
      var vazio = document.getElementById('vazio');
      var chips = [].slice.call(document.querySelectorAll('.chip'));
      var filtro = 'todas';
      function aplicar() {
        var q = busca.value.trim().toLowerCase();
        var visiveis = 0;
        cards.forEach(function (c) {
          var ok = (filtro === 'todas' || c.dataset.tipo === filtro) && (!q || c.dataset.busca.indexOf(q) !== -1);
          c.hidden = !ok;
          if (ok) visiveis++;
        });
        vazio.hidden = visiveis > 0;
      }
      busca.addEventListener('input', aplicar);
      chips.forEach(function (ch) {
        ch.addEventListener('click', function () {
          filtro = ch.dataset.filtro;
          chips.forEach(function (o) { o.setAttribute('aria-pressed', String(o === ch)); });
          aplicar();
        });
      });
      document.addEventListener('click', function (e) {
        var b = e.target.closest('[data-copiar]');
        if (!b) return;
        var url = location.origin + '/' + b.dataset.copiar;
        var feito = function () {
          b.textContent = 'Link copiado'; b.classList.add('ok');
          setTimeout(function () { b.textContent = 'Copiar link'; b.classList.remove('ok'); }, 1800);
        };
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(feito, function () { prompt('Copie o link:', url); });
        else prompt('Copie o link:', url);
      });
    })();
  </script>
</body>
</html>
`;
}

const lista = lerApresentacoes();
if (comMiniaturas) await gerarMiniaturas(lista);
removerMiniaturasOrfas(lista);
fs.writeFileSync(path.join(SITE, 'index.html'), pagina(lista));
console.log(`Painel gerado: site/index.html (${lista.length} apresentações)`);
