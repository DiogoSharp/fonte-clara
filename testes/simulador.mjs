// Simulador para testes: imita o Groq e o Planalto, sem internet e sem chave.
// As respostas são fixas e existem só para exercitar o código. Não são fonte de nada.
import http from 'node:http';
import { readFileSync } from 'node:fs';

const fx = n => readFileSync(new URL('./fixtures/' + n, import.meta.url));
export const estado = { planaltoBloqueado: process.env.SIMULADOR_BLOQUEIO === '1', limite: Number(process.env.SIMULADOR_LIMITE || 0), chamadas: [] };

const SUM385 = 'Da anotação irregular em cadastro de proteção ao crédito, não cabe indenização por dano moral, quando preexistente legítima inscrição, ressalvado o direito ao cancelamento.';
const CDC42 = 'Parágrafo único. O consumidor cobrado em quantia indevida tem direito à repetição do indébito, por valor igual ao dobro do que pagou em excesso, acrescido de correção monetária e juros legais, salvo hipótese de engano justificável.';

function extrair(peca) {
  const todas = [
    { referencia: 'art. 186 do Código Civil', rotulo: 'Art. 186 do Código Civil', tipo: 'lei', norma: 'Código Civil', artigo: '186', afirmacao: 'Define o ato ilícito.', trecho: 'Configurado o ato ilícito, nos termos do art. 186 do Código Civil' },
    { referencia: 'art. 927 do Código Civil', rotulo: 'Art. 927 do Código Civil', tipo: 'lei', norma: 'Código Civil', artigo: '927', afirmacao: 'Impõe a devolução em dobro dos valores cobrados.', trecho: 'impõe-se a devolução em dobro dos valores, conforme o art. 927 do Código Civil' },
    { referencia: 'art. 42, parágrafo único, do CDC', rotulo: 'Art. 42, parágrafo único, do CDC', tipo: 'lei', norma: 'CDC', artigo: '42', complemento: 'parágrafo único', afirmacao: 'Garante a repetição do indébito em dobro ao consumidor cobrado indevidamente.', trecho: 'art. 42, parágrafo único, do CDC' },
    { referencia: 'Súmula 385 do STJ', rotulo: 'Súmula 385 do STJ', tipo: 'sumula', tribunal: 'STJ', numero: '385', afirmacao: 'Não cabe dano moral quando há inscrição legítima preexistente.', trecho: 'Súmula 385 do STJ' },
    { referencia: 'REsp 1.987.654/SP', rotulo: 'REsp 1.987.654/SP', tipo: 'decisao', tribunal: 'STJ', classe: 'REsp', numero: '1.987.654', uf: 'SP', afirmacao: 'Reconheceu o dano moral presumido.', trecho: 'REsp 1.987.654/SP' },
    { referencia: 'art. 3.500 do Código Civil', rotulo: 'Art. 3.500 do Código Civil', tipo: 'lei', norma: 'Código Civil', artigo: '3.500', afirmacao: 'Prevê multa.', trecho: 'art. 3.500 do Código Civil' },
    { referencia: 'art. 500 do Código Civil', rotulo: 'Art. 500 do Código Civil', tipo: 'lei', norma: 'Código Civil', artigo: '500', afirmacao: 'Trata da venda ad mensuram.', trecho: 'art. 500 do Código Civil' },
    { referencia: 'Súmula 603 do STJ', rotulo: 'Súmula 603 do STJ', tipo: 'sumula', tribunal: 'STJ', numero: '603', afirmacao: 'Veda a retenção de salário pelo banco.', trecho: 'Súmula 603 do STJ' },
    { referencia: 'Responsabilidade Civil, p. 112', rotulo: 'TARTUCE, Responsabilidade Civil', tipo: 'doutrina', obra: 'Flávio Tartuce, Responsabilidade Civil', afirmacao: 'Defende a função punitiva.', trecho: 'TARTUCE, Flávio. Responsabilidade Civil, p. 112' },
    { referencia: 'art. 14 do Código de Defesa do Consumidor', rotulo: 'Art. 14 do CDC', tipo: 'lei', norma: 'Código de Defesa do Consumidor', artigo: '14', afirmacao: 'O fornecedor de serviços responde independentemente de culpa pelos danos causados.', trecho: 'o fornecedor de serviços responde independentemente de culpa pelos danos causados, como prevê o art. 14 do Código de Defesa do Consumidor' },
    { referencia: 'REsp 9.876.543/SP', rotulo: 'REsp 9.876.543/SP', tipo: 'decisao', tribunal: 'STJ', classe: 'REsp', numero: '9.876.543', uf: 'SP', afirmacao: 'Decidiu que o dano moral é presumido.', trecho: 'O dano moral, na hipótese, é presumido, como decidiu o Superior Tribunal de Justiça no REsp 9.876.543/SP.' },
    { referencia: 'SILVA, João. Responsabilidade Civil nas Relações Bancárias', rotulo: 'SILVA, Responsabilidade Civil nas Relações Bancárias', tipo: 'doutrina', obra: 'João Silva, Responsabilidade Civil nas Relações Bancárias', afirmacao: 'Defende que o dano moral é presumido.', trecho: 'Na doutrina, a mesma conclusão é defendida por SILVA, João. Responsabilidade Civil nas Relações Bancárias. 3. ed.' },
    // citação que a IA "inventa" e que não está na peça: o servidor precisa descartar
    { referencia: 'art. 77 da Lei 55.555/2099', rotulo: 'Art. 77 da Lei 55.555/2099', tipo: 'lei', norma: 'Lei 55.555/2099', artigo: '77', afirmacao: '', trecho: '' },
  ];
  const baixo = peca.toLowerCase();
  return todas.filter(c => c.rotulo.includes('55.555') || baixo.includes(c.referencia.toLowerCase().slice(0, 14)));
}

