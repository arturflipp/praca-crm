# praça CRM — guia do projeto

CRM de prospecção de clientes (placas NFC) para uso pessoal. App estático, sem build, sem framework.

## Stack
- HTML + CSS + JavaScript puro (sem bundler, sem npm no projeto).
- Um único `app.js` concentra a lógica; `index.html` tem a marcação; `styles.css` tem os estilos.
- Backend: Supabase (tabela `public.crm_state`, uma linha JSON por usuário, com RLS).
- Publicação: GitHub Pages via GitHub Actions.

## Arquivos principais
- `app.js` — toda a lógica (estado, leads, lembretes, vendas, relatórios, sincronização).
- `index.html` — marcação e navegação (views: prompt, crm, agenda, reports).
- `styles.css` — estilos (um único arquivo, minificado em partes).
- `supabase-config.js` — URL e chave **publishable** do Supabase (pode ser pública).
- `supabase/schema.sql` — esquema da tabela e políticas RLS.
- `.github/workflows/pages.yml` — deploy no push para `main`.

## Rodar no local
- Servidor simples na raiz do projeto:
  `python3 -m http.server 4174`
- Abrir: `http://localhost:4174`
- No app, use **"Somente neste navegador"** para testar sem login/Supabase.

## Testar antes de publicar
- Verificar sintaxe do JS: `node --check app.js`
- Conferir chaves do CSS: contar `{` e `}` em `styles.css` (devem bater).
- Teste de interface automatizado (headless Chrome), quando necessário:
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless=new --disable-gpu --virtual-time-budget=4000 --window-size=1200,900 --dump-dom <url>`
  - Truque usado: gerar um `_test.html` temporário que injeta um estado em `localStorage` e imprime um `<pre id="report">` no DOM; ler com `--dump-dom`. **Remover o `_test.html` depois.**
- Testar em várias larguras (ex.: 1200, 820, 560, 500) para garantir que não há overflow horizontal.

## Busca automática (ponte local)
- `scripts/buscar-leads.mjs` sobe uma ponte em `http://127.0.0.1:4176` (apenas loopback) com CORS para o Pages e para `localhost:4174`.
- Atalho: duplo clique em `Abrir busca automatica.command`. O código de acesso é gravado em `~/.praca-crm-bridge-token` (nunca versionar).
- A ponte roda `opencode run --format json --auto --dir "<projeto>" <prompt>` no projeto `pesquisa de leads avançada` (websearch do OpenCode), extrai a tabela Markdown e devolve ao CRM.
- No app, a aba Prompt tem a caixa "Pesquisa automática" (endereço + código salvos só no `localStorage`). O botão "Pesquisar e importar" reaproveita `parseTable` + `importTable`, então duplicados caem na revisão.
- Não colocar a chave `oc_sk_...` no código: a API de inferência do OpenCode não faz busca na web e a conta precisa de saldo. A busca real vem do OpenCode local.
- Config por env: `PRACA_PROJECT_DIR`, `PRACA_BRIDGE_MODEL`, `PRACA_BRIDGE_TIMEOUT_SEC`, `PRACA_ALLOWED_ORIGINS`, `PRACA_BRIDGE_PORT`.

## Publicar (só com confirmação explícita)
1. `git add` + commit pequeno com mensagem clara.
2. `git push origin HEAD:main` (o branch de trabalho costuma ser `codex/...`; publica direto no `main`).
3. Acompanhar o run: `gh run list --repo arturflipp/praca-crm --workflow pages.yml --limit 1`
   e `gh run view <id> --repo arturflipp/praca-crm --json status,conclusion`.
4. Verificar o site no ar (cache-bust): `curl -s "https://arturflipp.github.io/praca-crm/index.html?cb=<timestamp>"`.
- Site: `https://arturflipp.github.io/praca-crm/`
- Repo: `https://github.com/arturflipp/praca-crm` (público)

## Cache-bust
- `index.html` referencia `styles.css?v=NN` e `app.js?v=NN`. **Incrementar o número a cada publicação** de HTML/CSS/JS para evitar cache antigo no navegador.

## Modelo de dados (resumo)
- `state.leads[]`: cada lead tem `statusHistory` (`[{at, from, to}]`) para métricas por dia.
- `state.sales[]`: várias vendas por lead (`leadId`, `valueCents`, `soldAt`, `notes`, `valuePending`).
- Status possíveis: `Novo, Mandei, Respondeu, Proposta, Vendido, Sem resposta, Recusa`
  - `Vendido` exige valor de venda; ao sair de `Vendido`, o app pergunta se mantém ou exclui a(s) venda(s).
  - Legado: `Fechou` é migrado para `Vendido` (`LEGACY_SOLD_STATUS`).
- `_schemaVersion` controla migrações (`migrateState`).
- Relatórios: "mensagem enviada" conta status de contato; "Aguardando resposta" = mensagens − respostas − recusas − sem resposta.

## Segurança
- Só a chave **publishable** do Supabase pode aparecer no código. Nunca colocar `service_role`.
- Dados do CRM ficam no Supabase (RLS), não no GitHub.

## Convenções
- Sem comentários no código, a menos que pedido.
- Manter o estilo existente (JS com funções declarativas, sem classes; CSS em uma linha por regra quando já estiver assim).
- Responder em português; o usuário é leigo em programação, explique antes de agir.
