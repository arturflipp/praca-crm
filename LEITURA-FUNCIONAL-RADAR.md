# Levantamento funcional — Radar / Dono da Praça

**Observado em:** 18/10/2026, na sessão autenticada aberta no Chrome.  
**Escopo:** inspeção manual das cinco áreas visíveis e dos formulários acessíveis. O objetivo é reproduzir os fluxos de trabalho em uma aplicação local, sem depender dos serviços da ferramenta original.

## Resumo do produto

O Radar é um painel leve de prospecção e gestão de vendas de placas NFC/QR para avaliações no Google. O fluxo central é:

1. Criar uma lista de comércios a partir de pesquisa assistida por IA ou cadastro manual.
2. Acompanhar cada comércio em etapas de um funil.
3. Gerar/copiar mensagens e materiais de apoio conforme o estágio da conversa.
4. Registrar vendas, estoque e despesas para calcular faturamento e lucro.

A interface tem cinco áreas fixas na navegação inferior: **Início, Captar, Mensagens, Caixa e Placa**. Há um aviso de teste com limite de 20 comércios e tempo restante; durante a inspeção indicava 14 comércios e pouco mais de oito horas. O aviso oferece acesso aos planos.

## 1. Início

- Cartão de próximo passo calculado a partir do estado da lista; exemplo: quantos leads ainda não foram contatados e meta diária de 15 abordagens.
- Guia de primeiros passos com seis itens e botões “Mostrar onde”; acompanha progresso. A tela marcou o passo de diagnóstico como concluído depois que o card foi aberto durante a inspeção.
- Indicadores do dia: abordagens, respostas e vendas.
- Estoque disponível com atalho para lançar lote.
- Funil resumido com contagem em: na lista, chamei, responderam, proposta e fecharam; também indica sem resposta.
- Orientação textual para diagnosticar onde a prospecção está travando.
- Desafio de 14 dias, com placar derivado dos estados “Mandei” e “Respondeu”.
- Configuração do vendedor: nome e cidade, usados para personalizar mensagens.
- Catálogo editável de produtos: nome e preço por modelo; os modelos podem ser removidos, acrescentados individualmente ou por atalhos de kit e adesivo QR. A tela mostra “Salvo” após edição, indicando gravação automática.
- Ações no cabeçalho: **Card pra story** e **Backup**.

### Card pra story

Abre uma prévia para compartilhar uma imagem com métricas dos últimos sete dias, número de placas vendidas, abordagens e estoque. Há uma opção para mostrar o lucro da semana e a orientação para tirar um print e publicar no grupo ou story.

### Backup

Abre um campo de texto com JSON da conta e botões **Copiar**, **Restaurar** e **Fechar**. A explicação diz que os dados ficam salvos na conta e abrem em outros dispositivos; o mecanismo de restauração é apresentado como forma de importar backup do Radar antigo. O backup observado contém configurações/produtos, progresso do guia, leads e arrays de estoque, canais, gastos e vendas. Não testar restauração sem cópia e confirmação explícita, pois pode sobrescrever dados.

## 2. Captar

### Gerador de prompt

- Campos: categoria e bairro/cidade.
- Prompt instruindo um assistente externo a usar busca na web e encontrar de 12 a 20 comércios reais, telefone, avaliações, nota, concorrente mais avaliado e mensagem inicial.
- Saída solicitada em tabela Markdown com colunas fixas e ordenação pelo gap de avaliações. Regras enfatizam não inventar dados e marcar “não encontrado” quando faltar informação.
- Botão para copiar o prompt e atalhos para abrir Claude e ChatGPT.
- Aviso para ativar pesquisa na web e conferir os números no Google.

### Importação da resposta

- Área para colar uma tabela, botão de colar da área de transferência e **Adicionar à lista** para interpretar cada linha e criar leads.
- Texto indica que a ferramenta separa cada comércio automaticamente.
- Também existe **+ Adicionar um na mão**.

### Cadastro manual/edição do comércio

Campos observados: nome do comércio, WhatsApp com DDD, categoria, quantidade de avaliações, nome do concorrente e quantidade de avaliações do concorrente. A tela de edição mostra esses mesmos seis campos. A nota média e a mensagem sugerida existem no registro importado, mas não aparecem nesse formulário de edição.

### Lista e filtros

Filtros por Todos, Novo, Mandei, Respondeu, Proposta, Fechou e Sem resposta. Cada linha exibe nome, categoria/região, gap de avaliações e status. Não observei busca textual nem ordenação explícita nessa tela.

### Detalhe de um comércio

- Resumo dos dados: categoria/região, avaliações do lead, concorrente e avaliações dele, telefone.
- Status alterável entre Novo, Mandei, Respondeu, Proposta, Fechou e Sem resposta.
- Campo editável com a mensagem sugerida pela IA e botão Copiar.
- Atalho para Mensagens e link de WhatsApp.
- **Card de diagnóstico** abre prévia de imagem “você x concorrente”, com aviso para só enviar depois que o comércio responder e conferir os números no Google; ações para salvar imagem e compartilhar.
- **Editar** abre o formulário de seis campos.
- **Fechou → lançar no Caixa** liga o fechamento do lead ao registro de uma venda.
- **Apagar** existe no detalhe; não foi acionado.