function julgar(u) {
  if (/MENTE_TRECHO/.test(u)) return { status: 'confirmada', justificativa: 'Confere.', trecho_fonte: 'o devedor pagará em dobro tudo aquilo que foi cobrado indevidamente pelo credor' };
  if (/Art\. 927/.test(u) && /dobro/i.test(u)) return { status: 'divergente', justificativa: 'O artigo trata do dever de reparar o dano e não prevê devolução em dobro.', trecho_fonte: 'causar dano a outrem, fica obrigado a repará-lo' };
  if (/Art\. 14 /.test(u)) return { status: 'confirmada', justificativa: 'O artigo prevê a responsabilidade do fornecedor de serviços sem necessidade de culpa.', trecho_fonte: 'responde, independentemente da existência de culpa, pela reparação dos danos causados aos consumidores' };
  if (/Art\. 42/.test(u)) return { status: 'confirmada', justificativa: 'O parágrafo único prevê a repetição do indébito em dobro.', trecho_fonte: 'tem direito à repetição do indébito, por valor igual ao dobro do que pagou em excesso' };
  if (/Art\. 186/.test(u)) return { status: 'confirmada', justificativa: 'O artigo define o ato ilícito, como a peça afirma.', trecho_fonte: 'violar direito e causar dano a outrem, ainda que exclusivamente moral, comete ato ilícito' };
  return { status: 'divergente', justificativa: 'O texto não sustenta a afirmação.', trecho_fonte: '' };
}

