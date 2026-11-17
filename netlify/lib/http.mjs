// Respostas e proteções comuns às funções.
import { ErroIA } from './groq.mjs';

export const json = (dados, status = 200) => new Response(JSON.stringify(dados), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// Só aceita chamadas vindas do próprio site.
export function mesmaOrigem(req) {
  const origem = req.headers.get('origin');
  if (!origem) return true;
  try { return new URL(origem).host === new URL(req.url).host || new URL(origem).host === req.headers.get('host'); } catch { return false; }
}

export async function lerCorpo(req, limite = 40000) {
  const bruto = await req.text();
  if (bruto.length > limite) throw new ErroIA('entrada', 'Texto grande demais para uma única chamada.');
  try { return JSON.parse(bruto || '{}'); } catch { throw new ErroIA('entrada', 'Corpo da requisição inválido.'); }
}

export function responderErro(e) {
  if (e instanceof ErroIA) {
    const status = { limite: 429, sem_chave: 503, chave_invalida: 503, modelo: 503, entrada: 400, tempo: 504 }[e.codigo] || 502;
    return json({ erro: e.codigo, mensagem: e.message, aguardar: e.aguardar || undefined, detalhe: e.detalhe || undefined }, status);
  }
  console.error(e);
  return json({ erro: 'interno', mensagem: 'Erro inesperado no servidor.' }, 500);
}
