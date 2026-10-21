// Acesso ao Supabase Storage (só fetch, funciona no Edge e no Node).
//
// Variáveis de ambiente na Vercel (Production):
//   SUPABASE_URL          https://<ref>.supabase.co
//   SUPABASE_SERVICE_KEY  chave service_role (eyJ...) ou secret (sb_secret_...) do projeto. Nunca vai para o navegador.
//
// Buckets (criados sozinhos no primeiro envio):
//   apresentacoes  público: <slug>/<versão>/index.html, assets/... (é o que os clientes carregam)
//   painel         privado: o registro de versões (lib/registro.js)
export const BUCKET = 'apresentacoes';
export const PRIVADO = 'painel';

export const supabaseConfigurado = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

const base = () => process.env.SUPABASE_URL.trim().replace(/\/+$/, '') + '/storage/v1';
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

// Listagem: vem do banco do Storage (sem cache de CDN), por isso é a fonte da verdade do registro.
// Devolve [{ name, id, ... }]; pastas vêm com id null.
export async function listar(bucket, prefixo, { limite = 1000, ordem = 'asc' } = {}) {
  const r = await chamar('POST', `/object/list/${bucket}`, {
    prefix: prefixo, limit: limite, offset: 0, sortBy: { column: 'name', order: ordem },
  });
  return (await r.json()).filter((x) => x.name !== '.emptyFolderPlaceholder');
}

// Todos os arquivos abaixo de uma pasta (caminhos relativos a ela).
export async function listarTudo(bucket, pasta) {
  const saida = [];
  for (const item of await listar(bucket, pasta)) {
    if (item.id === null) for (const p of await listarTudo(bucket, `${pasta}${item.name}/`)) saida.push(`${item.name}/${p}`);
    else saida.push(item.name);
  }
  return saida;
}

export async function lerJson(bucket, p) {
  try {
    return await (await chamar('GET', `/object/authenticated/${bucket}/${caminho(p)}`)).json();
  } catch (e) {
    if (e.status === 404 || e.status === 400) return null;
    throw e;
  }
}

// Por padrão sem upsert: os arquivos do registro são escritos uma vez e nunca alterados.
export async function gravarJson(bucket, p, dados, { upsert = false } = {}) {
  await chamar('POST', `/object/${bucket}/${caminho(p)}`, JSON.stringify(dados), {
    'Content-Type': 'application/json', ...(upsert ? { 'x-upsert': 'true' } : {}),
  });
}

export async function apagarDe(bucket, caminhos) {
  for (let i = 0; i < caminhos.length; i += 500) {
    await chamar('DELETE', `/object/${bucket}`, { prefixes: caminhos.slice(i, i + 500) });
  }
}

// URL para o navegador mandar o arquivo direto ao Supabase (não passa pelo limite de 4,5 MB da Vercel).
export async function urlDeEnvio(p) {
  const r = await chamar('POST', `/object/upload/sign/${BUCKET}/${caminho(p)}`, {}, { 'x-upsert': 'true' });
  const { url } = await r.json();
  return base() + url;
}

export async function existe(p) {
  const i = p.lastIndexOf('/');
  return (await listar(BUCKET, p.slice(0, i + 1))).some((x) => x.name === p.slice(i + 1) && x.id !== null);
}

export const apagar = (caminhos) => apagarDe(BUCKET, caminhos);

// Requisição leve para o projeto gratuito não ser pausado por inatividade.
export async function pingar() {
  await chamar('GET', '/bucket');
}
