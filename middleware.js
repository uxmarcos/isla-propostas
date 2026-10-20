// Protege o painel (página inicial) com usuário e senha.
// As propostas (/<slug>) continuam abertas: só as rotas do matcher passam por aqui.
//
// Acessos: variável de ambiente PAINEL_ACESSOS na Vercel, no formato
//   nome:senha,outro:outrasenha
// Sem a variável, o painel fica fechado para todo mundo.
import { next } from '@vercel/functions';

export const config = {
  matcher: ['/', '/index', '/index.html', '/_painel/:path*'],
};

// Comparação em tempo constante, para não vazar a senha pelo tempo de resposta.
function igual(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export default function middleware(request) {
  const acessos = (process.env.PAINEL_ACESSOS || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.includes(':'));

  if (!acessos.length) {
    return new Response('Painel fechado: nenhum acesso configurado (PAINEL_ACESSOS).', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const [tipo, valor] = (request.headers.get('authorization') || '').split(' ');
  if (tipo === 'Basic' && valor) {
    let par = '';
    try { par = atob(valor); } catch {}
    let ok = false;
    for (const a of acessos) ok = igual(a, par) || ok;
    if (ok) return next({ headers: { 'Cache-Control': 'private, no-store' } });
  }

  return new Response('Acesso restrito ao time da Isla.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Isla - Painel de propostas", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}
