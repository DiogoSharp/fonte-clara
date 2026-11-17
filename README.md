# Fonte Clara

Confere as leis, súmulas e decisões citadas em uma peça jurídica e classifica cada uma como
**Confirmada**, **Divergente** ou **Não localizada**, com o trecho e o link da fonte.
Projeto acadêmico (Insper, Ciência de Dados Aplicada ao Direito I, 2026/2).

Site: https://fonte-clara-app.netlify.app · Ferramenta: https://fonte-clara-app.netlify.app/#/conferir

## Como funciona

1. **Envio.** O navegador lê o arquivo (.docx, .pdf ou .txt) e troca CPFs, CNPJs, e-mails e telefones por marcações. Só o texto mascarado sai do computador.
2. **Leitura.** A função `/api/extrair` pede à IA a lista de citações. O servidor descarta qualquer citação que não esteja escrita na peça.
3. **Consulta.** A função `/api/conferir` trata uma citação por vez:
   - **Lei:** abre a página da norma no Planalto, recorta o artigo e pede à IA que compare o artigo com o que a peça afirma.
   - **Súmula, decisão ou lei que o Planalto não entregou:** usa a busca na web do modelo, restrita na instrução a sites oficiais.
4. **Relatório.** Cada citação aparece com a classificação, o trecho da peça, o trecho da fonte, o link e o horário da consulta.

### O que o código garante, independentemente da IA

- **Confirmada** só sai quando o trecho exibido existe, letra por letra, no texto lido da fonte.
- A fonte precisa ser oficial (`.jus.br`, `.gov.br`, `.leg.br`). Achou só em site privado: pendência.
- Artigo com número acima do último da lei: **Não localizada**, sem consultar a IA.
- Dispositivo revogado ou súmula cancelada: **Divergente**.
- O que não pôde ser aberto ou validado fica **Pendente**. Pendente não é classificação: quer dizer que a citação não foi conferida.

## Estrutura

```
site/                 o que o público vê (página única + app/conferir.js e .css)
site/vendor/          leitores de Word (mammoth) e PDF (pdf.js), rodam no navegador
netlify/functions/    extrair, conferir e status: rodam no servidor e guardam a chave
netlify/lib/          motor.mjs (regras), texto.mjs (leitura das páginas), normas.mjs (endereços), groq.mjs
testes/               testes automáticos e um simulador do Groq e do Planalto
```

## Publicar

O site precisa ser publicado a partir deste repositório. Arrastar a pasta para o Netlify não publica as funções.

1. No Netlify: **Project configuration → Build & deploy → Link repository** e escolha este repositório. Não há comando de build; a pasta publicada é `site` (já está no `netlify.toml`).
2. Em **Environment variables**, crie `GROQ_API_KEY` com a chave criada em https://console.groq.com/keys.
3. Em **Deploys**, clique em **Trigger deploy**.

Variáveis opcionais: `GROQ_MODEL` (padrão `openai/gpt-oss-120b`).

## Rodar no computador

```
node testes/servidor-local.mjs --simulado     # respostas fixas de teste, sem chave
GROQ_API_KEY=sua_chave node testes/servidor-local.mjs   # Groq de verdade
npm test                                      # testes automáticos
```

Depois abra http://localhost:8888/#/conferir.

## Limites desta versão

- Lê até cerca de 15 páginas e confere até 40 citações por peça.
- PDF digitalizado (imagem) não é lido.
- Nomes de pessoas e números de processo não são mascarados.
- Decisões e súmulas dependem de busca na web, que não é a base do tribunal: uma decisão real pode sair como não localizada. O relatório traz o link para repetir a pesquisa no tribunal.
- Livros não são consultados.
