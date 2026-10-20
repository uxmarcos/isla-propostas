// Login do painel (página inicial). As propostas (/<slug>) continuam abertas:
// só as rotas do matcher passam por aqui.
//
// Variáveis de ambiente na Vercel (Production):
//   PAINEL_ACESSOS  e-mail:senha separados por vírgula, ex: marcos@isla.to:senha,joao@isla.to:outra
//   PAINEL_SEGREDO  texto aleatório longo que assina o cookie de sessão (trocar derruba todas as sessões)
// Sem elas, o painel fica fechado para todo mundo.
import { next } from '@vercel/functions';

export const config = {
  matcher: ['/', '/index', '/index.html', '/_painel/:path*', '/login', '/sair'],
};

const COOKIE = 'isla_sessao';
const DURACAO = 60 * 60 * 24 * 30; // 30 dias, em segundos
const enc = new TextEncoder();

// Comparação em tempo constante, para não vazar a senha pelo tempo de resposta.
function igual(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function acessos() {
  const lista = new Map();
  for (const item of (process.env.PAINEL_ACESSOS || '').split(',')) {
    const i = item.lastIndexOf(':');
    if (i > 0) lista.set(item.slice(0, i).trim().toLowerCase(), item.slice(i + 1).trim());
  }
  return lista;
}

async function assinar(texto) {
  const chave = await crypto.subtle.importKey(
    'raw', enc.encode(process.env.PAINEL_SEGREDO), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', chave, enc.encode(texto));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c]));
}

async function sessaoValida(request) {
  const cookie = (request.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!cookie) return false;
  const [email, expira, sig] = decodeURIComponent(cookie.slice(COOKIE.length + 1)).split('|');
  if (!email || !sig || Number(expira) < Date.now() / 1000) return false;
  if (!acessos().has(email)) return false; // e-mail removido da lista perde o acesso na hora
  return igual(sig, await assinar(email + '|' + expira));
}

function redirecionar(url, request, cookie) {
  const headers = { Location: new URL(url, request.url).toString(), 'Cache-Control': 'no-store' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(null, { status: 303, headers });
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url);

  if (!process.env.PAINEL_SEGREDO || !acessos().size) {
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
    if (await sessaoValida(request)) return redirecionar('/', request);
    return next({ headers: { 'Cache-Control': 'no-store' } });
  }

  if (await sessaoValida(request)) return next({ headers: { 'Cache-Control': 'private, no-store' } });
  return redirecionar('/login', request);
}
