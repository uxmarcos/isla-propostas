// Painel: busca e filtros, "Copiar link", e as apresentações enviadas pelo painel (Supabase):
// adicionar apresentação (zip), enviar nova versão, ver, publicar e excluir versões.
// Os cards das pastas de site/ vêm prontos no HTML (gerado por scripts/gerar-painel.mjs);
// as versões vêm de /api/painel.
import { abrirZip, lerTitulo, paraSlug, tipoDe, semAcento } from './zip.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtData = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

const grade = $('#grade');
const estaticos = new Map([...document.querySelectorAll('.card[data-slug]')].map((c) => [c.dataset.slug, c]));
let indice = {};
let publico = '';
let disponivel = false;
let carregado = false;

async function api(metodo, corpo) {
  const r = await fetch('/api/painel', {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
    credentials: 'same-origin',
  });
  const dados = await r.json().catch(() => ({}));
  if (r.status === 401) location.href = '/login';
  if (!r.ok) throw new Error(dados.erro || `Erro ${r.status}`);
  return dados;
}

// ---------- busca e filtros ----------
const busca = $('#busca');
const vazio = $('#vazio');
const chips = [...document.querySelectorAll('.chip')];
let filtro = 'todas';
function aplicarFiltro() {
  const q = semAcento(busca.value.trim()).toLowerCase();
  let visiveis = 0;
  for (const c of grade.querySelectorAll('.card')) {
    const ok = (filtro === 'todas' || c.dataset.tipo === filtro) && (!q || c.dataset.busca.includes(q));
    c.hidden = !ok;
    if (ok) visiveis++;
  }
  vazio.hidden = visiveis > 0;
}
function contar() {
  const cards = [...grade.querySelectorAll('.card')];
  const n = { todas: cards.length, deck: cards.filter((c) => c.dataset.tipo === 'deck').length };
  n.pagina = n.todas - n.deck;
  for (const ch of chips) ch.querySelector('span').textContent = n[ch.dataset.filtro];
  $('#total').textContent = `${n.todas} ${n.todas === 1 ? 'apresentação no ar' : 'apresentações no ar'}`;
}
busca.addEventListener('input', aplicarFiltro);
for (const ch of chips) {
  ch.addEventListener('click', () => {
    filtro = ch.dataset.filtro;
    chips.forEach((o) => o.setAttribute('aria-pressed', String(o === ch)));
    aplicarFiltro();
  });
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-copiar]');
  if (!b) return;
  const url = location.origin + '/' + b.dataset.copiar;
  const feito = () => {
    const antes = b.textContent;
    b.textContent = 'Link copiado'; b.classList.add('ok');
    setTimeout(() => { b.textContent = antes; b.classList.remove('ok'); }, 1800);
  };
  if (navigator.clipboard) navigator.clipboard.writeText(url).then(feito, () => prompt('Copie o link:', url));
  else prompt('Copie o link:', url);
});

// ---------- cards ----------
const versaoAtual = (ap) => ap.versoes.find((v) => v.id === ap.atual);
const totalVersoes = (slug) => (indice[slug]?.versoes.length || 0) + (estaticos.has(slug) ? 1 : 0);

// Miniatura: a do projeto do Claude Design, se veio no zip; senão a própria apresentação em escala.
function miniatura(slug, v) {
  if (v.arquivos?.includes('_miniatura.webp')) {
    return `<img src="${esc(publico + slug + '/' + v.id + '/_miniatura.webp')}" alt="" loading="lazy" decoding="async">`;
  }
  return `<iframe class="ao-vivo" data-src="/${esc(slug)}?v=${esc(v.id)}&amp;miniatura" tabindex="-1" aria-hidden="true" scrolling="no"></iframe>`;
}

