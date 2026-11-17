/* Fonte Clara: página "Conferir peça" (primeira versão funcional).
   O navegador lê o arquivo, mascara dados pessoais e conversa com as funções do servidor:
   /api/extrair (localiza as citações) e /api/conferir (confere cada uma na fonte). */
(function () {
  'use strict';
  var raiz = document.getElementById('conferir');
  if (!raiz) return;
  var $ = function (s) { return raiz.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var LIMITE_BLOCO = 7000, MAX_BLOCOS = 6, MAX_CITACOES = 40, PARALELO = 2;
  var ROT = { confirmada: ['Confirmada', 'ok'], divergente: ['Divergente', 'warn'], nao_localizada: ['Não localizada', 'miss'], pendente: ['Pendente', 'pend'] };
  var METODO = { direta: 'Texto lido direto da página oficial', busca: 'Localizada por busca na web; trecho validado no texto lido pela busca' };
  var CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  var EXEMPLO = [
    'EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA 3ª VARA CÍVEL DA COMARCA DE SÃO PAULO',
    'MARIA APARECIDA SILVA, brasileira, professora, inscrita no CPF sob o nº 123.456.789-09, e-mail maria.silva@exemplo.com.br, vem, por seu advogado, apresentar RÉPLICA nos autos da ação que move contra BANCO EXEMPLO S.A., pelos fundamentos a seguir.',
    '1. O banco réu cobrou tarifas que não foram contratadas e inscreveu o nome da autora em cadastro de inadimplentes. A relação é de consumo, e o fornecedor de serviços responde independentemente de culpa pelos danos causados, como prevê o art. 14 do Código de Defesa do Consumidor.',
    '2. Configurado o ato ilícito, nos termos do art. 186 do Código Civil, impõe-se a devolução em dobro dos valores cobrados, conforme o art. 927 do Código Civil.',
    '3. A devolução em dobro também decorre do art. 42, parágrafo único, do CDC, que assegura ao consumidor cobrado em quantia indevida a repetição do indébito.',
    '4. O réu invoca a Súmula 385 do STJ para afastar o dano moral. O enunciado, porém, só se aplica quando há inscrição legítima preexistente, o que não é o caso.',
    '5. O dano moral, na hipótese, é presumido, como decidiu o Superior Tribunal de Justiça no REsp 9.876.543/SP.',
    '6. Na doutrina, a mesma conclusão é defendida por SILVA, João. Responsabilidade Civil nas Relações Bancárias. 3. ed. São Paulo: Editora Exemplo, 2021, p. 112.',
    'Pede, assim, a procedência dos pedidos.',
    'São Paulo, 10 de novembro de 2026.'
  ].join('\n\n');

  var area = $('#cf-texto'), conta = $('#cf-conta'), aviso = $('#cf-aviso');
  var estado = { rodada: 0, citacoes: [], res: {}, pularDireto: false, filtro: 'todas', texto: '', nome: '' };

  /* ---------- avisos e etapas ---------- */
  function avisar(html, tipo) { aviso.className = 'cf-aviso ' + (tipo || ''); aviso.innerHTML = html; aviso.hidden = !html; }
  function etapa(n) {
    [].forEach.call(raiz.querySelectorAll('.cf-steps li'), function (li, i) {
      li.classList.toggle('on', i === n); li.classList.toggle('done', i < n);
      if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }

  /* ---------- privacidade: mascara dados pessoais antes de qualquer envio ---------- */
  function mascarar(t) {
    var n = { CPF: 0, CNPJ: 0, 'e-mail': 0, telefone: 0 };
    t = t.replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, function () { n.CNPJ++; return '[CNPJ]'; });
    t = t.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, function () { n.CPF++; return '[CPF]'; });
    t = t.replace(/(CPF[^\d\n]{0,14})(\d{11})\b/gi, function (m, a) { n.CPF++; return a + '[CPF]'; });
    t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, function () { n['e-mail']++; return '[E-MAIL]'; });
    t = t.replace(/(?:\(\d{2}\)\s?|\b\d{2}\s)?\b9?\d{4}-\d{4}\b(?!\.\d)/g, function () { n.telefone++; return '[TELEFONE]'; });
    return { texto: t, n: n };
  }
  function resumoMascaras(n) {
    var p = Object.keys(n).filter(function (k) { return n[k]; }).map(function (k) { return n[k] + ' ' + k + (n[k] > 1 && k !== 'e-mail' ? 's' : n[k] > 1 ? 's' : ''); });
    return p.length ? p.join(', ') : '';
  }

  /* ---------- leitura de arquivos (no próprio navegador) ---------- */
  function carregar(src) {
    return new Promise(function (ok, erro) {
      if (document.querySelector('script[data-src="' + src + '"]')) return ok();
      var s = document.createElement('script'); s.src = src; s.setAttribute('data-src', src);
      s.onload = function () { ok(); }; s.onerror = function () { erro(new Error('Não consegui carregar o leitor de arquivos.')); };
      document.head.appendChild(s);
    });
  }
  function lerArquivo(f) {
    var nome = f.name.toLowerCase();
    if (f.size > 12 * 1024 * 1024) return Promise.reject(new Error('Arquivo maior que 12 MB.'));
    if (/\.txt$/.test(nome) || f.type === 'text/plain') return f.text();
    if (/\.docx$/.test(nome)) {
      return carregar('vendor/mammoth.browser.min.js').then(function () { return f.arrayBuffer(); })
        .then(function (b) { return window.mammoth.extractRawText({ arrayBuffer: b }); }).then(function (r) { return r.value; });
    }
    if (/\.pdf$/.test(nome)) {
      return carregar('vendor/pdf.min.js').then(function () { return f.arrayBuffer(); }).then(function (b) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
        return window.pdfjsLib.getDocument({ data: b }).promise;
      }).then(function (pdf) {
        var paginas = [], p = Promise.resolve();
        for (var i = 1; i <= pdf.numPages; i++) (function (i) {
          p = p.then(function () { return pdf.getPage(i); }).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
            // junta as linhas visuais em parágrafos: só um salto maior que o normal vira quebra
            var linhas = [], y = null, atual = '';
            tc.items.forEach(function (it) {
              var yy = it.transform ? it.transform[5] : y;
              if (y !== null && Math.abs(yy - y) > 2) { linhas.push({ t: atual, y: y }); atual = ''; }
              atual += it.str; y = yy; if (it.hasEOL) { linhas.push({ t: atual, y: y }); atual = ''; y = null; }
            });
            if (atual) linhas.push({ t: atual, y: y });
            linhas = linhas.filter(function (l) { return l.t.trim(); });
            var saltos = [];
            for (var k = 1; k < linhas.length; k++) if (linhas[k].y != null && linhas[k - 1].y != null) saltos.push(Math.abs(linhas[k - 1].y - linhas[k].y));
            saltos.sort(function (a, b) { return a - b; });
            var normal = saltos.length ? saltos[Math.floor(saltos.length / 2)] : 0, txt = '';
            linhas.forEach(function (l, k) {
              if (!k) { txt = l.t.trim(); return; }
              var salto = (l.y != null && linhas[k - 1].y != null) ? Math.abs(linhas[k - 1].y - l.y) : normal;
              txt += (normal && salto > normal * 1.45 ? '\n\n' : ' ') + l.t.trim();
            });
            paginas.push(txt);
          });
        })(i);
        return p.then(function () { return paginas.join('\n\n'); });
      });
    }
    if (/\.doc$/.test(nome)) return Promise.reject(new Error('Arquivos .doc antigos não são lidos. Salve como .docx ou PDF.'));
    return Promise.reject(new Error('Formato não reconhecido. Envie .docx, .pdf ou .txt.'));
  }
  function arrumarTexto(t) {
    return String(t).replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/ +\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ---------- chamadas ao servidor, com espera quando o Groq pede ---------- */
  function esperar(seg, rodada, rotulo) {
    return new Promise(function (ok) {
      var fim = Date.now() + seg * 1000;
      (function tic() {
        if (rodada !== estado.rodada) return ok();
        var falta = Math.ceil((fim - Date.now()) / 1000);
        if (falta <= 0) { $('#cf-prog-dir').textContent = ''; return ok(); }
        $('#cf-prog-dir').textContent = (rotulo || 'Limite de uso da IA: retomando em ') + falta + ' s';
        setTimeout(tic, 500);
      })();
    });
  }
  function api(caminho, corpo, rodada, tentativa) {
    tentativa = tentativa || 0;
    return fetch(caminho, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }).then(function (r) {
      var tipo = r.headers.get('content-type') || '';
      if (!/json/.test(tipo)) { var e = new Error(r.status === 404 ? 'As funções do servidor não estão publicadas neste endereço.' : 'O servidor respondeu de forma inesperada (' + r.status + ').'); e.codigo = r.status === 404 ? 'sem_funcoes' : 'servidor'; throw e; }
      return r.json().then(function (j) {
        if (r.ok) return j;
        if (r.status === 429 && tentativa < 5) return esperar(j.aguardar || 20, rodada).then(function () { if (rodada !== estado.rodada) throw new Error('cancelado'); return api(caminho, corpo, rodada, tentativa + 1); });
        var e = new Error(j.mensagem || 'Erro no servidor.'); e.codigo = j.erro || 'servidor'; e.detalhe = j.detalhe; throw e;
      });
    });
  }
  var FATAIS = { sem_chave: 1, chave_invalida: 1, modelo: 1, sem_funcoes: 1 };
  function explicar(e) {
    if (e.codigo === 'sem_funcoes') return '<strong>A conferência não está ativa neste endereço.</strong> O site foi publicado sem as funções do servidor. Publique pelo repositório do GitHub, como no passo a passo.';
    if (e.codigo === 'sem_chave') return '<strong>Falta a chave do Groq.</strong> No Netlify, crie a variável <code>GROQ_API_KEY</code> e publique de novo.';
    if (e.codigo === 'chave_invalida') return '<strong>O Groq recusou a chave.</strong> Confira a variável <code>GROQ_API_KEY</code> no Netlify.';
    if (e.codigo === 'modelo') return '<strong>O modelo configurado não está disponível no Groq.</strong> ' + esc(e.message) + ' Ajuste a variável <code>GROQ_MODEL</code> no Netlify.';
    if (e.codigo === 'limite') return '<strong>Limite de uso do Groq atingido.</strong> Espere um minuto e tente de novo, ou confira uma peça menor.';
    return '<strong>Não deu para concluir.</strong> ' + esc(e.message || 'Erro inesperado.') + (e.detalhe ? ' <span style="opacity:.75">(' + esc(String(e.detalhe).slice(0, 180)) + ')</span>' : '');
  }

  /* ---------- peça com as citações marcadas ---------- */
  function dividir(t) {
    var blocos = [], atual = '';
    t.split(/\n{2,}/).forEach(function (par) {
      while (par.length > LIMITE_BLOCO) { if (atual) { blocos.push(atual); atual = ''; } blocos.push(par.slice(0, LIMITE_BLOCO)); par = par.slice(LIMITE_BLOCO); }
      if ((atual + '\n\n' + par).length > LIMITE_BLOCO && atual) { blocos.push(atual); atual = par; } else atual = atual ? atual + '\n\n' + par : par;
    });
    if (atual) blocos.push(atual);
    return blocos;
  }
  function pintarPeca() {
    var t = estado.texto, marcas = [];
    estado.citacoes.forEach(function (c) {
      if (!c.referencia) return;
      var padrao = c.referencia.trim().split(/\s+/).map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('\\s+');
      var re, m; try { re = new RegExp(padrao, 'gi'); } catch (e) { return; }
      while ((m = re.exec(t))) {
        var i = m.index, f = i + m[0].length;
        if (!marcas.some(function (x) { return i < x.f && f > x.i; })) { marcas.push({ i: i, f: f, id: c.id }); break; }
        re.lastIndex = i + 1;
      }
    });
    marcas.sort(function (a, b) { return a.i - b.i; });
    var html = '', pos = 0;
    var fmt = function (s) { return esc(s).replace(/\[(CPF|CNPJ|E-MAIL|TELEFONE)\]/g, '<span class="masc">$1 oculto</span>'); };
    marcas.forEach(function (m) {
      var s = (estado.res[m.id] || {}).status || '';
      html += fmt(t.slice(pos, m.i)) + '<mark data-id="' + m.id + '"' + (s ? ' data-s="' + s + '"' : '') + '>' + esc(t.slice(m.i, m.f)) + '</mark>'; pos = m.f;
    });
    $('#cf-doc').innerHTML = html + fmt(t.slice(pos));
  }

  /* ---------- lista e relatório ---------- */
  function fonteCurta(r) { if (!r || !r.fonte) return ''; try { return new URL(r.fonte.url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function hora(iso) { try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } }
  function itemHTML(c) {
    var r = estado.res[c.id], cab, corpo = '';
    if (!r) cab = '<span class="cf-fila">na fila</span>';
    else if (r.andamento) cab = '<span class="cf-spin" aria-hidden="true"></span><span class="sr">consultando</span>';
    else cab = '<span class="tag ' + ROT[r.status][1] + '">' + ROT[r.status][0] + '</span>';
    if (r && r.status) {
      var meta = [];
      if (r.fonte && r.fonte.url) meta.push('<a href="' + esc(r.fonte.url) + '" target="_blank" rel="noopener noreferrer">Abrir na fonte</a>');
      if (r.manual && r.manual.url && r.status !== 'confirmada') meta.push('<a href="' + esc(r.manual.url) + '" target="_blank" rel="noopener noreferrer">' + esc(r.manual.rotulo) + '</a>');
      if (r.metodo && METODO[r.metodo] && r.status !== 'nao_localizada') meta.push('<span>' + METODO[r.metodo] + '</span>');
      if (r.situacao && !/vigente|desconhecida/i.test(r.situacao)) meta.push('<span>Situação: ' + esc(r.situacao) + '</span>');
      if (r.consultadoEm) meta.push('<span>Consultado em ' + hora(r.consultadoEm) + '</span>');
      if (r.repetir) meta.push('<button type="button" class="cf-btn sec" data-repetir="' + c.id + '" style="padding:.3rem .8rem;font-size:.8rem">Tentar de novo</button>');
      corpo = '<p class="cf-just">' + esc(r.justificativa || '') + '</p>' +
        '<div class="side-by-side">' +
        (c.trecho ? '<div class="quote"><span class="cf-q">Na peça</span><p>' + esc(c.trecho) + '</p></div>' : '') +
        (r.trechoFonte ? '<div class="quote src"><span class="cf-q">Na fonte' + (r.fonte ? ': ' + esc(r.fonte.nome) : '') + '</span><p>' + esc(r.trechoFonte) + '</p></div>' : '') +
        '</div>' + (meta.length ? '<p class="cf-meta">' + meta.join('') + '</p>' : '');
    }
    var aberto = r && r.status && r.aberto;
    return '<li class="cf-item" id="cf-i-' + c.id + '" data-id="' + c.id + '" data-status="' + ((r && r.status) || '') + '" aria-expanded="' + (aberto ? 'true' : 'false') + '">' +
      '<button type="button" class="cf-item-head" ' + (r && r.status ? '' : 'disabled ') + 'aria-expanded="' + (aberto ? 'true' : 'false') + '">' + cab +
      '<span class="cf-ref">' + esc(c.rotulo) + '</span><span class="cf-src">' + esc(fonteCurta(r)) + '</span>' + (r && r.status ? CHEV : '') + '</button>' +
      '<div class="cf-item-body">' + corpo + '</div></li>';
  }
  function visivel(c) { var s = (estado.res[c.id] || {}).status; return estado.filtro === 'todas' || s === estado.filtro; }
  function pintarLista() {
    var lista = estado.citacoes.filter(visivel);
    $('#cf-lista').innerHTML = lista.map(itemHTML).join('') || '<li class="cf-vazio">Nenhuma citação nesta classificação.</li>';
  }
  function contar() {
    var n = { confirmada: 0, divergente: 0, nao_localizada: 0, pendente: 0, feitas: 0 };
    estado.citacoes.forEach(function (c) { var s = (estado.res[c.id] || {}).status; if (s) { n[s]++; n.feitas++; } });
    return n;
  }
  function pintarResumo() {
    var n = contar(), total = estado.citacoes.length;
    ['confirmada', 'divergente', 'nao_localizada', 'pendente'].forEach(function (k) { $('#cf-n-' + k).textContent = n[k]; });
    $('#cf-bar').style.width = (total ? 100 * n.feitas / total : 0) + '%';
    $('#cf-prog-esq').innerHTML = total ? '<strong>' + n.feitas + ' de ' + total + '</strong> citações conferidas' : '';
    return n;
  }
  function atualizar(id) {
    pintarResumo();
    var li = document.getElementById('cf-i-' + id), c = estado.citacoes.filter(function (x) { return x.id === id; })[0];
    if (li && c && visivel(c)) li.outerHTML = itemHTML(c); else pintarLista();
    var m = $('#cf-doc mark[data-id="' + id + '"]'), s = (estado.res[id] || {}).status;
    if (m && s) m.setAttribute('data-s', s);
  }

  /* ---------- consulta ---------- */
  function conferirUma(c, rodada) {
    estado.res[c.id] = { andamento: true }; atualizar(c.id);
    return api('/api/conferir', { citacao: c, pularDireto: estado.pularDireto }, rodada).then(function (j) {
      if (rodada !== estado.rodada) return;
      var r = j.resultado;
      if (r.planalto === 'bloqueado') estado.pularDireto = true;
      r.aberto = r.status !== 'confirmada' && !estado.algumAberto; if (r.aberto) estado.algumAberto = true;
      estado.res[c.id] = r; atualizar(c.id);
    }).catch(function (e) {
      if (rodada !== estado.rodada) return;
      if (FATAIS[e.codigo]) throw e;
      estado.res[c.id] = { status: 'pendente', motivo: 'erro', repetir: true, consultadoEm: new Date().toISOString(),
        justificativa: 'A consulta falhou: ' + (e.message || 'erro inesperado') + ' Esta citação não foi conferida.' };
      atualizar(c.id);
    });
  }
  function conferirTodas(lista, rodada) {
    var fila = lista.slice(), ativos = [];
    function proximo() {
      if (rodada !== estado.rodada || !fila.length) return Promise.resolve();
      return conferirUma(fila.shift(), rodada).then(proximo);
    }
    for (var i = 0; i < PARALELO; i++) ativos.push(proximo());
    return Promise.all(ativos);
  }

  function iniciar() {
    var bruto = arrumarTexto(area.value);
    if (bruto.length < 80) { avisar('<strong>Texto curto demais.</strong> Cole a peça inteira ou envie o arquivo.', ''); area.focus(); return; }
    var rodada = ++estado.rodada;
    var m = mascarar(bruto);
    estado.texto = m.texto; estado.citacoes = []; estado.res = {}; estado.filtro = 'todas'; estado.algumAberto = false;
    var blocos = dividir(m.texto), cortou = blocos.length > MAX_BLOCOS;
    if (cortou) { blocos = blocos.slice(0, MAX_BLOCOS); estado.texto = blocos.join('\n\n'); }
    avisar('', '');
    $('#cf-envio').hidden = true; $('#cf-trabalho').hidden = false; $('#cf-fim').hidden = true;
    $('#cf-nome').textContent = estado.nome || 'Texto colado';
    var rm = resumoMascaras(m.n);
    $('#cf-masc').textContent = rm ? 'Mascarado antes do envio: ' + rm + '.' : 'Nenhum CPF, CNPJ, e-mail ou telefone encontrado para mascarar.';
    [].forEach.call(raiz.querySelectorAll('.cf-filtros .filter'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-f') === 'todas'); });
    pintarPeca(); pintarLista(); pintarResumo(); etapa(1);
    $('#cf-prog-esq').innerHTML = '<strong>Lendo a peça</strong> e marcando as citações';
    $('#cf-prog-dir').textContent = '';
    raiz.scrollIntoView({ behavior: 'smooth', block: 'start' });

    var vistos = {}, seq = Promise.resolve();
    blocos.forEach(function (b, i) {
      seq = seq.then(function () {
        if (rodada !== estado.rodada) return;
        if (blocos.length > 1) $('#cf-prog-dir').textContent = 'parte ' + (i + 1) + ' de ' + blocos.length;
        return api('/api/extrair', { texto: b }, rodada).then(function (j) {
          if (rodada !== estado.rodada) return;
          (j.citacoes || []).forEach(function (c) {
            var k = (c.tipo + '|' + c.rotulo).toLowerCase();
            if (vistos[k] || estado.citacoes.length >= MAX_CITACOES) return;
            vistos[k] = 1; c.id = 'c' + (estado.citacoes.length + 1); estado.citacoes.push(c);
          });
          pintarPeca(); pintarLista();
        });
      });
    });
    seq.then(function () {
      if (rodada !== estado.rodada) return;
      $('#cf-prog-dir').textContent = '';
      if (!estado.citacoes.length) { $('#cf-prog-esq').innerHTML = '<strong>Nenhuma citação encontrada</strong> neste texto'; $('#cf-lista').innerHTML = '<li class="cf-vazio">Não encontrei leis, súmulas, decisões ou obras citadas nesta peça.</li>'; $('#cf-fim').hidden = false; etapa(3); return; }
      etapa(2); pintarResumo();
      return conferirTodas(estado.citacoes, rodada).then(function () {
        if (rodada !== estado.rodada) return;
        etapa(3); var n = pintarResumo(); $('#cf-fim').hidden = false;
        var notas = [];
        if (cortou) notas.push('Esta versão lê até cerca de 15 páginas por vez. O restante da peça não foi lido.');
        if (estado.citacoes.length >= MAX_CITACOES) notas.push('Esta versão confere até ' + MAX_CITACOES + ' citações por peça.');
        if (n.pendente) notas.push(n.pendente + (n.pendente > 1 ? ' citações ficaram pendentes' : ' citação ficou pendente') + ': não foram classificadas porque a fonte não pôde ser validada automaticamente.');
        if (notas.length) avisar('<strong>Atenção.</strong> ' + notas.join(' '), 'info');
      });
    }).catch(function (e) {
      if (rodada !== estado.rodada || e.message === 'cancelado') return;
      avisar(explicar(e), 'erro'); $('#cf-fim').hidden = false; $('#cf-prog-dir').textContent = '';
      aviso.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
  function reiniciar() {
    estado.rodada++; avisar('', '');
    $('#cf-trabalho').hidden = true; $('#cf-envio').hidden = false; etapa(0); area.focus();
  }

  /* ---------- eventos ---------- */
  function contarCaracteres() { var n = area.value.length; conta.textContent = n ? n.toLocaleString('pt-BR') + ' caracteres' : ''; $('#cf-ir').disabled = area.value.trim().length < 80; }
  area.addEventListener('input', function () { estado.nome = ''; contarCaracteres(); });
  $('#cf-exemplo').addEventListener('click', function () { area.value = EXEMPLO; estado.nome = 'Peça de exemplo (fictícia)'; contarCaracteres(); avisar('', ''); });
  $('#cf-arq').addEventListener('change', function (ev) {
    var f = ev.target.files[0]; if (!f) return;
    avisar('Lendo <strong>' + esc(f.name) + '</strong>…', 'info');
    lerArquivo(f).then(function (t) {
      t = arrumarTexto(t);
      if (t.length < 80) throw new Error('Não encontrei texto neste arquivo. Se for um PDF digitalizado (imagem), esta versão não lê.');
      area.value = t; estado.nome = f.name; contarCaracteres(); avisar('', '');
    }).catch(function (e) { avisar('<strong>Não consegui ler o arquivo.</strong> ' + esc(e.message), 'erro'); }).then(function () { ev.target.value = ''; });
  });
  $('#cf-ir').addEventListener('click', iniciar);
  $('#cf-outra').addEventListener('click', reiniciar);
  $('#cf-pdf').addEventListener('click', function () { window.print(); });
  raiz.addEventListener('click', function (ev) {
    var rep = ev.target.closest('[data-repetir]');
    if (rep) { var c0 = estado.citacoes.filter(function (x) { return x.id === rep.getAttribute('data-repetir'); })[0]; if (c0) conferirUma(c0, estado.rodada).catch(function (e) { avisar(explicar(e), 'erro'); }); return; }
    var cab = ev.target.closest('.cf-item-head');
    if (cab && !cab.disabled) { var li = cab.parentNode, on = li.getAttribute('aria-expanded') !== 'true'; li.setAttribute('aria-expanded', on); cab.setAttribute('aria-expanded', on); var r = estado.res[li.getAttribute('data-id')]; if (r) r.aberto = on; return; }
    var f = ev.target.closest('.cf-filtros .filter');
    if (f) { estado.filtro = f.getAttribute('data-f'); [].forEach.call(raiz.querySelectorAll('.cf-filtros .filter'), function (b) { b.setAttribute('aria-pressed', b === f); }); pintarLista(); return; }
    var mk = ev.target.closest('#cf-doc mark');
    if (mk) {
      var id = mk.getAttribute('data-id'); if (!estado.res[id] || !estado.res[id].status) return;
      if (!document.getElementById('cf-i-' + id)) { estado.filtro = 'todas'; [].forEach.call(raiz.querySelectorAll('.cf-filtros .filter'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-f') === 'todas'); }); }
      estado.res[id].aberto = true; pintarLista();
      var alvo = document.getElementById('cf-i-' + id);
      [].forEach.call(raiz.querySelectorAll('.cf-item.foco,mark.foco'), function (x) { x.classList.remove('foco'); });
      alvo.classList.add('foco'); mk.classList.add('foco'); alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  /* ---------- diagnóstico ao abrir a página ---------- */
  var diagnosticado = false;
  function diagnosticar() {
    if (diagnosticado) return; diagnosticado = true;
    fetch('/api/status').then(function (r) { if (!/json/.test(r.headers.get('content-type') || '')) throw { codigo: 'sem_funcoes' }; return r.json(); }).then(function (s) {
      if (!s.chave) return avisar(explicar({ codigo: 'sem_chave' }), 'erro');
      if (!s.ia.ok) return avisar(explicar({ codigo: s.ia.erro, message: s.ia.mensagem, detalhe: s.ia.detalhe }), 'erro');
      if (!s.planalto.ok) estado.pularDireto = true;
      $('#cf-estado').textContent = s.planalto.ok ? 'Leis: texto lido direto no Planalto. Súmulas e decisões: busca em sites oficiais.' : 'O Planalto não respondeu a este servidor. Leis, súmulas e decisões serão conferidas pela busca em sites oficiais.';
    }).catch(function (e) { avisar(explicar(e && e.codigo ? e : { codigo: 'sem_funcoes' }), 'erro'); });
  }
  function aoNavegar() {
    var pagina = (location.hash || '#/').replace(/^#\/?/, '') || 'inicio';
    document.documentElement.setAttribute('data-pagina', pagina);
    if (pagina === 'conferir') diagnosticar();
  }
  window.addEventListener('hashchange', aoNavegar); aoNavegar();
  contarCaracteres(); etapa(0);
})();
