#!/usr/bin/env python3
"""Importa decks do Claude Design (pasta do projeto exportada, com .dc.html) para site/<slug>/.

Uso:
  # todos os decks listados no isla-export.json da pasta (gerado pelo prompt de exportação)
  python3 scripts/importar-deck.py <pasta-do-projeto> [--atualizar]

  # um deck específico
  python3 scripts/importar-deck.py <pasta-do-projeto> "<arquivo>.dc.html" <slug> "<título da aba>" [--atualizar]

  # só reaplicar setas / Baixar PDF / barra escondida numa página já importada (não mexe no conteúdo)
  python3 scripts/importar-deck.py --controles site/<slug>

--atualizar substitui site/<slug> se já existir (o link continua o mesmo; ajustes feitos à mão na pasta se perdem).

O que a importação faz:
  - copia support.js, deck-stage.js, image-slot.js, a pasta figma/ (se usada) e só as imagens de assets/ referenciadas;
  - imagens arrastadas para <image-slot> no Claude Design (.image-slots.state.json) viram arquivos em assets/slots/;
  - troca caminhos relativos por absolutos (/<slug>/...), porque a Vercel serve /<slug> sem barra final;
  - garante noindex, <title>, Vercel Analytics, setas de navegação, botão "Baixar PDF"
    e esconde a barra de miniaturas do editor;
  - no fim, atualiza o painel (scripts/gerar-painel.mjs).
"""
import base64, json, pathlib, re, shutil, subprocess, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SITE = RAIZ / 'site'

CONTROLES_HEAD = '''<!-- isla:controles -->
<script>
// Para quem vê a proposta: esconde a barra de miniaturas do editor do Claude Design
// e a barrinha de controles nativa do deck (as setas da Isla substituem).
new MutationObserver(function () {
  document.querySelectorAll('deck-stage:not([no-rail])').forEach(function (d) {
    d.setAttribute('no-rail', '');
    if (d.shadowRoot) {
      var s = document.createElement('style');
      s.textContent = '.overlay{display:none!important}';
      d.shadowRoot.appendChild(s);
    }
  });
}).observe(document.documentElement, { childList: true, subtree: true });
</script>
<style>
.isla-pdf,.isla-seta{position:fixed;z-index:2147483001;appearance:none;cursor:pointer;color:#fff;
  border:1px solid rgba(255,255,255,.14);background:rgba(20,20,20,.55);
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  opacity:.75;transition:opacity .3s ease,background .3s ease}
.isla-pdf{bottom:16px;right:16px;padding:10px 16px;border-radius:999px;
  font:500 13px/1 Manrope,system-ui,sans-serif;letter-spacing:.01em}
.isla-seta{top:50%;translate:0 -50%;width:52px;height:52px;border-radius:50%;padding:0;display:grid;place-items:center}
.isla-seta svg{width:20px;height:20px}
.isla-ant{left:16px}.isla-prox{right:16px}
.isla-pdf:hover,.isla-pdf:focus-visible,.isla-seta:hover,.isla-seta:focus-visible{opacity:1;background:rgba(40,40,40,.75)}
.isla-seta:disabled{opacity:.18;cursor:default;background:rgba(20,20,20,.55)}
@media (max-width:640px){
  .isla-seta{top:auto;bottom:16px;translate:none;width:44px;height:44px}
  .isla-ant{left:16px}.isla-prox{left:68px;right:auto}
}
/* Celular deitado: o slide ocupa a altura toda; setas menores nas laterais, sem botão de PDF. */
@media (max-height:500px) and (orientation:landscape){
  .isla-seta{width:40px;height:40px;opacity:.6}
  .isla-ant{left:max(8px,env(safe-area-inset-left))}.isla-prox{right:max(8px,env(safe-area-inset-right))}
  .isla-pdf{display:none}
}
/* Celular em pé: sugere girar. Some sozinho depois de alguns segundos. */
.isla-girar{display:none}
@media (max-width:640px) and (orientation:portrait){
  .isla-girar{display:flex;position:fixed;top:max(16px,env(safe-area-inset-top));left:50%;translate:-50% 0;z-index:2147483001;
    align-items:center;gap:10px;padding:10px 16px;border-radius:999px;white-space:nowrap;pointer-events:none;
    font:500 13px/1 Manrope,system-ui,sans-serif;color:#fff;border:1px solid rgba(255,255,255,.14);
    background:rgba(20,20,20,.7);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
    animation:islaGirar 7s ease forwards}
  .isla-girar svg{width:18px;height:18px;animation:islaGiro 2.4s ease-in-out infinite}
}
@keyframes islaGirar{0%{opacity:0}8%,80%{opacity:1}100%{opacity:0}}
@keyframes islaGiro{0%,30%{rotate:0deg}55%,100%{rotate:-90deg}}
@media print{.isla-pdf,.isla-seta,.isla-girar{display:none!important}}
</style>
<!-- /isla:controles -->
'''

