// Utilidades de texto da Fonte Clara: leitura de páginas oficiais,
// localização de artigos e comparação literal de trechos.
// Nada aqui usa IA: são as verificações determinísticas do produto.

const LATIN1 = ('nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 ' +
  'acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig ' +
  'Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave ' +
  'Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave ' +
  'iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml').split(' ');
const ENT = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', hellip: '…', bull: '•', ordm: 'º', ordf: 'ª' };
LATIN1.forEach((n, i) => { if (!(n in ENT)) ENT[n] = String.fromCharCode(160 + i); });

export function decodificarEntidades(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' ';
    }
    return e in ENT ? ENT[e] : m;
  });
}

// Decodifica os bytes de uma página. O Planalto publica em windows-1252.
export function decodificarPagina(buffer, contentType = '') {
  const bytes = new Uint8Array(buffer);
  let charset = (/charset=([\w-]+)/i.exec(contentType) || [])[1];
  if (!charset) {
    const inicio = new TextDecoder('latin1').decode(bytes.slice(0, 3000));
    charset = (/charset=["']?([\w-]+)/i.exec(inicio) || [])[1];
  }
  charset = (charset || 'windows-1252').toLowerCase();
  if (charset === 'iso-8859-1' || charset === 'latin1') charset = 'windows-1252';
  try { return new TextDecoder(charset).decode(bytes); } catch { return new TextDecoder('windows-1252').decode(bytes); }
}

// HTML -> texto corrido, uma linha por parágrafo. Remove o que está riscado
// (redações antigas que o Planalto mantém tachadas na página).
export function htmlParaTexto(html) {
  let s = String(html);
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|head|noscript)\b[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<(strike|s|del)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<(span|font|p|a)\b[^>]*line-through[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  // quebras de linha do código-fonte não são parágrafos: só as tags de bloco contam
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|tr|li|h[1-6]|table|blockquote|center|ul|ol|pre)>/gi, '\n');
  s = s.replace(/<(p|div|tr|li|h[1-6]|table|blockquote)\b[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = decodificarEntidades(s);
  s = s.replace(/\r/g, '').replace(/[ \t\f\v]+/g, ' ');
  // dentro de um parágrafo o HTML quebra linha à vontade: junta
  const linhas = s.split(/\n{1,}/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return linhas.join('\n');
}

// Chave de comparação: minúsculas, sem acento, só letras e números.
// Devolve também o mapa de posições para recuperar o trecho original.
export function chaveComMapa(s) {
  const src = String(s || '');
  let out = ''; const mapa = [];
  let espaco = true;
  for (let i = 0; i < src.length; i++) {
    let ch = src[i].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (ch === 'º' || ch === '°') ch = 'o';
    if (ch === 'ª') ch = 'a';
    for (const c of ch) {
      if (/[a-z0-9]/.test(c)) { out += c; mapa.push(i); espaco = false; }
      else if (!espaco) { out += ' '; mapa.push(i); espaco = true; }
    }
  }
  return { chave: out, mapa };
}
export const chave = s => chaveComMapa(s).chave.trim();

// O trecho citado pela IA existe literalmente no texto da fonte?
// Se sim, devolve o trecho como está na fonte (com a grafia original).
export function localizarTrecho(corpus, trecho, minimo = 20) {
  const alvo = chave(trecho);
  if (alvo.length < minimo) return null;
  const { chave: k, mapa } = chaveComMapa(corpus);
  const i = k.indexOf(alvo);
  if (i < 0) return null;
  const ini = mapa[i], fim = mapa[Math.min(i + alvo.length - 1, mapa.length - 1)] + 1;
  return String(corpus).slice(ini, fim).replace(/\s+/g, ' ').trim();
}

// Número de artigo como aparece na citação -> { num, letra }
export function lerNumeroArtigo(artigo) {
  const m = /(\d{1,2}\.\d{3}|\d{1,5})\s*[ºo°]?\s*(?:-\s*([A-Z]))?/i.exec(String(artigo || '').replace(/art(igo|s)?\.?/i, ''));
  if (!m) return null;
  return { num: parseInt(m[1].replace(/\./g, ''), 10), letra: m[2] ? m[2].toUpperCase() : '' };
}

const RE_ARTIGO = /^Art(?:igo)?\s*\.?\s*(\d{1,2}\.\d{3}|\d{1,5})\s*(?:[ºo°]|\.[ºo°]?)?\s*(?:-\s*([A-Z])\b)?/;
const RE_TITULO = /^(T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O|LIVRO|PARTE)\b/i;

// Lista os artigos de uma lei já convertida em texto.
export function indexarArtigos(texto) {
  const linhas = String(texto).split('\n');
  const inicios = [];
  linhas.forEach((l, i) => {
    const m = RE_ARTIGO.exec(l);
    if (m) inicios.push({ linha: i, num: parseInt(m[1].replace(/\./g, ''), 10), letra: m[2] || '' });
  });
  return { linhas, inicios };
}

// Extrai o texto de um artigo. Devolve { texto, revogado, vetado, maiorArtigo, total }.
export function extrairArtigo(texto, artigo, limite = 6000) {
  const alvo = typeof artigo === 'object' && artigo ? artigo : lerNumeroArtigo(artigo);
  const { linhas, inicios } = indexarArtigos(texto);
  const maiorArtigo = inicios.reduce((m, a) => Math.max(m, a.num), 0);
  const base = { texto: '', revogado: false, vetado: false, maiorArtigo, total: inicios.length };
  if (!alvo || !inicios.length) return base;
  const blocos = [];
  inicios.forEach((a, k) => {
    if (a.num !== alvo.num || a.letra !== alvo.letra) return;
    const fim = k + 1 < inicios.length ? inicios[k + 1].linha : Math.min(linhas.length, a.linha + 60);
    const bloco = linhas.slice(a.linha, fim);
    while (bloco.length > 1 && RE_TITULO.test(bloco[bloco.length - 1])) bloco.pop();
    // tira títulos de capítulo/seção que ficam no fim do bloco
    while (bloco.length > 1 && bloco[bloco.length - 1].length < 90 && /^[A-ZÀ-Ú][^.;:]*$/.test(bloco[bloco.length - 1]) && !/^(§|Par[áa]grafo|[IVXLC]+\s*[-–])/.test(bloco[bloco.length - 1])) bloco.pop();
    blocos.push(bloco.join('\n'));
  });
  if (!blocos.length) return base;
  // se a página traz mais de uma redação, a vigente é a última
  let t = blocos[blocos.length - 1];
  const corpo = t.replace(RE_ARTIGO, '').replace(/^[\s.\-–]+/, '');
  base.revogado = /^\(?\s*revogad[oa]/i.test(corpo);
  base.vetado = /^\(?\s*vetad[oa]/i.test(corpo);
  if (t.length > limite) t = t.slice(0, limite) + ' […]';
  base.texto = t;
  return base;
}

// Quando o artigo é muito longo, recorta em volta do inciso ou parágrafo citado.
export function recortarDispositivo(textoArtigo, complemento, limite = 3500) {
  if (textoArtigo.length <= limite) return textoArtigo;
  const linhas = textoArtigo.split('\n');
  const c = String(complemento || '');
  let alvo = -1;
  const inciso = /inc(?:iso)?\.?\s*([IVXLCDM]+)\b/i.exec(c) || /,\s*([IVXLCDM]{1,8})\b/.exec(c);
  const par = /§\s*(\d+)|par[áa]grafo\s+(\d+|[úu]nico)/i.exec(c);
  if (inciso) alvo = linhas.findIndex(l => new RegExp('^' + inciso[1].toUpperCase() + '\\s*[-–—]').test(l));
  if (alvo < 0 && par) {
    const n = par[1] || par[2];
    alvo = /nico/i.test(n) ? linhas.findIndex(l => /^Par[áa]grafo [úu]nico/i.test(l)) : linhas.findIndex(l => new RegExp('^§\\s*' + n + '\\b').test(l));
  }
  const caput = linhas[0];
  if (alvo < 1) return textoArtigo.slice(0, limite) + ' […]';
  const janela = linhas.slice(Math.max(1, alvo - 1), alvo + 6).join('\n');
  return (caput + '\n[…]\n' + janela).slice(0, limite);
}

// "1.987.654" e "1987654" devem bater: compara só os dígitos.
export function contemNumero(corpus, numero) {
  const alvo = String(numero || '').replace(/\D/g, '');
  if (alvo.length < 2) return false;
  const digitos = String(corpus).replace(/(\d)[.\s](?=\d{3}(\D|$))/g, '$1');
  return new RegExp('(^|\\D)' + alvo + '(\\D|$)').test(digitos);
}

export function janelaEmVolta(corpus, numero, antes = 80, depois = 420) {
  const alvo = String(numero || '').replace(/\D/g, '');
  const txt = String(corpus);
  const re = new RegExp(alvo.split('').join('[.\\s]?'));
  const m = re.exec(txt);
  if (!m) return '';
  return txt.slice(Math.max(0, m.index - antes), m.index + depois).replace(/\s+/g, ' ').trim();
}

export function jsonLeniente(s) {
  const t = String(s || '').trim();
  try { return JSON.parse(t); } catch {}
  const semCerca = t.replace(/```(?:json)?/gi, '');
  const i = semCerca.indexOf('{'), j = semCerca.lastIndexOf('}');
  if (i >= 0 && j > i) { try { return JSON.parse(semCerca.slice(i, j + 1)); } catch {} }
  return null;
}

export const cortar = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