## 3. Mensagens

- Seletor de comércio, além de opção genérica sem comércio.
- Exibe o telefone e compõe a primeira mensagem a partir de nome/cidade do vendedor, comércio, elogio a ser pesquisado, avaliações do lead e concorrente. Há variante “sem concorrente”.
- A mensagem é editável e pode ser copiada; há link para abrir WhatsApp. A recomendação é completar o elogio com base em avaliações verdadeiras, enviar só texto no primeiro contato e esperar resposta.
- Material de apoio em acordeões, com orientação e exemplos adaptáveis, cada exemplo com campo editável, botão Copiar e atalho de WhatsApp.

### Tópicos do material de apoio

- **Ele respondeu:** demonstração da placa, pergunta curta após vídeo, prova física/foto instalada e prova numérica somente quando real.
- **Falar de preço:** modelos e preços são montados a partir do catálogo do vendedor; argumentação de valor antes do preço e pergunta de escolha.
- **Objeções:** “tá caro”, já pede avaliações, “vou pensar”, compatibilidade com celular, avaliação negativa, pedido de e-mail/retorno e falta de interesse. Há alertas para não afirmar que a placa filtra avaliações negativas e para respeitar as políticas do Google.
- **Follow-up e indicação:** contatos conhecidos/indicação, 2 e 5 dias sem resposta, retomada em 30 dias com caso novo e pedido de indicação 15 dias após entrega.
- **Entrega:** confirmação, contato no dia, teste da placa e registro de foto/avaliações depois da instalação.
- **Depois da placa:** oferecer serviços posteriores (ex.: perfil Google, site, cardápio digital e respostas a avaliações), com orientação para obter autorização antes de publicar prova.

## 4. Caixa

- Filtros de período: Hoje, 7 dias, 30 dias, Este mês e Tudo.
- Indicadores: faturamento, lucro líquido, margem, custo das placas, gastos, número de vendas, placas vendidas e preço médio.
- Gráficos/seções: faturamento por dia e lucro por canal.
- Lista de vendas, estoque/lotes e gastos; estados vazios explicam como criar lançamentos.
- **+ Lançar** abre escolha de Venda, Lote comprado ou Gasto.

### Nova venda

Campos/controles observados: modelo(s) do catálogo, quantidade de placas, preço por placa, total calculado, canal, data e cliente. Canais iniciais: WhatsApp, Porta a porta, Anúncio e Mercado Livre; há opção **+ outro**. Ação final: Salvar venda.

### Lote comprado

Quantidade de placas, custo total ou custo por placa (com custo unitário calculado), data e observação opcional. A tela informa que o estoque e o custo por placa são atualizados e usados no cálculo de lucro.

### Novo gasto

Valor, descrição, canal opcional, data. Usa os mesmos canais padrão e permite acrescentar outro. Categorias sugeridas no texto: anúncio, frete, taxa e embalagem.

## 5. Placa

- Tabela de referência de compra por quantidade, custo por placa, preço sugerido de venda e lucro por placa.
- Links externos para loja de placas com cupom e contato de suporte por WhatsApp.
- Atalho para lançar estoque.
- Kit de prova com links para vídeos de demonstração/prova e imagens de entrega/depoimento.
- Orientação de quando usar cada material e para substituir imagens de terceiros pelas fotos da própria entrega.
- Seção de venda posterior após instalação, com ideias de serviços complementares.

## Modelo de dados funcional sugerido

- **Configuração:** nome, cidade, catálogo de produtos (id, nome, preço e quantidade em estoque).
- **Lead:** nome, telefone, categoria, região, avaliações, nota, concorrente, avaliações do concorrente, mensagem sugerida, status, data de criação e histórico de interação.
- **Venda:** produtos/modelos, quantidade, preço unitário, total, canal, data e cliente/lead associado.
- **Lote:** quantidade, custo total/unitário, data e observação.
- **Gasto:** valor, descrição, canal e data.
- **Canal:** lista padrão editável com opção de adicionar outros.
- **Progresso:** tarefas do guia e métricas derivadas por dia/período.

Os campos de mensagem/histórico e os dados de caixa são preservados no JSON de backup. Para a versão local, eu recomendaria persistência local, exportação/importação JSON e métricas calculadas a partir de vendas, gastos e lotes.

## Limites da inspeção

- Isto registra o comportamento visível na interface autenticada; não é uma inspeção do código-fonte ou do backend.
- Não foram enviados WhatsApps, salvas vendas/lotes/gastos, importada nova lista nem acionada a restauração ou exclusão.
- A abertura do card de diagnóstico atualizou o progresso do guia na própria conta (de 2/6 para 3/6); os outros dados de negócio permaneceram sem lançamentos. Um modelo de produto vazio criado ao inspecionar o botão de adicionar foi removido imediatamente.
- Ainda faltaria, numa segunda passagem, validar a interpretação real de diferentes formatos de tabela, o comportamento de “sem concorrente”, compatibilidade mobile e os cálculos com dados de teste. Esses casos podem ser simulados na versão local sem mexer na conta original.