CONTROLES_BODY = '''<!-- isla:controles -->
<button class="isla-seta isla-ant" type="button" aria-label="Slide anterior" onclick="islaIr(-1,this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
<button class="isla-seta isla-prox" type="button" aria-label="Próximo slide" onclick="islaIr(1,this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
<button class="isla-pdf" type="button" onclick="window.print()">Baixar PDF</button>
<div class="isla-girar" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/></svg>Gire o celular para ver em tela cheia</div>
<script>
function islaIr(d, b) {
  var s = document.querySelector('deck-stage');
  if (s && s.next) d < 0 ? s.prev() : s.next();
  if (b) b.blur(); // sem isso, Espaço com o botão em foco avançaria dois slides
}
document.addEventListener('slidechange', function (e) {
  document.querySelector('.isla-ant').disabled = e.detail.index <= 0;
  document.querySelector('.isla-prox').disabled = e.detail.index >= e.detail.total - 1;
});
</script>
<!-- /isla:controles -->
'''


def aplicar_controles(html):
    """Insere (ou reinsere) os controles da Isla. Idempotente."""
    html = re.sub(r'<!-- isla:controles -->.*?<!-- /isla:controles -->\n?', '', html, flags=re.S)
    # versão antiga (sem marcadores), das primeiras importações
    html = re.sub(r'<script>\n// Esconde a barra de miniaturas.*?</script>\n<style>\n\.isla-pdf\{.*?</style>\n', '', html, flags=re.S)
    html = html.replace('<button class="isla-pdf" type="button" onclick="window.print()">Baixar PDF</button>\n', '')
    html = re.sub(r'(<meta name="robots"[^>]*>\n)', lambda m: m.group(1) + CONTROLES_HEAD, html, count=1)
    if '/_vercel/insights/script.js' not in html:
        html = html.replace('</body>', '<script defer src="/_vercel/insights/script.js"></script>\n</body>')
    return html.replace('<script defer src="/_vercel/insights/script.js">',
                        CONTROLES_BODY + '<script defer src="/_vercel/insights/script.js">', 1)


def imagens_dos_slots(src, html, dst, slug):
    """Imagens arrastadas para <image-slot> no Claude Design ficam num sidecar em data URL: vira arquivo + src."""
    sidecar = src / '.image-slots.state.json'
    if not sidecar.exists():
        return html
    try:
        slots = json.loads(sidecar.read_text())
    except ValueError:
        return html
    ext = {'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/avif': 'avif'}
    for sid, v in slots.items():
        u = v if isinstance(v, str) else (v or {}).get('u')
        m = re.match(r'data:(image/[a-z]+);base64,(.*)', u or '', re.S)
        if not m or not re.search(rf'<image-slot\b[^>]*\bid="{re.escape(sid)}"', html):
            continue
        nome = f'assets/slots/{sid}.{ext.get(m.group(1), "img")}'
        (dst / nome).parent.mkdir(parents=True, exist_ok=True)
        (dst / nome).write_bytes(base64.b64decode(m.group(2)))

        def com_src(t):
            tag = re.sub(r'\ssrc="[^"]*"', '', t.group(0))
            return tag.replace('<image-slot', f'<image-slot src="/{slug}/{nome}"', 1)
        html = re.sub(rf'<image-slot\b[^>]*\bid="{re.escape(sid)}"[^>]*>', com_src, html)
        print(f'  imagem do slot "{sid}" -> {nome}')
    return html


