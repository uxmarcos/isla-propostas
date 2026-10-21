// Registro das versões enviadas pelo painel: um log que só cresce, no bucket privado "painel".
//
//   <slug>/versoes/<versão>.json                dados de cada versão enviada (escrito uma vez)
//   <slug>/publicacoes/<quando>__<versão>.json   cada "Publicar"; o mais recente é o que está no ar
//                                               (<versão> 'original' = pasta site/<slug> do repositório)
//
// Nada é reescrito: publicar uma versão antiga só acrescenta uma publicação, e as versões continuam
// no log até alguém excluir. O estado sai da listagem do Storage, que não passa por cache.
import { BUCKET, PRIVADO, apagar, apagarDe, gravarJson, lerJson, listar, listarTudo, urlPublica } from './supabase.js';

const carimbo = () => new Date().toISOString().replace(/\D/g, '').slice(0, 17) + '-' + crypto.randomUUID().slice(0, 4);
const daPublicacao = (nome) => nome.replace(/\.json$/, '').split('__')[1] || null;
const VERSAO = /^v(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})-[0-9a-f]{6}$/;

// Versão no ar: id, null (está na Original) ou undefined (nunca usou o painel).
export async function versaoNoAr(slug) {
  const [ultima] = await listar(PRIVADO, `${slug}/publicacoes/`, { limite: 1, ordem: 'desc' });
  if (!ultima) return undefined;
  const v = daPublicacao(ultima.name);
  return v === 'original' ? null : v;
}

export async function lerApresentacao(slug) {
  const [arquivos, atual] = await Promise.all([listar(PRIVADO, `${slug}/versoes/`), versaoNoAr(slug)]);
  if (!arquivos.length && atual === undefined) return null;
  const versoes = (await Promise.all(arquivos.map((x) => lerJson(PRIVADO, `${slug}/versoes/${x.name}`))))
    .filter(Boolean)
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
  const noAr = versoes.find((v) => v.id === atual) || null;
  const ref = noAr || versoes[0] || {};
  return { cliente: ref.cliente, assunto: ref.assunto, tipo: ref.tipo, slides: ref.slides, atual: noAr ? noAr.id : null, versoes };
}

export async function lerTodas() {
  await migrarIndiceAntigo();
  await recuperarVersoes();
  const slugs = (await listar(PRIVADO, '')).filter((x) => x.id === null).map((x) => x.name);
  const lista = await Promise.all(slugs.map(async (s) => [s, await lerApresentacao(s)]));
  return Object.fromEntries(lista.filter(([, ap]) => ap));
}

export async function publicar(slug, versao, por) {
  await gravarJson(PRIVADO, `${slug}/publicacoes/${carimbo()}__${versao}.json`, { versao, por, em: new Date().toISOString() });
}

// Upsert: uma versão "recuperada" (veja abaixo) pode ter sido registrada antes da confirmação chegar.
export async function registrarVersao(slug, registro) {
  await gravarJson(PRIVADO, `${slug}/versoes/${registro.id}.json`, registro, { upsert: true });
}

export async function excluirVersao(slug, versao) {
  const v = await lerJson(PRIVADO, `${slug}/versoes/${versao}.json`);
  const arquivos = v?.arquivos?.length ? v.arquivos : await listarTudo(BUCKET, `${slug}/${versao}/`);
  if (arquivos.length) await apagar(arquivos.map((a) => `${slug}/${versao}/${a}`));
  await apagarDe(PRIVADO, [`${slug}/versoes/${versao}.json`]);
}

// Versões cujos arquivos estão no Storage (com index.html, que é o último a subir) mas que ficaram fora
// do registro: envio que não chegou a confirmar, ou o que se perdeu no formato antigo do índice.
async function recuperarVersoes() {
  const slugs = (await listar(BUCKET, '')).filter((x) => x.id === null).map((x) => x.name);
  await Promise.all(slugs.map(async (slug) => {
    const [pastas, registradas] = await Promise.all([listar(BUCKET, `${slug}/`), listar(PRIVADO, `${slug}/versoes/`)]);
    const conhecidas = new Set(registradas.map((x) => x.name.replace(/\.json$/, '')));
    for (const pasta of pastas.filter((x) => x.id === null && VERSAO.test(x.name) && !conhecidas.has(x.name))) {
      const arquivos = await listarTudo(BUCKET, `${slug}/${pasta.name}/`);
      if (!arquivos.includes('index.html')) continue; // envio incompleto
      const html = await fetch(urlPublica(`${slug}/${pasta.name}/index.html`)).then((r) => (r.ok ? r.text() : ''));
      const titulo = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || '').replace(/&amp;/g, '&');
      const m = titulo.match(/^Isla\s*×\s*(.+?)\s*·\s*(.+)$/);
      const [, a, mes, d, h, min, s] = VERSAO.exec(pasta.name);
      await registrarVersao(slug, {
        id: pasta.name, criadaEm: `${a}-${mes}-${d}T${h}:${min}:${s}.000Z`, por: 'desconhecido', nomeZip: '', recuperada: true,
        cliente: m ? m[1].trim() : slug, assunto: m ? m[2].trim() : 'Proposta',
        tipo: html.includes('deck-stage') ? 'deck' : 'pagina',
        slides: (html.match(/<section\b[^>]*\bdata-label=/g) || []).length,
        arquivos,
      });
    }
  }));
}

// Formato antigo: um indice.json só, reescrito a cada ação. Convertido uma vez e apagado.
async function migrarIndiceAntigo() {
  const antigo = await lerJson(PRIVADO, 'indice.json');
  if (!antigo?.apresentacoes) return;
  for (const [slug, ap] of Object.entries(antigo.apresentacoes)) {
    for (const v of ap.versoes || []) await registrarVersao(slug, v);
    if ((await versaoNoAr(slug)) === undefined) await publicar(slug, ap.atual || 'original', 'migração');
  }
  await apagarDe(PRIVADO, ['indice.json']);
}
