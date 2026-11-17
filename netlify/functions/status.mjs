// GET /api/status  ->  diagnóstico: a chave está configurada? a IA responde? o Planalto abre?
import { conversar, modelo } from '../lib/groq.mjs';
import { abrirPagina } from '../lib/motor.mjs';
import { json } from '../lib/http.mjs';

export default async () => {
  const saida = { chave: !!process.env.GROQ_API_KEY, modelo: modelo(), ia: { ok: false }, planalto: { ok: false } };
  const base = (process.env.PLANALTO_BASE || 'https://www.planalto.gov.br');
  const [ia, pl] = await Promise.allSettled([
    saida.chave ? conversar({ mensagens: [{ role: 'user', content: 'Responda apenas: ok' }], maxTokens: 20, tempoMs: 12000 }) : Promise.reject({ codigo: 'sem_chave', message: 'Chave não configurada.' }),
    abrirPagina(base + '/ccivil_03/leis/l8078compilado.htm', 9000),
  ]);
  if (ia.status === 'fulfilled') saida.ia = { ok: true };
  else saida.ia = { ok: false, erro: ia.reason?.codigo || 'erro', mensagem: ia.reason?.message || '', detalhe: ia.reason?.detalhe };
  if (pl.status === 'fulfilled') saida.planalto = { ok: !!pl.value.ok, status: pl.value.status, bloqueado: !!pl.value.bloqueado };
  return json(saida);
};

export const config = { path: '/api/status' };
