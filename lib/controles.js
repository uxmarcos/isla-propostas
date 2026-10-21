// Controles da Isla nas apresentações servidas do Supabase (setas, "Baixar PDF", aviso de girar o celular,
// barra do deck escondida), noindex e Vercel Analytics. São aplicados na hora de servir, pelo middleware.js.
// Mesmo conteúdo de CONTROLES_HEAD/CONTROLES_BODY em scripts/importar-deck.py: mudou lá, mude aqui.
export const CONTROLES_HEAD = `<!-- isla:controles -->
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
`;

export const CONTROLES_BODY = `<!-- isla:controles -->
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
`;

// Só esconde a barra do editor: usado nas miniaturas do painel (sem setas, sem Analytics).
const SO_ESCONDER_BARRA = CONTROLES_HEAD.slice(0, CONTROLES_HEAD.indexOf('</script>') + 9);

const ANALYTICS = '<script defer src="/_vercel/insights/script.js"></script>';

export function aplicarControles(html, { miniatura = false } = {}) {
  const deck = html.includes('deck-stage');
  if (!/<meta name="robots"/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => `${m}\n<meta name="robots" content="noindex, nofollow">`);
  }
  const cabeca = miniatura ? SO_ESCONDER_BARRA + '\n' : deck ? CONTROLES_HEAD : '';
  const corpo = miniatura ? '' : (deck ? CONTROLES_BODY : '') + (html.includes('/_vercel/insights/script.js') ? '' : ANALYTICS + '\n');
  if (cabeca) html = html.replace(/<meta name="robots"[^>]*>\n?/i, (m) => (m.endsWith('\n') ? m : m + '\n') + cabeca);
  if (corpo) html = html.includes('</body>') ? html.replace('</body>', corpo + '</body>') : html + corpo;
  return html;
}
