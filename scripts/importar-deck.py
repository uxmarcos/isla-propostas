#!/usr/bin/env python3
"""Importa um deck do Claude Design (pasta exportada com .dc.html) para site/<slug>/.

Uso:
  python3 scripts/importar-deck.py <pasta-do-projeto> "<arquivo>.dc.html" <slug> "<título da aba>"

Ex:
  python3 scripts/importar-deck.py ~/Documents/ISLA/Clientes/ZazOS/"ZAZOS - Pitch" "Zazos Pitch.dc.html" zazos "Isla × Zazos · Proposta"

O que faz:
  - copia support.js, deck-stage.js, image-slot.js, a pasta figma/ (se usada) e só as imagens de assets/ referenciadas;
  - troca caminhos relativos por absolutos (/<slug>/...), porque a Vercel serve /<slug> sem barra final;
  - garante noindex, <title>, botão "Baixar PDF" (o deck imprime um slide por página) e o Vercel Analytics;
  - esconde a barra de miniaturas do editor do Claude Design.
Image-slots vazios no Claude Design continuam vazios: preencha com src="/<slug>/assets/..." depois.
"""
import re, sys, shutil, pathlib, subprocess

if len(sys.argv) != 5:
    sys.exit(__doc__)
src, dc, slug, title = pathlib.Path(sys.argv[1]).expanduser(), sys.argv[2], sys.argv[3], sys.argv[4]
if not re.fullmatch(r'[a-z0-9-]+', slug):
    sys.exit('O slug deve ter só letras minúsculas, números e hífen.')
dst = pathlib.Path(__file__).resolve().parent.parent / 'site' / slug
if dst.exists():
    sys.exit(f'Já existe site/{slug}. Para atualizar, apague a pasta antes (o link continua o mesmo).')

html = (src / dc).read_text()
dst.mkdir(parents=True)
for js in ['support.js', 'deck-stage.js', 'image-slot.js']:
    shutil.copy(src / js, dst / js)
for a in sorted(set(re.findall(r'assets/[A-Za-z0-9_./-]+\.(?:png|svg|jpe?g|webp|gif|mp4)', html))):
    (dst / a).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(src / a, dst / a)
if 'figma/' in html:
    shutil.copytree(src / 'figma', dst / 'figma', ignore=shutil.ignore_patterns('*.d.ts'))

html = re.sub(r'(src|href|from)="\./', rf'\1="/{slug}/', html)
html = re.sub(r'(src|href)="(assets|figma)/', rf'\1="/{slug}/\2/', html)
html = html.replace('url(assets/', f'url(/{slug}/assets/')

head_extra = f'''<title>{title}</title>
<meta name="robots" content="noindex, nofollow">
<script>
// Esconde a barra de miniaturas do editor do Claude Design para quem vê a proposta.
new MutationObserver(function () {{
  document.querySelectorAll('deck-stage:not([no-rail])').forEach(function (d) {{ d.setAttribute('no-rail', ''); }});
}}).observe(document.documentElement, {{ childList: true, subtree: true }});
</script>
<style>
.isla-pdf{{position:fixed;bottom:16px;right:16px;z-index:2147483001;appearance:none;cursor:pointer;
  font:500 13px/1 Manrope,system-ui,sans-serif;letter-spacing:.01em;color:#fff;
  padding:10px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.14);
  background:rgba(20,20,20,.55);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  opacity:.75;transition:opacity .3s ease,background .3s ease}}
.isla-pdf:hover,.isla-pdf:focus-visible{{opacity:1;background:rgba(40,40,40,.7)}}
@media print{{.isla-pdf{{display:none!important}}}}
</style>
'''
html = re.sub(r'<meta name="robots"[^>]*>\n?', '', html)
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + head_extra, 1)
if '/_vercel/insights/script.js' not in html:
    html = html.replace('</body>', '<script defer src="/_vercel/insights/script.js"></script>\n</body>')
html = html.replace('<script defer src="/_vercel/insights/script.js">',
                    '<button class="isla-pdf" type="button" onclick="window.print()">Baixar PDF</button>\n'
                    '<script defer src="/_vercel/insights/script.js">', 1)
(dst / 'index.html').write_text(html)
print(f'Pronto: site/{slug}/index.html')
subprocess.run(['node', str(dst.parent.parent / 'scripts' / 'gerar-painel.mjs')], check=False)