function atualizarCard(slug) {
  const ap = indice[slug];
  let card = grade.querySelector(`.card[data-slug="${CSS.escape(slug)}"]`);
  if (!card) {
    card = document.createElement('article');
    card.className = 'card';
    card.dataset.slug = slug;
    card.style.setProperty('--i', 0);
    card.innerHTML = `
      <a class="thumb" href="/${esc(slug)}" target="_blank" rel="noopener"></a>
      <div class="corpo">
        <span class="eyebrow"></span><h2></h2>
        <p class="meta"><span class="slug">/${esc(slug)}</span><span class="sep">·</span><span class="data"></span></p>
        <div class="acoes">
          <a class="btn btn-primario" href="/${esc(slug)}" target="_blank" rel="noopener">Abrir</a>
          <button class="btn btn-ghost" type="button" data-copiar="${esc(slug)}">Copiar link</button>
        </div>
      </div>`;
    grade.prepend(card);
  }
  const acoes = $('.acoes', card);
  let bv = $('[data-versoes]', acoes);
  if (!bv) {
    bv = document.createElement('button');
    bv.className = 'btn btn-ghost';
    bv.type = 'button';
    bv.dataset.versoes = slug;
    acoes.appendChild(bv);
  }
  const n = totalVersoes(slug);
  bv.textContent = n > 1 ? `Versões · ${n}` : 'Versões';

  const v = ap && versaoAtual(ap);
  const original = estaticos.get(slug);
  if (!v && original) {
    // Voltou para a original: restaura o card como veio do HTML.
    if (card.dataset.original) {
      $('.thumb', card).innerHTML = card.dataset.original;
      Object.assign(card.dataset, JSON.parse(card.dataset.originalDados));
      $('.eyebrow', card).textContent = card.dataset.eyebrowOriginal;
      $('h2', card).textContent = card.dataset.clienteOriginal;
      $('.data', card) && ($('.data', card).textContent = card.dataset.dataOriginal);
    }
    return;
  }
  if (!v) return;
  if (original && !card.dataset.original) {
    card.dataset.original = $('.thumb', card).innerHTML;
    card.dataset.originalDados = JSON.stringify({ tipo: card.dataset.tipo, busca: card.dataset.busca });
    card.dataset.eyebrowOriginal = $('.eyebrow', card).textContent;
    card.dataset.clienteOriginal = $('h2', card).textContent;
    const meta = $('.meta', card);
    if (!$('.data', meta)) {
      const t = meta.lastChild;
      const span = document.createElement('span');
      span.className = 'data';
      span.textContent = t.textContent.trim();
      t.replaceWith(span);
    }
    card.dataset.dataOriginal = $('.data', card).textContent;
  }
  card.dataset.tipo = v.tipo;
  card.dataset.busca = semAcento(`${v.cliente} ${v.assunto} ${slug}`).toLowerCase();
  $('.eyebrow', card).textContent = `${v.assunto} · ${v.tipo === 'deck' ? `Deck${v.slides ? ` · ${v.slides} slides` : ''}` : 'Página'}`;
  $('h2', card).textContent = v.cliente;
  $('.data', card).textContent = `atualizada em ${fmtData.format(new Date(v.criadaEm))}`;
  $('.thumb', card).innerHTML = miniatura(slug, v);
  $('.thumb', card).setAttribute('aria-label', `Abrir ${v.cliente}`);
  observarMiniaturas(card);
}

// As miniaturas ao vivo só carregam quando aparecem na tela, e em escala 1600×900.
const visivel = 'IntersectionObserver' in window ? new IntersectionObserver((itens) => {
  for (const it of itens) {
    if (!it.isIntersecting) continue;
    it.target.src = it.target.dataset.src;
    visivel.unobserve(it.target);
  }
}, { rootMargin: '200px' }) : null;
const escala = new ResizeObserver((itens) => {
  for (const it of itens) it.target.style.setProperty('--escala', it.contentRect.width / 1600);
});
function observarMiniaturas(raiz) {
  for (const f of raiz.querySelectorAll('iframe.ao-vivo[data-src]')) {
    escala.observe(f.parentElement);
    if (visivel) visivel.observe(f); else f.src = f.dataset.src;
  }
}

// ---------- diálogos ----------
const dlgEnvio = $('#dlg-envio');
const dlgVersoes = $('#dlg-versoes');
for (const d of [dlgEnvio, dlgVersoes]) {
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-fechar]')) d.close(); });
}

