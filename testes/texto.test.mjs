import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodificarPagina, htmlParaTexto, extrairArtigo, localizarTrecho, contemNumero, lerNumeroArtigo, jsonLeniente, recortarDispositivo, chave } from '../netlify/lib/texto.mjs';
import { resolverNorma, lerNumeroNorma, ehFonteOficial, pesquisaManual } from '../netlify/lib/normas.mjs';

const cc = htmlParaTexto(decodificarPagina(readFileSync(new URL('./fixtures/planalto-cc.htm', import.meta.url))));

test('decodifica windows-1252 e entidades', () => {
  assert.match(cc, /Institui o Código Civil\./);
  assert.match(cc, /Toda pessoa é capaz/);
  assert.ok(!cc.includes('&'), 'sobrou entidade');
  assert.ok(!/margin:0/.test(cc), 'sobrou CSS');
});

test('art. 927: caput e parágrafo único, sem invadir o art. 928', () => {
  const a = extrairArtigo(cc, '927');
  assert.match(a.texto, /^Art\. 927\. Aquele que, por ato ilícito \(arts\. 186 e 187\), causar dano a outrem, fica obrigado a repará-lo\./);
  assert.match(a.texto, /Parágrafo único\. Haverá obrigação de reparar o dano/);
  assert.ok(!a.texto.includes('incapaz responde'));
  assert.equal(a.revogado, false);
});

test('art. 186 não leva o título do capítulo seguinte', () => {
  const a = extrairArtigo(cc, 'art. 186');
  assert.match(a.texto, /comete ato ilícito\.$/);
  const b = extrairArtigo(cc, '187');
  assert.ok(!/TÍTULO|Responsabilidade Civil/.test(b.texto), b.texto);
});

test('ordinal em <sup>, milhar com ponto e sufixo -A', () => {
  assert.match(extrairArtigo(cc, '1').texto, /^Art\. 1o Toda pessoa/);
  assert.match(extrairArtigo(cc, '1.228').texto, /O proprietário tem a faculdade/);
  assert.match(extrairArtigo(cc, '1228').texto, /§ 1o O direito de propriedade/);
  assert.match(extrairArtigo(cc, '1.240-A').texto, /por 2 \(dois\) anos/);
  assert.deepEqual(lerNumeroArtigo('art. 5º'), { num: 5, letra: '' });
  assert.deepEqual(lerNumeroArtigo('1.240-A'), { num: 1240, letra: 'A' });
});

test('redação riscada é descartada; fica a vigente', () => {
  const a = extrairArtigo(cc, '3');
  assert.match(a.texto, /os menores de 16 \(dezesseis\) anos/);
  assert.ok(!/atos da vida civil:/.test(a.texto), 'veio a redação antiga');
  assert.ok(!/menores de dezesseis anos;/.test(a.texto));
});

test('detecta dispositivo revogado', () => {
  const a = extrairArtigo(cc, '500');
  assert.equal(a.revogado, true);
  assert.ok(!/Texto antigo riscado/.test(a.texto));
});

test('artigo que não existe: informa o maior artigo da lei', () => {
  const a = extrairArtigo(cc, '3.500');
  assert.equal(a.texto, '');
  assert.equal(a.maiorArtigo, 2046);
});

test('trecho literal: tolera acento e pontuação, recusa paráfrase', () => {
  const art = extrairArtigo(cc, '927').texto;
  assert.equal(localizarTrecho(art, 'causar dano a outrem, fica obrigado a repara-lo'), 'causar dano a outrem, fica obrigado a repará-lo');
  assert.equal(localizarTrecho(art, 'quem causa dano deve pagar o dobro do valor cobrado'), null);
  assert.equal(localizarTrecho(art, 'dano'), null, 'trecho curto demais não vale como prova');
});

test('números: 1.987.654 e 1987654 batem; 385 não bate dentro de 13850', () => {
  assert.ok(contemNumero('REsp n. 1.987.654 - SP', '1987654'));
  assert.ok(contemNumero('Súmula 385/STJ', '385'));
  assert.ok(!contemNumero('processo 13850 de 2020', '385'));
});

test('normas: apelidos, número e endereço', () => {
  assert.match(resolverNorma('Código Civil').urls[0], /leis\/2002\/l10406compilada\.htm$/);
  assert.match(resolverNorma('CC').urls[0], /l10406/);
  assert.match(resolverNorma('CDC').urls[0], /l8078compilado/);
  assert.match(resolverNorma('Lei nº 8.078/1990').urls[0], /l8078compilado/);
  assert.match(resolverNorma('Lei 8.078, de 11 de setembro de 1990').urls[0], /l8078/);
  assert.match(resolverNorma('Lei 13.874/2019').urls[0], /_ato2019-2022\/2019\/lei\/l13874\.htm$/);
  assert.match(resolverNorma('Lei 12.414/2011').urls[0], /_ato2011-2014\/2011\/lei\/l12414\.htm$/);
  assert.match(resolverNorma('Lei Complementar 123/2006').urls[0], /leis\/lcp\/lcp123\.htm$/);
  assert.match(resolverNorma('Constituição Federal').urls[0], /constituicaocompilado/);
  assert.equal(resolverNorma('Regimento Interno do TJSP'), null);
  assert.deepEqual(lerNumeroNorma('Lei n. 9.099/95'), { especie: 'lei', numero: '9099', ano: 1995 });
  assert.equal(chave('Código de Processo Civil'), 'codigo de processo civil');
  assert.match(resolverNorma('código de processo civil').urls[0], /l13105/);
  assert.match(resolverNorma('Código Penal').urls[0], /del2848/);
  assert.match(resolverNorma('CPP').urls[0], /del3689/);
});

test('fonte oficial e link de pesquisa manual', () => {
  assert.ok(ehFonteOficial('https://scon.stj.jus.br/SCON/x'));
  assert.ok(ehFonteOficial('https://www.planalto.gov.br/ccivil_03/x.htm'));
  assert.ok(!ehFonteOficial('https://www.jusbrasil.com.br/x'));
  assert.ok(!ehFonteOficial('https://stj.jus.br.exemplo.com/x'));
  assert.match(pesquisaManual({ tipo: 'decisao', tribunal: 'STJ', classe: 'REsp', numero: '1.987.654' }).url, /scon\.stj\.jus\.br.*REsp/);
  assert.match(pesquisaManual({ tipo: 'sumula', tribunal: 'STJ', numero: '385' }).url, /b=SUMU&livre=385/);
});

test('JSON com texto em volta e recorte de artigo longo', () => {
  assert.deepEqual(jsonLeniente('Segue:\n```json\n{"a":1}\n```'), { a: 1 });
  assert.equal(jsonLeniente('nada'), null);
  const longo = 'Art. 5º Todos são iguais perante a lei:\n' + Array.from({ length: 80 }, (_, i) => `${['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][i % 12]} - inciso de teste número ${i} com bastante texto para ocupar espaço na página;`).join('\n') + '\nLXXVIII - a todos são assegurados a razoável duração do processo.';
  const r = recortarDispositivo(longo, 'inciso LXXVIII', 800);
  assert.match(r, /^Art\. 5º Todos são iguais/);
  assert.match(r, /razoável duração do processo/);
});
