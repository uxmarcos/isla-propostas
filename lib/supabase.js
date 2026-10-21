// Acesso ao Supabase Storage (só fetch, funciona no Edge e no Node).
//
// Variáveis de ambiente na Vercel (Production):
//   SUPABASE_URL          https://<ref>.supabase.co
//   SUPABASE_SERVICE_KEY  chave service_role (eyJ...) ou secret (sb_secret_...) do projeto. Nunca vai para o navegador.
//
// Buckets (criados sozinhos no primeiro envio):
//   apresentacoes  público: <slug>/<versão>/index.html, assets/... (é o que os clientes carregam)
//   painel         privado: indice.json com todas as apresentações e versões
export const BUCKET = 'apresentacoes';
const PRIVADO = 'painel';
const INDICE = 'indice.json';

export const supabaseConfigurado = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

const base = () => process.env.SUPABASE_URL.trim().replace(/\/+$/, "") + "/storage/v1";
// Aceita a chave service_role antiga (JWT, "eyJ...") e a secret nova ("sb_secret_..."): a nova não é JWT,
// então vai só no apikey (o Supabase recusa um Authorization: Bearer que não seja JWT).
const auth = () => {
  const chave = process.env.SUPABASE_SERVICE_KEY.trim();
  return chave.startsWith('eyJ') ? { Authorization: `Bearer ${chave}`, apikey: chave } : { apikey: chave };
};
const caminho = (p) => p.split('/').map(encodeURIComponent).join('/');

export const urlPublica = (p) => `${base()}/object/public/${BUCKET}/${caminho(p)}`;

async function chamar(metodo, rota, corpo, headers = {}) {
  const r = await fetch(base() + rota, {
    method: metodo,
    headers: { ...auth(), ...(corpo !== undefined && typeof corpo !== 'string' ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
    cache: 'no-store',
  });
  if (!r.ok) {
    const erro = new Error(`Supabase ${metodo} ${rota}: ${r.status} ${await r.text().catch(() => '')}`.slice(0, 400));
    erro.status = r.status;
    throw erro;
  }
  return r;
}

export async function garantirBuckets() {
  for (const [id, publico] of [[BUCKET, true], [PRIVADO, false]]) {
    try {
      await chamar('POST', '/bucket', { id, name: id, public: publico, file_size_limit: 50 * 1024 * 1024 });
    } catch (e) {
      if (!/already exists|Duplicate|409/i.test(e.message)) throw e;
    }
  }
}

// { apresentacoes: { [slug]: { cliente, assunto, titulo, tipo, slides, atual, versoes: [...] } } }
export async function lerIndice() {
  try {
    const r = await chamar('GET', `/object/authenticated/${PRIVADO}/${INDICE}`);
    const dados = await r.json();
    return dados && dados.apresentacoes ? dados : { apresentacoes: {} };
  } catch (e) {
    if (e.status === 404 || e.status === 400) return { apresentacoes: {} }; // ainda não existe
    throw e;
  }
}

export async function salvarIndice(indice) {
  await chamar('POST', `/object/${PRIVADO}/${INDICE}`, JSON.stringify(indice), {
    'Content-Type': 'application/json', 'x-upsert': 'true', 'cache-control': 'no-cache',
  });
}

// URL para o navegador mandar o arquivo direto ao Supabase (não passa pelo limite de 4,5 MB da Vercel).
export async function urlDeEnvio(p) {
  const r = await chamar('POST', `/object/upload/sign/${BUCKET}/${caminho(p)}`, {}, { 'x-upsert': 'true' });
  const { url } = await r.json();
  return base() + url;
}

export async function existe(p) {
  const r = await fetch(urlPublica(p), { method: 'HEAD', cache: 'no-store' });
  return r.ok;
}

export async function apagar(caminhos) {
  for (let i = 0; i < caminhos.length; i += 500) {
    await chamar('DELETE', `/object/${BUCKET}`, { prefixes: caminhos.slice(i, i + 500) });
  }
}

// Requisição leve para o projeto gratuito não ser pausado por inatividade.
export async function pingar() {
  await chamar('GET', '/bucket');
}
