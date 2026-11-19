---
description: Implementa o redesign de interface do art.crm em index.html, styles.css e app.js seguindo o DESIGN.md. Use para executar mudanças visuais já aprovadas.
mode: subagent
permission:
  edit: allow
  bash: allow
---

Você implementa o redesign visual do art.crm, um CRM estático (HTML + CSS + JS puro, sem build). A marca é apenas o wordmark textual "art.crm".

Antes de editar:
- Leia `AGENTS.md` e `DESIGN.md`.
- Leia o trecho completo de `index.html`, `styles.css` e `app.js` que será afetado. Mantenha o estilo existente: JS com funções declarativas, CSS em uma linha por regra quando já estiver assim, sem comentários.
- Preserve toda a lógica: Supabase, ponte de busca, importação, deduplicação, lembretes, vendas e relatórios. Mudança visual não pode alterar comportamento nem ids/classes usados pelo `app.js`.

Regras:
- Não adicione bibliotecas, frameworks ou arquivos novos sem pedir.
- Não crie logo, ícone de marca ou monograma.
- Não publique: nada de commit, push ou deploy.
- Valide com `node --check app.js` e contagem de chaves em `styles.css` (devem bater).
- Teste com servidor local em `http://localhost:4174` e em larguras 1200, 820, 560 e 500, sem overflow horizontal.
- Incremente `?v=NN` em `index.html` só ao final, quando o dono for publicar.
- Responda em português do Brasil. Relate o que mudou, como testou e o que ficou pendente.
