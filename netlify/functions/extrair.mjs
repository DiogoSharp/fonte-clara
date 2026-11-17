// POST /api/extrair  { texto }  ->  { citacoes: [...] }
// Etapa "Leitura": localiza as citações de um trecho da peça.
import { extrairCitacoes } from '../lib/motor.mjs';
import { json, lerCorpo, mesmaOrigem, responderErro } from '../lib/http.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
  if (!mesmaOrigem(req)) return json({ erro: 'origem' }, 403);
  try {
    const { texto } = await lerCorpo(req);
    if (typeof texto !== 'string' || texto.trim().length < 20) return json({ citacoes: [] });
    if (texto.length > 9000) return json({ erro: 'entrada', mensagem: 'Envie no máximo 9.000 caracteres por chamada.' }, 400);
    return json({ citacoes: await extrairCitacoes(texto) });
  } catch (e) { return responderErro(e); }
};

export const config = { path: '/api/extrair' };