// ----- versões -----
let slugVersoes = null;
function abrirVersoes(slug) {
  slugVersoes = slug;
  renderVersoes();
  if (!dlgVersoes.open) dlgVersoes.showModal();
}
function renderVersoes() {
  const slug = slugVersoes;
  const ap = indice[slug];
  const original = estaticos.get(slug);
  const nome = (ap && versaoAtual(ap)?.cliente) || (original && $('h2', original).textContent) || slug;
  $('#versoes-titulo').textContent = nome;
  $('#versoes-slug').textContent = `/${slug}`;
  const linhas = [];
  for (const v of ap?.versoes || []) {
    const noAr = ap.atual === v.id;
    linhas.push(`
      <li class="versao${noAr ? ' no-ar' : ''}">
        <div class="versao-info">
          <strong>${esc(fmtHora.format(new Date(v.criadaEm)))}${noAr ? '<span class="selo">No ar</span>' : ''}</strong>
          <span>${esc(v.assunto)}${v.slides ? ` · ${v.slides} slides` : ''}${v.recuperada ? ' · recuperada do Storage' : ` · por ${esc(v.por)}`}${v.nomeZip ? ` · ${esc(v.nomeZip)}` : ''}</span>
        </div>
        <div class="versao-acoes">
          <a class="btn btn-ghost btn-p" href="/${esc(slug)}?v=${esc(v.id)}" target="_blank" rel="noopener">Ver</a>
          ${noAr ? '' : `<button class="btn btn-ghost btn-p" type="button" data-publicar="${esc(v.id)}">Publicar</button>
          <button class="btn btn-ghost btn-p btn-perigo" type="button" data-excluir="${esc(v.id)}">Excluir</button>`}
        </div>
      </li>`);
  }
  if (original) {
    const noAr = !ap?.atual;
    linhas.push(`
      <li class="versao${noAr ? ' no-ar' : ''}">
        <div class="versao-info">
          <strong>Original${noAr ? '<span class="selo">No ar</span>' : ''}</strong>
          <span>Pasta site/${esc(slug)} do repositório · ${esc(original.dataset.dataOriginal || $('.meta', original).textContent.split('·').pop().trim())}</span>
        </div>
        <div class="versao-acoes">
          <a class="btn btn-ghost btn-p" href="/${esc(slug)}${ap?.atual ? '?v=original' : ''}" target="_blank" rel="noopener">Ver</a>
          ${noAr ? '' : '<button class="btn btn-ghost btn-p" type="button" data-publicar="original">Publicar</button>'}
        </div>
      </li>`);
  }
  $('#versoes-lista').innerHTML = linhas.join('');
  $('#versoes-aviso').textContent = !carregado ? 'Carregando versões…' : disponivel ? '' : 'Envio de versões indisponível: o Supabase não respondeu.';
  $('#versoes-nova').disabled = !disponivel;
}
dlgVersoes.addEventListener('click', async (e) => {
  const pub = e.target.closest('[data-publicar]');
  const exc = e.target.closest('[data-excluir]');
  if (!pub && !exc) return;
  const versao = (pub || exc).dataset[pub ? 'publicar' : 'excluir'];
  if (exc && !confirm('Excluir esta versão? Os arquivos dela são apagados do Supabase e não dá para desfazer.')) return;
  (pub || exc).disabled = true;
  try {
    const r = await api('POST', { acao: pub ? 'publicar' : 'excluir', slug: slugVersoes, versao });
    indice[slugVersoes] = r.apresentacao;
    atualizarCard(slugVersoes);
    contar(); aplicarFiltro();
    renderVersoes();
    $('#versoes-aviso').textContent = pub ? 'Publicada. O link do cliente mostra esta versão em até 15 segundos.' : 'Versão excluída.';
  } catch (err) {
    $('#versoes-aviso').textContent = err.message;
    (pub || exc).disabled = false;
  }
});
$('#versoes-nova').addEventListener('click', () => { dlgVersoes.close(); abrirEnvio(slugVersoes); });
grade.addEventListener('click', (e) => {
  const b = e.target.closest('[data-versoes]');
  if (b) abrirVersoes(b.dataset.versoes);
});

// ----- envio -----
const form = $('#form-envio');
const campo = (n) => form.elements[n];
let zipAberto = null;
let slugFixo = null;
let slugEditado = false;

function existeSlug(s) { return estaticos.has(s) || Boolean(indice[s]); }