function buscar(u) {
  const ferr = (q, saida) => [{ index: 0, type: 'browser.search', arguments: JSON.stringify({ query: q }), output: saida }];
  if (/385/.test(u)) return { ferramentas: ferr('Súmula 385 STJ', '[0] STJ - Súmula 385 (https://scon.stj.jus.br/SCON/sumstj/toc.jsp?sumula=385)\nSÚMULA N. 385\n' + SUM385 + '\n(Súmula 385, SEGUNDA SEÇÃO, julgado em 27/05/2009)'),
    j: { encontrada: true, url: 'https://scon.stj.jus.br/SCON/sumstj/toc.jsp?sumula=385', nome_fonte: 'STJ, Súmula 385', trecho_fonte: 'não cabe indenização por dano moral, quando preexistente legítima inscrição', status: 'confirmada', situacao: 'vigente', justificativa: 'A súmula diz que não cabe dano moral quando já existe inscrição legítima.' } };
  if (/603/.test(u)) return { ferramentas: ferr('Súmula 603 STJ', 'SÚMULA N. 603 (CANCELADA) É vedado ao banco mutuante reter, em qualquer extensão, os salários, vencimentos e/ou proventos de correntista para adimplir o mútuo comum contraído.'),
    j: { encontrada: true, url: 'https://scon.stj.jus.br/SCON/sumstj/toc.jsp?sumula=603', nome_fonte: 'STJ, Súmula 603', trecho_fonte: 'É vedado ao banco mutuante reter, em qualquer extensão, os salários', status: 'confirmada', situacao: 'cancelada', justificativa: 'A súmula dizia isso, mas foi cancelada.' } };
  if (/999/.test(u)) return { ferramentas: ferr('Súmula 999 STJ', 'Resultados sobre outro assunto, sem relação com o número pedido.'),
    j: { encontrada: true, url: 'https://scon.stj.jus.br/SCON/sumstj/toc.jsp?sumula=999', nome_fonte: 'STJ, Súmula 999', trecho_fonte: 'É devida indenização em dobro sempre que houver cobrança por telefone em horário comercial', status: 'confirmada', situacao: 'vigente', justificativa: 'A súmula confirma.' } };
  if (/1\.?061/.test(u)) return { ferramentas: ferr('Tema 1061 STJ', 'Tema 1061 do STJ: comentários de um site privado sobre o tema 1061.'),
    j: { encontrada: true, url: 'https://www.jusbrasil.com.br/artigos/tema-1061', nome_fonte: 'Jusbrasil', trecho_fonte: 'comentários de um site privado sobre o tema 1061', status: 'confirmada', situacao: 'vigente', justificativa: 'Encontrado.' } };
  if (/artigo 42/.test(u)) return { ferramentas: ferr('art. 42 CDC planalto', 'L8078compilado (https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm)\nArt. 42. Na cobrança de débitos, o consumidor inadimplente não será exposto a ridículo.\n' + CDC42),
    j: { encontrada: true, url: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm', nome_fonte: 'Planalto, CDC', trecho_fonte: 'tem direito à repetição do indébito, por valor igual ao dobro do que pagou em excesso', status: 'confirmada', situacao: 'vigente', justificativa: 'O parágrafo único prevê a devolução em dobro.' } };
  return { ferramentas: ferr('busca', 'Nenhum resultado em sites oficiais para o número pedido.'),
    j: { encontrada: false, url: '', nome_fonte: '', trecho_fonte: '', status: 'nao_localizada', situacao: 'desconhecida', justificativa: 'Não encontrei essa referência, com esse número, nas bases públicas pesquisadas.' } };
}

export function iniciar(porta = 0) {
  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/ccivil_03/')) {
      if (estado.planaltoBloqueado) { res.writeHead(403, { 'content-type': 'text/html' }); return res.end('<html><body><h1>Acesso Negado!</h1></body></html>'); }
      const p = url.pathname.toLowerCase();
      const arq = p.endsWith('leis/2002/l10406compilada.htm') ? 'planalto-cc.htm' : p.endsWith('leis/l8078compilado.htm') ? 'planalto-cdc.htm' : null;
      if (!arq) { res.writeHead(404); return res.end('nao encontrado'); }
      res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fx(arq));
    }
    if (url.pathname.endsWith('/chat/completions')) {
      let corpo = ''; for await (const c of req) corpo += c;
      const b = JSON.parse(corpo);
      estado.chamadas.push(b);
      if (estado.limite > 0) { estado.limite--; res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '1' }); return res.end(JSON.stringify({ error: { message: 'Rate limit reached. Please try again in 1s.' } })); }
      const sis = b.messages.find(m => m.role === 'system')?.content || '';
      const usr = b.messages.filter(m => m.role === 'user').map(m => m.content).join('\n');
      let message;
      if (b.tools) { const r = buscar(usr); message = { role: 'assistant', content: 'Encontrei o seguinte.\n```json\n' + JSON.stringify(r.j) + '\n```', executed_tools: r.ferramentas }; }
      else if (/lista as fontes/.test(sis)) message = { role: 'assistant', content: JSON.stringify({ citacoes: extrair(usr) }) };
      else if (/TEXTO OFICIAL/.test(sis)) message = { role: 'assistant', content: JSON.stringify(julgar(usr)) };
      else message = { role: 'assistant', content: 'ok' };
      await new Promise(r => setTimeout(r, Number(process.env.SIMULADOR_ATRASO || 0)));
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ choices: [{ message }], usage: { total_tokens: 1 } }));
    }
    res.writeHead(404); res.end();
  });
  return new Promise(ok => srv.listen(porta, '127.0.0.1', () => ok({ srv, porta: srv.address().port })));
}
