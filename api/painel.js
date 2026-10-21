// API do painel (só para quem está logado). O navegador abre o zip, pede URLs de envio,
// manda os arquivos direto para o Supabase e confirma a versão.
//
//   GET  /api/painel                          → índice (apresentações e versões)
//   POST /api/painel { acao: 'preparar',  slug, arquivos: [caminho] }   → { versao, base, envios: { caminho: url } }
//   POST /api/painel { acao: 'confirmar', slug, versao, arquivos, cliente, assunto, tipo, slides, nomeZip }
//   POST /api/painel { acao: 'publicar',  slug, versao }   versao 'original' volta para a pasta do repositório
//   POST /api/painel { acao: 'excluir',   slug, versao }   não exclui a versão que está no ar
// O registro das versões (lib/registro.js) é um log: publicar não apaga nada, só excluir apaga.
import { usuarioDaSessao } from '../lib/sessao.js';
import { existe, garantirBuckets, supabaseConfigurado, urlDeEnvio, urlPublica } from '../lib/supabase.js';
import { excluirVersao, lerApresentacao, lerTodas, publicar, registrarVersao } from '../lib/registro.js';

// Rotas do próprio site que não podem virar slug.
const RESERVADOS = new Set(['api', 'login', 'sair', 'index', 'painel', '_painel', '_vercel', '404']);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CAMINHO = /^(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_ ./()-]*$/;
const MAX_ARQUIVOS = 400;

const json = (dados, status = 200) => new Response(JSON.stringify(dados), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
const erro = (mensagem, status = 400) => json({ erro: mensagem }, status);

function novaVersao() {
  // Ordena por data e não colide se dois envios caírem no mesmo segundo.
  const d = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `v${d}-${crypto.randomUUID().slice(0, 6)}`;
}

const texto = (v, max = 120) => String(v || '').trim().slice(0, max);

// Garante a versão recém-registrada na resposta, mesmo que a leitura ainda traga a cópia anterior dela.
function comVersao(ap, registro) {
  const versoes = [registro, ...ap.versoes.filter((v) => v.id !== registro.id)].sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
  const { cliente, assunto, tipo, slides } = registro;
  return { ...ap, cliente, assunto, tipo, slides, atual: registro.id, versoes };
}

async function autenticar(request) {
  const usuario = await usuarioDaSessao(request);
  if (!usuario) return { resposta: erro('Faça login de novo.', 401) };
  if (!supabaseConfigurado()) return { resposta: erro('Supabase não configurado na Vercel (SUPABASE_URL e SUPABASE_SERVICE_KEY).', 503) };
  return { usuario };
}

export async function GET(request) {
  const { usuario, resposta } = await autenticar(request);
  if (resposta) return resposta;
  return json({ usuario, publico: urlPublica(''), apresentacoes: await lerTodas() });
}

export async function POST(request) {
  const { usuario, resposta } = await autenticar(request);
  if (resposta) return resposta;
  let corpo;
  try { corpo = await request.json(); } catch { return erro('Pedido inválido.'); }
  const slug = String(corpo.slug || '');
  if (!SLUG.test(slug) || RESERVADOS.has(slug)) return erro('Slug inválido: use letras minúsculas, números e hífen.');

  try {
    if (corpo.acao === 'preparar') {
      const arquivos = Array.isArray(corpo.arquivos) ? corpo.arquivos.map(String) : [];
      if (!arquivos.includes('index.html')) return erro('Faltou o index.html da apresentação.');
      if (arquivos.length > MAX_ARQUIVOS) return erro(`Arquivos demais (${arquivos.length}). O limite é ${MAX_ARQUIVOS}.`);
      const ruim = arquivos.find((a) => !CAMINHO.test(a));
      if (ruim) return erro(`Nome de arquivo não suportado: ${ruim}`);
      await garantirBuckets();
      const versao = novaVersao();
      const urls = await Promise.all(arquivos.map((a) => urlDeEnvio(`${slug}/${versao}/${a}`)));
      return json({
        versao,
        base: urlPublica(`${slug}/${versao}/`),
        envios: Object.fromEntries(arquivos.map((a, i) => [a, urls[i]])),
      });
    }

    const versao = String(corpo.versao || '');

    if (corpo.acao === 'confirmar') {
      if (!/^v\d{14}-[0-9a-f]{6}$/.test(versao)) return erro('Versão inválida.');
      if (!(await existe(`${slug}/${versao}/index.html`))) return erro('O envio não terminou: index.html não chegou ao Supabase.');
      const registro = {
        id: versao, criadaEm: new Date().toISOString(), por: usuario, nomeZip: texto(corpo.nomeZip, 200),
        cliente: texto(corpo.cliente) || slug,
        assunto: texto(corpo.assunto) || 'Proposta',
        tipo: corpo.tipo === 'pagina' ? 'pagina' : 'deck',
        slides: Math.max(0, Math.min(500, Number(corpo.slides) || 0)),
        arquivos: (Array.isArray(corpo.arquivos) ? corpo.arquivos : []).map(String).filter((a) => CAMINHO.test(a)).slice(0, MAX_ARQUIVOS),
      };
      await registrarVersao(slug, registro);
      await publicar(slug, versao, usuario);
      return json({ ok: true, apresentacao: comVersao(await lerApresentacao(slug), registro) });
    }

    const ap = await lerApresentacao(slug);
    if (!ap) return erro('Essa apresentação não tem versões enviadas pelo painel.', 404);

    if (corpo.acao === 'publicar') {
      if (versao !== 'original' && !ap.versoes.some((x) => x.id === versao)) return erro('Versão não encontrada.', 404);
      await publicar(slug, versao, usuario);
      return json({ ok: true, apresentacao: await lerApresentacao(slug) });
    }

    if (corpo.acao === 'excluir') {
      if (!ap.versoes.some((x) => x.id === versao)) return erro('Versão não encontrada.', 404);
      if (ap.atual === versao) return erro('Essa é a versão no ar. Publique outra antes de excluir.');
      await excluirVersao(slug, versao);
      return json({ ok: true, apresentacao: await lerApresentacao(slug) });
    }

    return erro('Ação desconhecida.');
  } catch (e) {
    console.error(e);
    return erro('Falha ao falar com o Supabase: ' + e.message, 502);
  }
}