function abrirEnvio(slug = null) {
  slugFixo = slug;
  zipAberto = null;
  slugEditado = false;
  form.reset();
  form.dataset.etapa = 'arquivo';
  $('#envio-titulo').innerHTML = slug ? 'Nova <em>versão.</em>' : 'Adicionar <em>apresentação.</em>';
  $('#envio-sub').textContent = slug
    ? `Envie o zip atualizado. Ele vira a versão no ar de /${slug}; as anteriores continuam guardadas.`
    : 'Envie o zip exportado do Claude Design (ou uma pasta com index.html, compactada).';
  campo('slug').readOnly = Boolean(slug);
  $('#envio-candidatos').hidden = true;
  $('#envio-campos').hidden = true;
  $('#envio-status').textContent = '';
  $('#envio-barra').hidden = true;
  $('#envio-ok').hidden = true;
  $('#envio-enviar').disabled = true;
  $('#envio-nome-arquivo').textContent = '';
  if (slug) {
    const ap = indice[slug];
    const v = ap && versaoAtual(ap);
    const c = estaticos.get(slug);
    const t = lerTitulo(c?.dataset.titulo);
    campo('cliente').value = v?.cliente || t?.cliente || (c && $('h2', c).textContent) || '';
    campo('assunto').value = v?.assunto || t?.assunto || '';
    campo('slug').value = slug;
  }
  dlgEnvio.showModal();
}
$('#btn-adicionar').addEventListener('click', () => abrirEnvio());

function sugerirSlug() {
  if (slugFixo || slugEditado) return;
  const a = campo('assunto').value.trim();
  campo('slug').value = paraSlug(campo('cliente').value + (a && !/^proposta$/i.test(a) ? ' ' + a : ''));
  checarSlug();
}
function checarSlug() {
  const s = campo('slug').value;
  const aviso = $('#envio-slug-aviso');
  if (slugFixo) { aviso.textContent = ''; return; }
  aviso.textContent = !s ? '' : !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)
    ? 'Use só letras minúsculas, números e hífen.'
    : existeSlug(s) ? `Já existe /${s}: o zip vai entrar como nova versão dela.` : `O link vai ser ${location.host}/${s}`;
}
campo('cliente').addEventListener('input', sugerirSlug);
campo('assunto').addEventListener('input', sugerirSlug);
campo('slug').addEventListener('input', () => { slugEditado = true; campo('slug').value = campo('slug').value.toLowerCase(); checarSlug(); });

function escolherCandidato(c) {
  if (!slugFixo) {
    if (c.sugestao.cliente) campo('cliente').value = c.sugestao.cliente;
    if (c.sugestao.assunto) campo('assunto').value = c.sugestao.assunto;
    if (c.sugestao.slug) { campo('slug').value = c.sugestao.slug; slugEditado = true; } else { slugEditado = false; sugerirSlug(); }
    checarSlug();
  }
  $('#envio-campos').hidden = false;
  $('#envio-enviar').disabled = false;
}

async function receberArquivo(arquivo) {
  if (!arquivo) return;
  $('#envio-nome-arquivo').textContent = arquivo.name;
  $('#envio-status').textContent = 'Abrindo o zip…';
  $('#envio-candidatos').hidden = true;
  $('#envio-campos').hidden = true;
  $('#envio-enviar').disabled = true;
  try {
    zipAberto = await abrirZip(arquivo);
    zipAberto.nomeZip = arquivo.name;
    const cs = zipAberto.candidatos;
    $('#envio-status').textContent = '';
    if (cs.length > 1) {
      $('#envio-lista').innerHTML = cs.map((c, i) => `
        <label class="opcao"><input type="radio" name="candidato" value="${i}"${i === 0 ? ' checked' : ''}>
          <span>${esc(c.rotulo)}<small>${c.tipo === 'pagina' ? 'Página' : 'Deck'}${c.tipo === 'bundle' ? ' · arquivo único' : ''}</small></span></label>`).join('');
      $('#envio-candidatos').hidden = false;
    }
    escolherCandidato(cs[0]);
  } catch (err) {
    zipAberto = null;
    $('#envio-status').textContent = err.message;
  }
}
campo('zip').addEventListener('change', () => receberArquivo(campo('zip').files[0]));
$('#envio-lista').addEventListener('change', (e) => { if (e.target.name === 'candidato') escolherCandidato(zipAberto.candidatos[+e.target.value]); });
const soltar = $('#envio-soltar');
for (const ev of ['dragenter', 'dragover']) soltar.addEventListener(ev, (e) => { e.preventDefault(); soltar.classList.add('sobre'); });
for (const ev of ['dragleave', 'drop']) soltar.addEventListener(ev, () => soltar.classList.remove('sobre'));
soltar.addEventListener('drop', (e) => { e.preventDefault(); receberArquivo(e.dataTransfer.files[0]); });

