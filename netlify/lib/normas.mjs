// De "Código Civil" ou "Lei 8.078/1990" para o endereço da lei no Planalto.
// A tabela cobre as normas mais citadas; para as demais, o endereço é montado
// pelo número e pelo ano. Se nenhum endereço abrir, a conferência segue pela busca.
import { chave } from './texto.mjs';

const P = (process.env.PLANALTO_BASE || 'https://www.planalto.gov.br') + '/ccivil_03/';

// [nome, número da norma (ou ''), apelidos (regex sobre a chave), caminhos no Planalto]
const TABELA = [
  ['Constituição Federal', '', /\b(constituicao( federal| da republica)?|cf|cf 88|cf 1988|crfb|carta magna)\b/, ['constituicao/constituicaocompilado.htm', 'constituicao/constituicao.htm']],
  ['Código Civil', '10406', /\b(codigo civil|cc|cc 2002|cc 02)\b/, ['leis/2002/l10406compilada.htm', 'leis/2002/l10406.htm']],
  ['Código de Processo Civil', '13105', /\b(codigo de processo civil|cpc|cpc 2015|cpc 15|ncpc)\b/, ['_ato2015-2018/2015/lei/l13105.htm']],
  ['Código de Defesa do Consumidor', '8078', /\b(codigo de defesa do consumidor|codigo do consumidor|cdc)\b/, ['leis/l8078compilado.htm', 'leis/l8078.htm']],
  ['Código Penal', '2848', /\b(codigo penal|cp)\b/, ['decreto-lei/del2848compilado.htm', 'decreto-lei/del2848.htm']],
  ['Código de Processo Penal', '3689', /\b(codigo de processo penal|cpp)\b/, ['decreto-lei/del3689compilado.htm', 'decreto-lei/del3689.htm']],
  ['Consolidação das Leis do Trabalho', '5452', /\b(consolidacao das leis do trabalho|clt)\b/, ['decreto-lei/del5452compilado.htm', 'decreto-lei/del5452.htm']],
  ['Código Tributário Nacional', '5172', /\b(codigo tributario nacional|ctn)\b/, ['leis/l5172compilado.htm', 'leis/l5172.htm']],
  ['Estatuto da Criança e do Adolescente', '8069', /\b(estatuto da crianca e do adolescente|eca)\b/, ['leis/l8069.htm']],
  ['Lei de Introdução às Normas do Direito Brasileiro', '4657', /\b(lei de introducao as normas do direito brasileiro|lindb|licc)\b/, ['decreto-lei/del4657compilado.htm', 'decreto-lei/del4657.htm']],
  ['Lei Geral de Proteção de Dados', '13709', /\b(lei geral de protecao de dados( pessoais)?|lgpd)\b/, ['_ato2015-2018/2018/lei/l13709compilado.htm', '_ato2015-2018/2018/lei/l13709.htm']],
  ['Marco Civil da Internet', '12965', /\b(marco civil( da internet)?)\b/, ['_ato2011-2014/2014/lei/l12965.htm']],
  ['Lei dos Juizados Especiais', '9099', /\b(lei dos juizados especiais)\b/, ['leis/l9099.htm']],
  ['Lei do Inquilinato', '8245', /\b(lei do inquilinato|lei de locacoes)\b/, ['leis/l8245.htm']],
  ['Lei das Sociedades por Ações', '6404', /\b(lei das (sociedades por acoes|s a|sa)|lsa)\b/, ['leis/l6404consol.htm', 'leis/l6404compilada.htm']],
  ['Lei de Recuperação e Falências', '11101', /\b(lei de (recuperacao( judicial)?( e falencias?)?|falencias))\b/, ['_ato2004-2006/2005/lei/l11101.htm']],
  ['Lei de Licitações (14.133)', '14133', /\b(nova lei de licitacoes)\b/, ['_ato2019-2022/2021/lei/l14133.htm']],
  ['Lei de Licitações (8.666)', '8666', /\b(lei de licitacoes)\b/, ['leis/l8666cons.htm']],
  ['Lei 8.112 (servidores federais)', '8112', /\b(estatuto dos servidores( publicos)?( federais)?)\b/, ['leis/l8112cons.htm']],
  ['Lei do Mandado de Segurança', '12016', /\b(lei do mandado de seguranca)\b/, ['_ato2007-2010/2009/lei/l12016.htm']],
  ['Lei de Arbitragem', '9307', /\b(lei de arbitragem)\b/, ['leis/l9307.htm']],
  ['Lei de Improbidade Administrativa', '8429', /\b(lei de improbidade( administrativa)?|lia)\b/, ['leis/l8429.htm']],
  ['Lei da Ação Civil Pública', '7347', /\b(lei da acao civil publica|lacp)\b/, ['leis/l7347orig.htm', 'leis/l7347compilada.htm']],
  ['Lei do Processo Administrativo Federal', '9784', /\b(lei do processo administrativo)\b/, ['leis/l9784.htm']],
  ['Estatuto da Pessoa Idosa', '10741', /\b(estatuto (do idoso|da pessoa idosa))\b/, ['leis/2003/l10.741.htm']],
  ['Estatuto da Pessoa com Deficiência', '13146', /\b(estatuto da pessoa com deficiencia|lei brasileira de inclusao|lbi)\b/, ['_ato2015-2018/2015/lei/l13146.htm']],
  ['Lei de Propriedade Industrial', '9279', /\b(lei d[ae] propriedade industrial|lpi)\b/, ['leis/l9279.htm']],
  ['Lei de Direitos Autorais', '9610', /\b(lei d[eo]s? direitos? autora(l|is)|lda)\b/, ['leis/l9610.htm']],
  ['Código de Trânsito Brasileiro', '9503', /\b(codigo de transito( brasileiro)?|ctb)\b/, ['leis/l9503compilado.htm', 'leis/l9503.htm']],
  ['Lei de Benefícios da Previdência', '8213', /\b(lei de beneficios( da previdencia( social)?)?)\b/, ['leis/l8213cons.htm']],
  ['Estatuto da Advocacia', '8906', /\b(estatuto da (advocacia|oab)|eoab)\b/, ['leis/l8906.htm']],
  ['Lei da Liberdade Econômica', '13874', /\b(lei d[ae] liberdade economica)\b/, ['_ato2019-2022/2019/lei/l13874.htm']],
  ['Lei de Mediação', '13140', /\b(lei d[ae] mediacao)\b/, ['_ato2015-2018/2015/lei/l13140.htm']],
  ['Lei Maria da Penha', '11340', /\b(lei maria da penha)\b/, ['_ato2004-2006/2006/lei/l11340.htm']],
  ['Lei de Execução Penal', '7210', /\b(lei de execucao penal|lep)\b/, ['leis/l7210.htm']],
  ['Lei de Execução Fiscal', '6830', /\b(lei de execucao fiscal|lef)\b/, ['leis/l6830.htm']],
  ['Lei Anticorrupção', '12846', /\b(lei anticorrupcao)\b/, ['_ato2011-2014/2013/lei/l12846.htm']],
  ['Lei de Acesso à Informação', '12527', /\b(lei de acesso a informacao|lai)\b/, ['_ato2011-2014/2011/lei/l12527.htm']],
];

