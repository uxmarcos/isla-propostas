// 1. Login do painel (página inicial). As propostas continuam abertas.
// 2. /<slug>: se a apresentação tem versão publicada no Supabase (enviada pelo painel), serve essa versão;
//    senão segue para a pasta estática site/<slug>/ (a versão "Original" do repositório).
//    /<slug>?v=<versão> mostra uma versão específica, só para quem está logado.
//
// Variáveis de ambiente: veja lib/sessao.js e lib/supabase.js. Sem as do Supabase, só o estático funciona.
import { next } from '@vercel/functions';
import { COOKIE, DURACAO, acessos, assinar, configurado, igual, usuarioDaSessao } from './lib/sessao.js';
import { lerIndice, supabaseConfigurado, urlPublica } from './lib/supabase.js';
import { aplicarControles } from './lib/controles.js';

export const config = {
  matcher: ['/', '/index', '/index.html', '/_painel/:path*', '/login', '/sair', '/:slug'],
};

const PAINEL = new Set(['/', '/index', '/index.html', '/login', '/sair']);

function redirecionar(url, request, cookie) {
  const headers = { Location: new URL(url, request.url).toString(), 'Cache-Control': 'no-store' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(null, { status: 303, headers });
}

// O índice muda pouco: guarda por alguns segundos em cada instância para não buscar a cada visita.
let cache = { em: 0, indice: null };
async function indice() {
  if (cache.indice && Date.now() - cache.em < 15000) return cache.indice;
  cache = { em: Date.now(), indice: await lerIndice() };
  return cache.indice;
}

async function servirApresentacao(request, slug) {
  if (!supabaseConfigurado()) return null;
  const url = new URL(request.url);
  const pedida = url.searchParams.get('v');
  const miniatura = url.searchParams.has('miniatura');
  let ap;
  try {
    ap = (await indice()).apresentacoes[slug];
  } catch (e) {
    console.error('índice indisponível, servindo o estático', e.message);
    return null;
  }
  if (!ap) return null;

  let versao = ap.atual;
  const privado = Boolean(pedida);
  if (pedida) {
    if (!(await usuarioDaSessao(request))) return redirecionar('/login', request);
    if (pedida === 'original') return null;
    versao = ap.versoes.some((v) => v.id === pedida) ? pedida : null;
  }
  if (!versao) return null; // sem versão publicada: fica o estático

  const r = await fetch(urlPublica(`${slug}/${versao}/index.html`));
  if (!r.ok) {
    console.error(`versão ${slug}/${versao} sem index.html (${r.status})`);
    return null;
  }
  return new Response(aplicarControles(await r.text(), { miniatura }), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': privado || miniatura ? 'private, no-store' : 'public, max-age=0, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url);

  if (!PAINEL.has(pathname) && !pathname.startsWith('/_painel/')) {
    const slug = pathname.slice(1);
    if (/^[a-z0-9-]+$/.test(slug)) return (await servirApresentacao(request, slug)) || next();
    return next();
  }

  if (!configurado()) {
    return new Response('Painel fechado: acessos não configurados.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  if (pathname === '/sair') {
    return redirecionar('/login', request, `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  }

  if (pathname === '/login') {
    if (request.method === 'POST') {
      let email = '', senha = '';
      try {
        const form = await request.formData();
        email = String(form.get('email') || '').trim().toLowerCase();
        senha = String(form.get('senha') || '');
      } catch {}
      const certa = acessos().get(email);
      if (certa !== undefined && igual(senha, certa)) {
        const expira = Math.floor(Date.now() / 1000) + DURACAO;
        const valor = encodeURIComponent(`${email}|${expira}|${await assinar(email + '|' + expira)}`);
        return redirecionar('/', request, `${COOKIE}=${valor}; Path=/; Max-Age=${DURACAO}; HttpOnly; Secure; SameSite=Lax`);
      }
      return redirecionar('/login?erro=1', request);
    }
    // Já logado não precisa ver o formulário.
    if (await usuarioDaSessao(request)) return redirecionar('/', request);
    return next({ headers: { 'Cache-Control': 'no-store' } });
  }

  if (await usuarioDaSessao(request)) return next({ headers: { 'Cache-Control': 'private, no-store' } });
  return redirecionar('/login', request);
}