async function enviarArquivos(envios, arquivos, progresso) {
  const fila = [...arquivos.entries()];
  let feitos = 0;
  const trabalhador = async () => {
    while (fila.length) {
      const [p, blob] = fila.shift();
      let ultimo;
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const r = await fetch(envios[p], {
          method: 'PUT', body: blob,
          headers: { 'Content-Type': blob.type || tipoDe(p), 'cache-control': p === 'index.html' ? 'max-age=60' : 'max-age=31536000', 'x-upsert': 'true' },
        }).catch((e) => ({ ok: false, statusText: e.message }));
        if (r.ok) { ultimo = null; break; }
        ultimo = `${p}: ${r.status || ''} ${r.statusText || ''}`;
      }
      if (ultimo) throw new Error('Falhou o envio de ' + ultimo);
      progresso(++feitos);
    }
  };
  await Promise.all(Array.from({ length: 4 }, trabalhador));
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!zipAberto) return;
  const slug = campo('slug').value.trim();
  const cliente = campo('cliente').value.trim();
  const assunto = campo('assunto').value.trim() || 'Proposta';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { checarSlug(); campo('slug').focus(); return; }
  if (!cliente) { campo('cliente').focus(); return; }
  const marcado = form.querySelector('input[name="candidato"]:checked');
  const cand = zipAberto.candidatos[marcado ? +marcado.value : 0];
  const botao = $('#envio-enviar');
  const status = $('#envio-status');
  const barra = $('#envio-barra');
  botao.disabled = true;
  form.dataset.etapa = 'enviando';
  try {
    status.textContent = 'Preparando os arquivos…';
    const pacote = await zipAberto.montar(cand);
    const caminhos = ['index.html', ...pacote.arquivos.keys()];
    const tamanho = [...pacote.arquivos.values()].reduce((s, b) => s + b.size, 0);
    if (tamanho > 200 * 1024 * 1024) throw new Error('A apresentação passa de 200 MB. Reduza as imagens e vídeos.');
    const grande = [...pacote.arquivos.entries()].find(([, b]) => b.size > 50 * 1024 * 1024);
    if (grande) throw new Error(`${grande[0]} passa de 50 MB, o limite do Supabase gratuito.`);

    const prep = await api('POST', { acao: 'preparar', slug, arquivos: caminhos });
    const html = pacote.finalizar(prep.base, `Isla × ${cliente} · ${assunto}`);
    pacote.arquivos.set('index.html', new Blob([html], { type: 'text/html' }));
    barra.hidden = false;
    barra.max = caminhos.length;
    barra.value = 0;
    await enviarArquivos(prep.envios, pacote.arquivos, (n) => {
      barra.value = n;
      status.textContent = `Enviando ${n} de ${caminhos.length} arquivos…`;
    });
    status.textContent = 'Publicando…';
    const r = await api('POST', {
      acao: 'confirmar', slug, versao: prep.versao, arquivos: caminhos,
      cliente, assunto, tipo: pacote.tipo, slides: pacote.slides, nomeZip: zipAberto.nomeZip,
    });
    indice[slug] = r.apresentacao;
    atualizarCard(slug);
    contar(); aplicarFiltro();
    status.textContent = '';
    barra.hidden = true;
    form.dataset.etapa = 'pronto';
    const link = `${location.origin}/${slug}`;
    $('#envio-ok').hidden = false;
    $('#envio-link').href = link;
    $('#envio-link').textContent = link.replace(/^https?:\/\//, '');
  } catch (err) {
    status.textContent = err.message;
    form.dataset.etapa = 'arquivo';
    botao.disabled = false;
  }
});
$('#envio-copiar').addEventListener('click', (e) => { e.currentTarget.dataset.copiar = campo('slug').value; });

// ---------- carga inicial ----------
for (const slug of estaticos.keys()) atualizarCard(slug);
contar();
try {
  const dados = await api('GET');
  indice = dados.apresentacoes || {};
  publico = dados.publico || '';
  disponivel = true;
  for (const slug of Object.keys(indice).sort((a, b) => (indice[a].versoes[0]?.criadaEm || '').localeCompare(indice[b].versoes[0]?.criadaEm || ''))) {
    atualizarCard(slug);
  }
  contar(); aplicarFiltro();
} catch (err) {
  console.warn('Versões indisponíveis:', err.message);
  const b = $('#btn-adicionar');
  b.disabled = true;
  b.title = err.message;
  $('#aviso-supabase').textContent = err.message;
  $('#aviso-supabase').hidden = false;
}
carregado = true;
document.body.dataset.carregado = '';
if (dlgVersoes.open) renderVersoes();
