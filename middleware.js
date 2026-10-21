// 1. Login do painel (página inicial). As propostas continuam abertas.
// 2. /<slug>: se a apresentação tem versão publicada no Supabase (enviada pelo painel), serve essa versão;
//    senão segue para a pasta estática site/<slug>/ (a versão "Original" do repositório).
//    /<slug>?v=<versão> mostra uma versão específica, só para quem está logado.
//
// Variáveis de ambiente: veja lib/sessao.js e lib/supabase.js. Sem as do Supabase, só o estático funciona.
import { next } from '@vercel/functions';
import { COOKIE, DURACAO, acessos, assinar, configurado, igual, usuarioDaSessao } from './lib/sessao.js';
import { supabaseConfigurado, urlPublica } from './lib/supabase.js';
import { versaoNoAr } from './lib/registro.js';
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

// Guarda a versão no ar por alguns segundos em cada instância, para não consultar a cada visita.
// Link sem versão no painel (o caso das propostas estáticas) fica menos tempo, para um envio novo aparecer logo.
const cache = new Map();
async function noAr(slug) {
  const c = cache.get(slug);
  if (c && Date.now() - c.em < (c.versao === undefined ? 5000 : 15000)) return c.versao;
  const versao = await versaoNoAr(slug);
  cache.set(slug, { em: Date.now(), versao });
  return versao;
}

async function servirApresentacao(request, slug) {
  if (!supabaseConfigurado()) return null;
  const url = new URL(request.url);
  const pedida = url.searchParams.get('v');
  const miniatura = url.searchParams.has('miniatura');
  const privado = Boolean(pedida);
  let versao;
  if (pedida) {
    if (!(await usuarioDaSessao(request))) return redirecionar('/login', request);
    if (pedida === 'original' || !/^v\d{14}-[0-9a-f]{6}$/.test(pedida)) return null;
    versao = pedida;
  } else {
    try {
      versao = await noAr(slug);
    } catch (e) {
      console.error('registro indisponível, servindo o estático', e.message);
      return null;
    }
  }
  if (!versao) return null; // sem versão no painel, ou a Original está no ar: fica o estático

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