function faixa(ano) {
  if (ano >= 2023) return '_ato2023-2026';
  if (ano >= 2019) return '_ato2019-2022';
  if (ano >= 2015) return '_ato2015-2018';
  if (ano >= 2011) return '_ato2011-2014';
  if (ano >= 2007) return '_ato2007-2010';
  if (ano >= 2004) return '_ato2004-2006';
  return '';
}

function anoCompleto(a) {
  let n = parseInt(a, 10);
  if (!Number.isFinite(n)) return 0;
  if (n < 100) n += n > 30 ? 1900 : 2000;
  return n;
}

// Lê "Lei nº 8.078/1990", "LC 123/2006", "Decreto-Lei 201/67", "Lei 9.099, de 26 de setembro de 1995"
export function lerNumeroNorma(s) {
  const k = chave(s);
  const m = /\b(lei complementar|lc|decreto lei|dl|medida provisoria|mp|lei|decreto)\s*(?:federal\s*)?(?:n|no|numero|nr)?\s*(\d{1,2}\s\d{3}|\d{1,5})(?:\s*(?:de|do)?\s*(?:\d{1,2}\s*(?:de)?\s*[a-z]+\s*(?:de)?\s*)?((?:19|20)\d{2}|\d{2})\b)?/.exec(k);
  if (!m) return null;
  let especie = m[1];
  especie = /complementar|^lc$/.test(especie) ? 'lcp' : /decreto lei|^dl$/.test(especie) ? 'del' : /provisoria|^mp$/.test(especie) ? 'mpv' : especie === 'decreto' ? 'dec' : 'lei';
  return { especie, numero: m[2].replace(/\s/g, ''), ano: m[3] ? anoCompleto(m[3]) : 0 };
}

