// Roda a Fonte Clara no seu computador, sem Netlify.
//   node testes/servidor-local.mjs            -> usa o Groq de verdade (defina GROQ_API_KEY antes)
//   node testes/servidor-local.mjs --simulado -> usa respostas fixas de teste, sem chave e sem internet
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../site/', import.meta.url));
const porta = Number(process.env.PORT || 8888);
const simulado = process.argv.includes('--simulado');

if (simulado) {
  const { iniciar } = await import('./simulador.mjs');
  const sim = await iniciar(porta + 1);
  process.env.GROQ_API_KEY ||= 'teste';
  process.env.GROQ_BASE_URL = `http://127.0.0.1:${sim.porta}`;
  process.env.PLANALTO_BASE = `http://127.0.0.1:${sim.porta}`;
  console.log('Modo simulado: as respostas são fixas e servem só para testar a tela.');
}
const funcoes = {
  '/api/extrair': (await import('../netlify/functions/extrair.mjs')).default,
  '/api/conferir': (await import('../netlify/functions/conferir.mjs')).default,
  '/api/status': (await import('../netlify/functions/status.mjs')).default,
};
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (funcoes[url.pathname]) {
      const partes = []; for await (const c of req) partes.push(c);
      const pedido = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(partes) });
      const r = await funcoes[url.pathname](pedido, {});
      res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
    }
    let caminho = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (caminho.endsWith('/')) caminho += 'index.html';
    const dados = await readFile(join(raiz, caminho));
    res.writeHead(200, { 'content-type': TIPOS[extname(caminho)] || 'application/octet-stream' }); res.end(dados);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' }); res.end(e.code === 'ENOENT' ? 'Não encontrado' : 'Erro: ' + e.message);
  }
}).listen(porta, () => console.log(`Fonte Clara em http://localhost:${porta}/#/conferir`));
