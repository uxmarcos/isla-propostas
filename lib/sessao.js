// Sessão do painel: usada pelo middleware.js (Edge) e pelas funções em api/ (Node).
//
// Variáveis de ambiente na Vercel (Production):
//   PAINEL_ACESSOS  e-mail:senha separados por vírgula, ex: marcos@isla.to:senha,joao@isla.to:outra
//   PAINEL_SEGREDO  texto aleatório longo que assina o cookie de sessão (trocar derruba todas as sessões)
export const COOKIE = 'isla_sessao';
export const DURACAO = 60 * 60 * 24 * 30; // 30 dias, em segundos
const enc = new TextEncoder();

// Comparação em tempo constante, para não vazar a senha pelo tempo de resposta.
export function igual(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function acessos() {
  const lista = new Map();
  for (const item of (process.env.PAINEL_ACESSOS || '').split(',')) {
    const i = item.lastIndexOf(':');
    if (i > 0) lista.set(item.slice(0, i).trim().toLowerCase(), item.slice(i + 1).trim());
  }
  return lista;
}

export const configurado = () => Boolean(process.env.PAINEL_SEGREDO && acessos().size);

export async function assinar(texto) {
  const chave = await crypto.subtle.importKey(
    'raw', enc.encode(process.env.PAINEL_SEGREDO), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', chave, enc.encode(texto));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c]));
}

// Devolve o e-mail da sessão, ou null.
export async function usuarioDaSessao(request) {
  if (!configurado()) return null;
  const cookie = (request.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!cookie) return null;
  const [email, expira, sig] = decodeURIComponent(cookie.slice(COOKIE.length + 1)).split('|');
  if (!email || !sig || Number(expira) < Date.now() / 1000) return null;
  if (!acessos().has(email)) return null; // e-mail removido da lista perde o acesso na hora
  return igual(sig, await assinar(email + '|' + expira)) ? email : null;
}