function caminhosPorNumero({ especie, numero, ano }) {
  const n = numero;
  if (especie === 'lcp') return [`leis/lcp/lcp${n}.htm`];
  if (especie === 'del') return [`decreto-lei/del${n}compilado.htm`, `decreto-lei/del${n}.htm`];
  if (especie === 'lei') {
    const out = [];
    const f = faixa(ano);
    if (f) out.push(`${f}/${ano}/lei/l${n}.htm`, `${f}/${ano}/lei/l${n}compilado.htm`);
    else if (ano === 2003) out.push(`leis/2003/l${n.slice(0, 2)}.${n.slice(2)}.htm`, `leis/2003/l${n}.htm`);
    else if (ano === 2002) out.push(`leis/2002/l${n}.htm`, `leis/2002/l${n}compilada.htm`);
    else if (ano === 2001) out.push(`leis/leis_2001/l${n}.htm`, `leis/l${n}.htm`);
    else out.push(`leis/l${n}.htm`, `leis/l${n}compilado.htm`, `leis/l${n}cons.htm`);
    return out;
  }
  return [];
}

// Devolve { nome, urls } ou null quando não há endereço conhecido.
export function resolverNorma(norma, referencia = '') {
  const k = ' ' + chave(norma) + ' ';
  const lido = lerNumeroNorma(norma) || lerNumeroNorma(referencia);
  if (lido) {
    const daTabela = TABELA.find(t => t[1] === lido.numero);
    if (daTabela && (lido.especie === 'lei' || lido.especie === 'del')) return { nome: daTabela[0], urls: daTabela[3].map(c => P + c) };
    const urls = caminhosPorNumero(lido).map(c => P + c);
    if (urls.length) {
      const rot = { lei: 'Lei', lcp: 'Lei Complementar', del: 'Decreto-Lei' }[lido.especie] || 'Norma';
      return { nome: `${rot} ${Number(lido.numero).toLocaleString('pt-BR')}${lido.ano ? '/' + lido.ano : ''}`, urls };
    }
    return null;
  }
  const t = TABELA.find(t => t[2].test(k));
  return t ? { nome: t[0], urls: t[3].map(c => P + c) } : null;
}

export const OFICIAIS = /(^|\.)(jus\.br|gov\.br|leg\.br|mp\.br|def\.br)$/i;
export function ehFonteOficial(url) {
  try { return OFICIAIS.test(new URL(url).hostname); } catch { return false; }
}

// Link para o advogado repetir a busca à mão no tribunal.
export function pesquisaManual(c) {
  const trib = chave(c.tribunal || c.referencia || '');
  const termo = [c.classe, c.numero].filter(Boolean).join(' ') || c.referencia || '';
  const q = encodeURIComponent(termo.trim());
  if (c.tipo === 'sumula') {
    const n = encodeURIComponent('súmula ' + (c.numero || ''));
    if (/\bstf\b|supremo/.test(trib)) return { rotulo: 'Pesquisar no STF', url: 'https://jurisprudencia.stf.jus.br/pages/search?base=sumulas&queryString=' + n };
    if (/\bstj\b|superior tribunal de justica/.test(trib)) return { rotulo: 'Pesquisar no STJ', url: 'https://scon.stj.jus.br/SCON/pesquisar.jsp?b=SUMU&livre=' + encodeURIComponent(c.numero || '') };
    return null;
  }
  if (/\bstf\b|supremo/.test(trib) || /^(re|are|adi|adpf|adc|hc|rhc|ms|rcl)\b/.test(chave(c.classe))) {
    if (/\bstj\b/.test(trib)) return { rotulo: 'Pesquisar no STJ', url: 'https://scon.stj.jus.br/SCON/pesquisar.jsp?b=ACOR&livre=' + q };
    return { rotulo: 'Pesquisar no STF', url: 'https://jurisprudencia.stf.jus.br/pages/search?base=acordaos&queryString=' + q };
  }
  if (/\bstj\b|superior tribunal de justica/.test(trib) || /^(resp|aresp|agint|agrg|eresp|rms)\b/.test(chave(c.classe))) return { rotulo: 'Pesquisar no STJ', url: 'https://scon.stj.jus.br/SCON/pesquisar.jsp?b=ACOR&livre=' + q };
  if (/\btst\b/.test(trib)) return { rotulo: 'Pesquisar no TST', url: 'https://jurisprudencia.tst.jus.br/' };
  return null;
}
