// POST /api/conferir  { citacao, pularDireto }  ->  { resultado }
// Etapa "Consulta": confere uma citação na fonte oficial e classifica.
import { conferirCitacao } from '../lib/motor.mjs';
import { json, lerCorpo, mesmaOrigem, responderErro } from '../lib/http.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
  if (!mesmaOrigem(req)) return json({ erro: 'origem' }, 403);
  try {
    const { citacao, pularDireto } = await lerCorpo(req, 6000);
    return json({ resultado: await conferirCitacao(citacao, { pularDireto: !!pularDireto }) });
  } catch (e) { return responderErro(e); }
};

export const config = { path: '/api/conferir' };
