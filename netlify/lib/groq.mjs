// Chamada à IA (Groq). A chave fica só no servidor, na variável GROQ_API_KEY.
const BASE = () => process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
export const modelo = () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

export class ErroIA extends Error {
  constructor(codigo, mensagem, extra = {}) { super(mensagem || codigo); this.codigo = codigo; Object.assign(this, extra); }
}

// json: resposta em objeto JSON. busca: liga a busca na web embutida do modelo.
export async function conversar({ mensagens, json = false, busca = false, maxTokens = 1500, tempoMs = 30000 }) {
  const chaveApi = process.env.GROQ_API_KEY;
  if (!chaveApi) throw new ErroIA('sem_chave', 'A chave do Groq não está configurada no servidor.');
  const corpo = {
    model: modelo(), messages: mensagens, stream: false,
    temperature: busca ? 0.3 : 0, max_completion_tokens: maxTokens, reasoning_effort: 'low',
  };
  if (json) corpo.response_format = { type: 'json_object' };
  if (busca) { corpo.tools = [{ type: 'browser_search' }]; corpo.tool_choice = 'required'; }

  let resp;
  try {
    resp = await fetch(BASE() + '/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(tempoMs),
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + chaveApi },
      body: JSON.stringify(corpo),
    });
  } catch (e) {
    throw new ErroIA(e.name === 'TimeoutError' ? 'tempo' : 'rede', 'Não consegui falar com o Groq: ' + (e.message || e.name));
  }
  if (!resp.ok) {
    let detalhe = '';
    try { const j = await resp.json(); detalhe = j?.error?.message || JSON.stringify(j).slice(0, 300); } catch { detalhe = (await resp.text().catch(() => '')).slice(0, 300); }
    if (resp.status === 429) {
      const espera = parseFloat(resp.headers.get('retry-after')) || (/try again in ([\d.]+)s/i.exec(detalhe) || [])[1] * 1 || 20;
      throw new ErroIA('limite', 'Limite de uso do Groq atingido.', { aguardar: Math.min(Math.ceil(espera) + 1, 90), detalhe });
    }
    if (resp.status === 401 || resp.status === 403) throw new ErroIA('chave_invalida', 'O Groq recusou a chave configurada.', { detalhe });
    if (resp.status === 404 || /decommission|does not exist|not found/i.test(detalhe)) throw new ErroIA('modelo', `O modelo "${modelo()}" não está disponível no Groq.`, { detalhe });
    throw new ErroIA('ia', `O Groq respondeu com erro ${resp.status}.`, { detalhe });
  }
  const dados = await resp.json();
  const msg = dados?.choices?.[0]?.message || {};
  return { texto: msg.content || '', ferramentas: Array.isArray(msg.executed_tools) ? msg.executed_tools : [], uso: dados.usage || null };
}

// Junta o que a busca realmente leu nas páginas (não o que o modelo escreveu depois).
export function textoDasFerramentas(ferramentas) {
  const partes = [];
  const visita = v => {
    if (v == null) return;
    if (typeof v === 'string') { if (v.length > 30) partes.push(v); return; }
    if (Array.isArray(v)) { v.forEach(visita); return; }
    if (typeof v === 'object') for (const k of Object.keys(v)) { if (k !== 'arguments') visita(v[k]); }
  };
  for (const f of ferramentas || []) { visita(f.output); visita(f.search_results); visita(f.results); }
  return partes.join('\n\n').slice(0, 200000);
}