def importar(src, dc, slug, titulo, atualizar=False):
    if not re.fullmatch(r'[a-z0-9-]+', slug):
        sys.exit(f'Slug inválido "{slug}": use só letras minúsculas, números e hífen.')
    dst = SITE / slug
    if dst.exists():
        if not atualizar:
            print(f'Pulado: site/{slug} já existe (use --atualizar para substituir).')
            return False
        shutil.rmtree(dst)

    html = (src / dc).read_text()
    dst.mkdir(parents=True)
    for js in ['support.js', 'deck-stage.js', 'image-slot.js']:
        shutil.copy(src / js, dst / js)
    for a in sorted(set(re.findall(r'assets/[A-Za-z0-9_./ -]+?\.(?:png|svg|jpe?g|webp|gif|avif|mp4)', html))):
        if (src / a).exists():
            (dst / a).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(src / a, dst / a)
        else:
            print(f'  aviso: {a} é usado no deck mas não está na pasta')
    if 'figma/' in html and (src / 'figma').exists():
        shutil.copytree(src / 'figma', dst / 'figma', ignore=shutil.ignore_patterns('*.d.ts'))

    html = imagens_dos_slots(src, html, dst, slug)
    html = re.sub(r'(src|href|from)="\./', rf'\1="/{slug}/', html)
    html = re.sub(r'(src|href)="(assets|figma)/', rf'\1="/{slug}/\2/', html)
    html = re.sub(r'url\((["\']?)assets/', rf'url(\1/{slug}/assets/', html)

    html = re.sub(r'<title>.*?</title>\n?', '', html, flags=re.S)
    html = re.sub(r'<meta name="robots"[^>]*>\n?', '', html)
    t = titulo.replace('&', '&amp;').replace('<', '&lt;')
    html = html.replace('<meta charset="utf-8">', f'<meta charset="utf-8">\n<title>{t}</title>\n<meta name="robots" content="noindex, nofollow">\n', 1)
    (dst / 'index.html').write_text(aplicar_controles(html))
    vazios = re.findall(r'<image-slot\b(?![^>]*\bsrc=)[^>]*\bid="([^"]+)"', html)
    if vazios:
        print(f'  aviso: image-slots sem imagem (vão aparecer como placeholder): {", ".join(vazios)}')
    print(f'Pronto: site/{slug}/index.html')
    return True


def main(argv):
    atualizar = '--atualizar' in argv
    argv = [a for a in argv if a != '--atualizar']
    if len(argv) == 2 and argv[0] == '--controles':
        p = pathlib.Path(argv[1]) / 'index.html'
        p.write_text(aplicar_controles(p.read_text()))
        print(f'Controles aplicados: {p}')
        return
    if len(argv) == 1:
        src = pathlib.Path(argv[0]).expanduser()
        manifesto = src / 'isla-export.json'
        if not manifesto.exists():
            sys.exit(f'Não achei {manifesto}. Rode o prompt de exportação no Claude Design ou passe o arquivo, o slug e o título.')
        itens = json.loads(manifesto.read_text())
        itens = itens.get('apresentacoes', itens) if isinstance(itens, dict) else itens
        feitos = 0
        for it in itens:
            if it.get('tipo', 'proposta') != 'proposta':
                print(f'Pulado (modelo): {it.get("arquivo")}')
                continue
            titulo = it.get('titulo') or f'Isla × {it.get("cliente", it["slug"])} · Proposta'
            feitos += importar(src, it['arquivo'], it['slug'], titulo, atualizar)
    elif len(argv) == 4:
        feitos = importar(pathlib.Path(argv[0]).expanduser(), argv[1], argv[2], argv[3], atualizar)
    else:
        sys.exit(__doc__)
    if feitos:
        sys.stdout.flush()
        subprocess.run(['node', str(RAIZ / 'scripts' / 'gerar-painel.mjs')], check=False)


if __name__ == '__main__':
    main(sys.argv[1:])
