// Chamado todo dia pelo cron da Vercel (vercel.json). O Supabase gratuito pausa projetos sem uso
// por 7 dias; com ele pausado, as versões enviadas pelo painel saem do ar.
import { pingar, supabaseConfigurado } from '../lib/supabase.js';

export async function GET(request) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && request.headers.get('authorization') !== `Bearer ${segredo}`) return new Response('não autorizado', { status: 401 });
  if (!supabaseConfigurado()) return new Response('Supabase não configurado', { status: 503 });
  await pingar();
  return new Response('ok', { headers: { 'Cache-Control': 'no-store' } });
}
