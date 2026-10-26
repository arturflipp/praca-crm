(function () {
  "use strict";
  const STORAGE_KEY = "praca-crm-local-v1";
  const LEGACY_MIGRATED_KEY = "praca-crm-legacy-migrated-v1";
  const SIDEBAR_KEY = "praca-crm-sidebar-collapsed-v1";
  const LEAD_SORT_KEY = "praca-crm-lead-sort-v1";
  const THEME_KEY = "praca-crm-theme-v1";
  const SYNC_META_PREFIX = "praca-crm-sync-v1:";
  const USER_STATE_PREFIX = "praca-crm-user-v1:";
  const REVIEW_CACHE_KEY = "praca-crm-review-cache-v1";
  const REVIEW_CACHE_TTL = 1000 * 60 * 60 * 24 * 30;
  const REVIEW_REMOTE_ENDPOINT = "https://r.jina.ai/";
  const REVIEW_REDIRECT_CHECKER = "https://api.redirect-checker.net/?url=";
  const supabaseConfig = window.PRACA_CRM_SUPABASE || {};
  let supabase = null;
  let supabaseReadyPromise = null;
  const STATUSES = ["Novo", "Mandei", "Respondeu", "Proposta", "Vendido", "Sem resposta", "Recusa"];
  const SOLD_STATUS = "Vendido";
  const LEGACY_SOLD_STATUS = "Fechou";
  const OPEN_STATUSES = ["Novo", "Mandei", "Respondeu", "Proposta"];
  const CONTACTED_STATUSES = ["Mandei", "Respondeu", "Proposta", SOLD_STATUS, "Sem resposta", "Recusa"];
  const RESPONDED_STATUSES = ["Respondeu", "Proposta", SOLD_STATUS];
  const SCHEMA_VERSION = 2;
  const LEAD_SORTS = [
    ["recentes", "Mais recentes"],
    ["antigos", "Mais antigos"],
    ["nome-az", "Nome (A–Z)"],
    ["nome-za", "Nome (Z–A)"],
    ["categoria", "Categoria (A–Z)"],
    ["origem", "Origem da prospecção"],
    ["regiao", "Região"],
    ["status", "Status do pipeline"],
    ["nota", "Maior nota"],
    ["avaliacoes", "Mais avaliações"],
    ["gap", "Maior gap de avaliações"]
  ];
  const scriptStepsModel = [
    ["Primeira mensagem", "Oi, tudo bem? Vi o perfil da [nome do estabelecimento] no Google e achei o trabalho de vocês incrível! [Elogio personalizado]. Vocês ainda estão atendendo por este número?"],
    ["Apresentação da oportunidade", "Então, é porque eu trabalho com soluções para o Google e reparei que vocês estão com uma nota excelente, [nota] estrelas, mas ainda têm apenas [número] avaliações. Enquanto isso, outros [tipo de estabelecimento] aqui da região já estão com mais de [número] avaliações.\nE você sabe que hoje muita gente pesquisa no Google antes de escolher [o tipo de serviço ou estabelecimento], né? Um estabelecimento com mais avaliações pode transmitir mais confiança e ter uma vantagem na hora de conquistar clientes.\nAlém disso, a quantidade e a qualidade das avaliações contribuem para melhorar o posicionamento local no Google."],
    ["Apresentação da plaquinha", "Pensando nisso, nós desenvolvemos uma plaquinha que permite que o cliente aproxime o celular ou escaneie o QR Code e vá direto para a página de avaliação de vocês.\nAssim, quando você termina um atendimento, uma venda ou presta um serviço e percebe que o cliente gostou da experiência, pode pedir uma avaliação ali mesmo. Como o processo fica mais simples, a pessoa demora alguns segundos para escanear e fazer a avaliação, você aumenta as chances de conseguir mais avaliações, melhorando seu posicionamento do Google e atraindo mais clientes ao longo do tempo de forma orgânica.\n\nVou te mandar um vídeo rapidinho para você ver como ela funciona na prática, beleza?\n\n✅ Vantagens da plaquinha de avaliação do Google:\n📌 Praticidade: o cliente aproxima o celular ou escaneia o QR Code e vai direto para a página de avaliação.\n⭐ Mais avaliações: facilita o processo e incentiva mais clientes a compartilharem suas experiências.\n📍 Mais visibilidade: mais avaliações autênticas podem contribuir para melhorar o posicionamento local e ajudar mais pessoas a conhecerem seu negócio.\n🔧 Pronta para usar: já vai configurada para o perfil da sua empresa.\n💰 Sem mensalidade: você paga uma única vez, e a plaquinha é sua!\n🤝 Pagamento na entrega: você recebe a plaquinha pronta e paga na hora."],
    ["Caso a pessoa pergunte o preço", "Então, a plaquinha fica R$ 80, já configurada e pronta para usar, sem mensalidade nenhuma. Mas, pagando no Pix ou em dinheiro, consigo fazer por R$ 70 pra vocês. Também aceitamos cartão de crédito e débito, com parcelamento em até duas vezes. E você só paga na entrega! Se quiser, posso passar aí ainda hoje, configurar tudo e já deixar prontinha pra vocês usarem. O que acha?"],
    ["Caso a pessoa não pergunte o preço", "Então, a plaquinha fica R$ 80, já configurada e pronta para usar, sem mensalidade nenhuma. Mas, pagando no Pix ou em dinheiro, consigo fazer por R$ 70 pra vocês. Também aceitamos cartão de crédito e débito, com parcelamento em até duas vezes. E você só paga na entrega! Se quiser, posso passar aí ainda hoje, configurar tudo e já deixar prontinha pra vocês usarem. O que acha?"]
  ];
  const SCRIPT_STEP_TITLES = scriptStepsModel.map(function (step) { return step[0]; });
  const scriptModelText = scriptStepsModel.map(function (step, index) {
    const body = step[1].replace(/\n+/g, function (breaks) { return breaks.length > 1 ? " ⏎⏎ " : " ⏎ "; });
    return (index + 1) + ". " + step[0] + ": " + body;
  }).join(" ### ");
  const scriptRule = [
    "- Em vez de uma única mensagem de abertura, escreva o script COMPLETO de atendimento: são 5 mensagens de WhatsApp, nesta ordem, seguindo o modelo abaixo palavra por palavra. Adapte APENAS o que está entre colchetes, com os dados confirmados de cada comércio: [nome do estabelecimento], [Elogio personalizado], [nota], [número] de avaliações, [tipo de estabelecimento], [o tipo de serviço ou estabelecimento]. Não resuma, não reescreva e não \"melhore\" nenhuma outra frase; mantenha preços, emojis e pontuação exatamente como estão. Se faltar nota ou número de avaliações, adapte a frase para ficar natural sem inventar o valor.",
    "Para [Elogio personalizado], use um elogio curto e verdadeiro com base no que os clientes elogiam nas avaliações do comércio; se nada específico aparecer nos dados encontrados, retire os colchetes e deixe apenas o elogio que o modelo já traz.",
    "As linhas \"[ENVIAR O VÍDEO JUNTAMENTE COM A DESCRIÇÃO ABAIXO]\" e \"Follow-up alguns minutos depois.\" do modelo são instruções de envio para mim: NÃO coloque essas linhas dentro do texto das mensagens.",
    "Formato da célula Script: uma única linha na tabela. Separe as 5 mensagens com \" ### \", cada uma começando pelo número e o título com dois pontos, exatamente nesta ordem: \"1. Primeira mensagem:\", \"2. Apresentação da oportunidade:\", \"3. Apresentação da plaquinha:\", \"4. Caso a pessoa pergunte o preço:\", \"5. Caso a pessoa não pergunte o preço:\". Onde o modelo pula linha, escreva \" ⏎ \" (uma quebra) ou \" ⏎⏎ \" (linha em branco). Nunca use o caractere | dentro do script e nunca quebre a linha da célula.",
    "Modelo:",
    scriptModelText
  ].join("\n");
  const defaultPrompt = [
    "Você é meu assistente de prospecção. Eu vendo placas NFC/QR que facilitam o cliente deixar avaliação no Google para comércios locais.",
    "",
    "Use a busca na web. Busque [CATEGORIA] em [BAIRRO, CIDADE]. Traga de 20 a 30 comércios REAIS que tenham perfil no Google.",
    "",
    "Para cada comércio, encontre:",
    "- Nome",
    "- Telefone/WhatsApp (só os dígitos com DDD, ex: 13999990000; se não achar, escreva \"não encontrado\")",
    "- Link direto da ficha pública desse comércio no Google Maps (use a URL da ficha do estabelecimento; não use uma busca genérica nem invente o link; se não encontrar, escreva \"não encontrado\")",
    "- Número de avaliações no Google",
    "- Nota média",
    "- O concorrente direto MAIS avaliado da mesma categoria e região, e o número de avaliações dele",
    scriptRule,
    "",
    "ENTREGUE SOMENTE uma tabela markdown, sem texto antes ou depois, com exatamente estas colunas nesta ordem:",
    "| Comércio | Telefone | Link do Google | Avaliações | Nota | Concorrente | Avaliações do concorrente | Script |",
    "",
    "Ordene do maior para o menor gap (diferença entre as avaliações do concorrente e as do comércio). Os melhores leads são os que têm claramente menos avaliações que um concorrente próximo.",
    "",
    "Regras: use só dados que você encontrou na busca. Nunca invente número, telefone ou nome. Se não achar algum dado, escreva \"não encontrado\" na célula."
  ].join("\n");

  const DEFAULT_SITE_PROMPT = `Você é um designer e desenvolvedor web especializado em sites para negócios locais. Crie um site completo, moderno, rápido e responsivo para o comércio abaixo, usando os dados fornecidos e pesquisando o que faltar.

## 1. DADOS DO NEGÓCIO
{{DADOS_JSON}}

## 2. PESQUISA OBRIGATÓRIA
Use seu MCP de navegador (Chrome DevTools ou a ferramenta de navegação disponível) para abrir e ler:
- Ficha no Google Maps: {{GOOGLE_MAPS}}
- Instagram: {{INSTAGRAM_URL}}
- Site atual, se existir: {{SITE_ATUAL}}

O link do Google é a fonte principal. O Instagram é complementar. Se o MCP não estiver disponível, use busca na web e acesse as páginas públicas.

Extraia e confirme:
- Nome exato do negócio
- Endereço completo
- Horário de funcionamento
- Serviços ou produtos principais
- Diferenciais reais
- Faixa de preço, se pública
- Nota e número de avaliações
- O que os clientes mais elogiam nas avaliações
- Cores, logo e tom de voz da marca
- Fotos reais disponíveis apenas como referência

Regras:
- Use somente informações públicas e verificáveis.
- Não invente endereço, horário, preço, serviço, avaliação ou depoimento.
- Se algo não for encontrado, escreva [CONFIRMAR: ...] no local e liste no relatório final.
- Não copie textos do Instagram ou do Google literalmente; reescreva com suas palavras.

## 3. OBJETIVO DO SITE
Criar um site que:
- Apresente o negócio em menos de 10 segundos.
- Gere confiança com endereço, avaliações reais, fotos e horários.
- Leve o visitante para o WhatsApp ou para avaliar no Google.
- Funcione bem no celular.
- Seja fácil de publicar e manter, com HTML, CSS e JS puro, sem build.

## 4. ESTRUTURA OBRIGATÓRIA
Use esta estrutura, nesta ordem:
1. Cabeçalho fixo com logo ou nome, menu simples e botão de WhatsApp.
2. Hero com foto principal, nome, categoria, cidade, frase curta e dois botões: WhatsApp e Como chegar.
3. Sobre o negócio, com 2 a 3 parágrafos curtos.
4. Serviços ou produtos em cards, com 4 a 8 itens.
5. Diferenciais, com 3 a 5 itens e ícones simples.
6. Galeria de fotos, com 6 a 12 imagens.
7. Avaliações reais, com 3 a 6 trechos curtos, nome e nota, somente se existirem.
8. Localização e horários, com endereço, mapa incorporado e horários.
9. Chamada final para WhatsApp e para avaliar no Google.
10. Rodapé com nome, endereço, telefone clicável, Instagram, links e ano.
11. Botão flutuante de WhatsApp no celular.

Não adicione seções extras sem necessidade. Não use carrossel automático, pop-up ou animação pesada.

## 5. DESIGN
- Mobile-first, responsivo de 320px a 1440px.
- Use a paleta e a tipografia do nicho "{{CATEGORIA}}". Se o nicho não estiver na tabela, use a paleta padrão.
- No máximo 2 fontes. Use fontes do sistema ou Google Fonts com fallback.
- Contraste alto, textos legíveis e botões grandes no celular.
- Use CSS variables para cores, espaçamento e tipografia.
- Espaçamento consistente em múltiplos de 4 ou 8px.
- Nada de texto sobre imagem sem contraste ou botões pequenos.

Tabela de nichos:
- Barbearia: fundo escuro carvão, dourado ou cobre, tipografia display forte.
- Salão de beleza: tons claros, rosé ou dourado, tipografia elegante.
- Restaurante: tons quentes como vermelho, creme e marrom, fotos grandes.
- Clínica ou odontologia: branco, azul ou verde suave, tipografia limpa.
- Pet: verde ou azul alegre, formas arredondadas, tom divertido.
- Academia: preto ou carvão, verde-limão ou laranja, tipografia forte.
- Loja: neutro claro, cor de destaque da marca, cards de produto.
- Padrão: verde escuro, creme e branco, tipografia sóbria.

## 6. CONTEÚDO E TOM
- Português do Brasil, claro e direto.
- Fale com o cliente do comércio, não com o dono.
- Destaque benefícios reais, não adjetivos vazios.
- Não prometa resultados, não invente números e não use "o melhor da cidade" sem fonte.
- Use o nome do negócio e a cidade nas primeiras frases.
- Evite textos longos: no máximo 3 parágrafos por seção.

## 7. LINKS E BOTÕES
- WhatsApp: {{WHATSAPP_LINK}} com mensagem neutra, sem script de vendas.
- Avaliar no Google: {{REVIEW_LINK}}
- Google Maps: {{GOOGLE_MAPS}}
- Instagram: {{INSTAGRAM_URL}}
- Site atual: {{SITE_ATUAL}}
- Links extras: {{LINKS_EXTRAS}}
- Se um link estiver vazio ou "não informado", não crie botão quebrado. Omita o botão ou use o link do Maps quando fizer sentido.
- O botão de WhatsApp deve estar no cabeçalho, no hero e no final.
- O botão Avaliar no Google deve aparecer pelo menos no final e na seção de avaliações.

## 8. IMAGENS
- Use apenas imagens fornecidas por mim na pasta {{PASTA_IMAGENS}}.
- Não baixe, não copie e não use hotlink de imagens do Google Maps ou do Instagram.
- Se a pasta estiver vazia ou indisponível, use placeholders locais com fundo neutro e o texto "Foto do negócio".
- Crie uma lista de imagens necessárias com nome do arquivo, seção, proporção e texto alternativo.
- Toda imagem precisa de alt descritivo, width, height e loading="lazy", exceto a do hero.
- Otimize para WebP quando possível, sem perder qualidade.

## 9. SEO, ACESSIBILIDADE E PERFORMANCE
- Title e meta description com nome, categoria e cidade.
- Open Graph e Twitter Card.
- JSON-LD LocalBusiness com nome, endereço, telefone, horário, sameAs para Instagram e Google Maps, e aggregateRating somente se verificado.
- HTML semântico, foco visível, labels e contraste adequado.
- Não use bibliotecas pesadas. Se precisar de JS, use no máximo um arquivo pequeno.
- Meta viewport, favicon e canonical.
- O site deve funcionar ao abrir localmente.

## 10. ENTREGA
Crie os arquivos em {{PASTA_PROJETO}}:
- index.html
- styles.css
- assets/ com imagens e ícones
- README.md com instruções para abrir, editar e publicar

Regras:
- Não altere arquivos fora dessa pasta.
- Não publique, não faça deploy e não envie nada para a internet.
- Não use backend, banco de dados, login ou variáveis secretas.
- Não inclua o nome do meu CRM nem a venda de placas NFC.
- Se faltar alguma informação essencial, use [CONFIRMAR: ...] e siga com o restante.

## 11. RELATÓRIO FINAL
Ao terminar, entregue:
1. Resumo do que foi criado.
2. Dados encontrados no Google e no Instagram, com as fontes.
3. Dados não encontrados ou que precisam de confirmação.
4. Lista de imagens necessárias e onde cada uma entra.
5. Como abrir o site localmente.
6. Como publicar no Netlify Drop, Vercel ou GitHub Pages.
7. O que eu devo revisar antes de publicar.`;

  const DEFAULT_BIO_PROMPT = `Você é um designer e desenvolvedor web especializado em bio sites, no estilo link na bio, para negócios locais. Crie uma página única, moderna, rápida e mobile-first para o comércio abaixo.

## 1. DADOS DO NEGÓCIO
{{DADOS_JSON}}

## 2. PESQUISA OBRIGATÓRIA
Use seu MCP de navegador para abrir:
- Google Maps: {{GOOGLE_MAPS}}
- Instagram: {{INSTAGRAM_URL}}
- Site atual: {{SITE_ATUAL}}

Confirme nome, categoria, endereço, horário, telefone, nota, avaliações, serviços principais, cores e tom da marca. Não invente nada. Se faltar, use [CONFIRMAR: ...].

## 3. ESTRUTURA OBRIGATÓRIA
Página única, nesta ordem:
1. Topo com logo ou foto principal, nome, categoria e uma frase curta.
2. Botões grandes, um abaixo do outro:
   - WhatsApp
   - Avaliar no Google
   - Como chegar no Google Maps
   - Instagram
   - Site, se existir
   - Links extras
3. Bloco curto "Sobre", com 2 a 3 linhas.
4. Serviços principais em lista curta, se fizer sentido.
5. Horário de funcionamento, se confirmado.
6. Rodapé com nome, cidade e ano.

Não adicione menu, carrossel, pop-up ou várias páginas.

## 4. DESIGN
- Mobile-first, largura máxima de 520px, centralizado no desktop.
- Use a paleta e a tipografia do nicho "{{CATEGORIA}}". Padrão: verde escuro, creme e branco.
- Botões com no mínimo 48px de altura, contraste alto e ícones simples.
- No máximo 2 fontes. Use CSS variables. Sem bibliotecas pesadas.
- Visual limpo, com bastante espaço em branco.

## 5. LINKS E AÇÕES
- WhatsApp: {{WHATSAPP_LINK}} com mensagem neutra.
- Avaliar no Google: {{REVIEW_LINK}}
- Google Maps: {{GOOGLE_MAPS}}
- Instagram: {{INSTAGRAM_URL}}
- Site: {{SITE_ATUAL}}
- Links extras: {{LINKS_EXTRAS}}
- Se um link estiver vazio, omita o botão. Não crie link quebrado.

## 6. IMAGENS
- Use apenas imagens da pasta {{PASTA_IMAGENS}}.
- Não baixe nem use hotlink do Google ou do Instagram.
- Se não houver imagem, use um placeholder neutro com a inicial do negócio.
- Use alt descritivo e otimize para WebP.

## 7. SEO E ACESSIBILIDADE
- Title e meta description com nome, categoria e cidade.
- Open Graph com imagem.
- JSON-LD LocalBusiness.
- HTML semântico, foco visível e contraste adequado.

## 8. ENTREGA
Crie em {{PASTA_PROJETO}}:
- index.html
- styles.css
- assets/
- README.md

Não altere outros arquivos. Não publique. Sem backend e sem segredos. Não inclua o meu CRM nem a venda de placas NFC.

## 9. RELATÓRIO FINAL
Liste o que foi criado, os dados encontrados, os dados a confirmar, as imagens necessárias e como publicar.`;

  const DEFAULT_IMAGE_PROMPT = `Você já criou o site em {{PASTA_PROJETO}}. Agora atualize apenas as imagens.

## 1. PASTA DAS IMAGENS
As imagens estão em: {{PASTA_IMAGENS}}

## 2. O QUE FAZER
1. Liste os arquivos da pasta.
2. Identifique o conteúdo de cada imagem: logo, fachada, interior, equipe, produto, serviço, antes e depois.
3. Substitua os placeholders e as imagens atuais pelas imagens correspondentes.
4. Se houver imagens extras, adicione à galeria sem quebrar o layout.
5. Mantenha a proporção, o enquadramento e a qualidade.
6. Otimize para WebP quando possível.
7. Atualize o alt de cada imagem com uma descrição real.
8. Atualize o README com a lista de imagens usadas.

## 3. REGRAS
- Não altere textos, links, layout, cores ou fontes.
- Não remova seções.
- Não baixe imagens do Google ou do Instagram.
- Se faltar alguma imagem, mantenha o placeholder e liste o que falta.
- Não publique e não faça deploy.

## 4. RELATÓRIO
Liste as imagens usadas, as que faltaram e o que eu devo revisar.`;

  const PROMPT_TEMPLATE_KINDS = ["site", "bio", "image"];
  const PROMPT_TEMPLATE_DEFAULTS = { site: DEFAULT_SITE_PROMPT, bio: DEFAULT_BIO_PROMPT, image: DEFAULT_IMAGE_PROMPT };
  const PROMPT_TEMPLATE_LABELS = { site: "Site completo", bio: "Bio site", image: "Atualização de imagens" };
  const PROMPT_TEMPLATE_TOKENS = [
    ["{{DADOS_JSON}}", "Bloco JSON com todos os dados do lead"],
    ["{{NOME}}", "Nome do comércio"],
    ["{{CATEGORIA}}", "Categoria do negócio"],
    ["{{BAIRRO_CIDADE}}", "Bairro e cidade"],
    ["{{TELEFONE}}", "Telefone com DDD"],
    ["{{WHATSAPP_LINK}}", "Link do WhatsApp com mensagem neutra"],
    ["{{GOOGLE_MAPS}}", "Link da ficha no Google Maps"],
    ["{{INSTAGRAM}}", "Perfil informado do Instagram"],
    ["{{INSTAGRAM_URL}}", "URL completa do Instagram"],
    ["{{REVIEW_LINK}}", "Link para avaliar no Google"],
    ["{{SITE_ATUAL}}", "Site atual do comércio"],
    ["{{NOTA}}", "Nota média no Google"],
    ["{{AVALIACOES}}", "Número de avaliações"],
    ["{{LINKS_EXTRAS}}", "Lista de links extras"],
    ["{{PASTA_PROJETO}}", "Pasta onde o site será criado"],
    ["{{PASTA_IMAGENS}}", "Pasta das imagens"],
    ["{{DATA}}", "Data de geração"]
  ];
  const PROMPT_REQUIRED_TOKENS = {
    site: ["{{DADOS_JSON}}", "{{CATEGORIA}}", "{{GOOGLE_MAPS}}", "{{PASTA_PROJETO}}"],
    bio: ["{{DADOS_JSON}}", "{{CATEGORIA}}", "{{GOOGLE_MAPS}}", "{{PASTA_PROJETO}}"],
    image: ["{{PASTA_PROJETO}}", "{{PASTA_IMAGENS}}"]
  };
  const SAMPLE_LEAD = {
    id: "__sample__",
    name: "Barbearia Exemplo",
    category: "Barbearia",
    location: "Centro, Santos",
    phone: "13999990000",
    googleUrl: "https://maps.app.goo.gl/exemplo",
    instagram: "@barbeariaexemplo",
    reviewUrl: "https://search.google.com/local/writereview?placeid=EXEMPLO",
    website: "https://barbeariaexemplo.com.br",
    rating: "4,8",
    reviews: "127",
    links: [{ label: "Tabela de preços", url: "https://barbeariaexemplo.com.br/precos" }],
    siteProjectFolder: "sites/barbearia-exemplo",
    siteImagesFolder: "sites/barbearia-exemplo/assets"
  };

  function defaultPromptTemplates() {
    const templates = {};
    PROMPT_TEMPLATE_KINDS.forEach(function (key) {
      templates[key] = { text: PROMPT_TEMPLATE_DEFAULTS[key], updatedAt: "" };
    });
    return templates;
  }
  function normalizePromptTemplates(value) {
    const source = value && typeof value === "object" ? value : {};
    const templates = {};
    PROMPT_TEMPLATE_KINDS.forEach(function (key) {
      const item = source[key];
      if (item && typeof item === "object" && typeof item.text === "string" && item.text.trim()) {
        templates[key] = { text: item.text, updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "" };
      } else if (typeof item === "string" && item.trim()) {
        templates[key] = { text: item, updatedAt: "" };
      } else {
        templates[key] = { text: PROMPT_TEMPLATE_DEFAULTS[key], updatedAt: "" };
      }
    });
    return templates;
  }
  function mergePromptTemplates(localTemplates, remoteTemplates) {
    const local = normalizePromptTemplates(localTemplates);
    const remote = normalizePromptTemplates(remoteTemplates);
    const merged = {};
    PROMPT_TEMPLATE_KINDS.forEach(function (key) {
      const localAt = Date.parse(local[key].updatedAt || "") || 0;
      const remoteAt = Date.parse(remote[key].updatedAt || "") || 0;
      merged[key] = localAt > remoteAt ? local[key] : remote[key];
    });
    return merged;
  }
  function promptTemplateSignature(templates) {
    const source = templates && typeof templates === "object" ? templates : {};
    return PROMPT_TEMPLATE_KINDS.map(function (key) {
      const item = source[key];
      if (item && typeof item === "object") return String(item.text || "");
      return typeof item === "string" ? item : "";
    });
  }
  function promptTemplateText(kind) {
    const templates = state.promptTemplates && typeof state.promptTemplates === "object" ? state.promptTemplates : null;
    const item = templates ? templates[kind] : null;
    return item && typeof item.text === "string" && item.text.trim() ? item.text : PROMPT_TEMPLATE_DEFAULTS[kind] || DEFAULT_SITE_PROMPT;
  }
  function slugify(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "site";
  }
  function normalizeUrlValue(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^https?:\/\//i.test(text)) return text;
    if (/^[\w.-]+\.[a-z]{2,}(?:\/|$)/i.test(text)) return "https://" + text;
    return text;
  }
  function instagramProfileUrl(value) {
    let text = String(value || "").trim();
    if (!text) return "";
    if (/^https?:\/\//i.test(text)) return text;
    if (/^(www\.)?instagram\.com\//i.test(text)) return "https://" + text.replace(/^\/+/, "");
    text = text.replace(/^@+/, "").replace(/\/+$/, "");
    if (!text) return "";
    return "https://instagram.com/" + encodeURIComponent(text);
  }
  function siteWhatsAppHref(phone) {
    const number = digits(phone);
    if (!number) return "";
    const international = number.indexOf("55") === 0 ? number : "55" + number;
    return "https://wa.me/" + international + "?text=" + encodeURIComponent("Olá! Vim pelo site e gostaria de mais informações.");
  }
  function parseMapsHexPair(value) {
    const match = String(value || "").trim().match(/^(0x[0-9a-f]{1,16}):(0x[0-9a-f]{1,16})$/i);
    return match ? { a: match[1], b: match[2] } : null;
  }
  function hexToLittleEndianBytes(value) {
    let number = BigInt(value);
    const bytes = new Uint8Array(8);
    for (let index = 0; index < 8; index += 1) {
      bytes[index] = Number(number & 255n);
      number >>= 8n;
    }
    return bytes;
  }
  function mapsHexPairToPlaceId(a, b) {
    const bytes = new Uint8Array(20);
    bytes[0] = 0x0a;
    bytes[1] = 0x12;
    bytes[2] = 0x09;
    bytes.set(hexToLittleEndianBytes(a), 3);
    bytes[11] = 0x11;
    bytes.set(hexToLittleEndianBytes(b), 12);
    let binary = "";
    bytes.forEach(function (byte) { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function looksLikeGooglePlaceId(value) {
    const text = String(value || "").trim();
    if (!text || /\s/.test(text) || /^https?:\/\//i.test(text) || /^0x/i.test(text)) return false;
    return /^ChIJ[A-Za-z0-9_-]{10,}$/.test(text) || /^Ci[A-Za-z0-9_-]{10,}$/.test(text) || /^[A-Za-z0-9_-]{20,}$/.test(text);
  }
  function mapsNameFromUrl(url) {
    const match = url.pathname.match(/\/maps\/place\/([^/]+)/i);
    if (match && match[1]) {
      try { return decodeURIComponent(match[1].replace(/\+/g, " ")).trim(); } catch (_) { return match[1].trim(); }
    }
    const query = url.searchParams.get("q") || url.searchParams.get("query") || "";
    if (query && !/^place_id:/i.test(query)) {
      try { return decodeURIComponent(query.replace(/\+/g, " ")).trim(); } catch (_) { return query.trim(); }
    }
    return "";
  }
  function isShortMapsUrl(url) {
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host === "maps.app.goo.gl" || (host === "goo.gl" && /^\/maps(?:\/|$)/i.test(url.pathname));
  }
  function isGoogleMapsUrl(url) {
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "maps.app.goo.gl" || host === "goo.gl" || host === "g.page" || host === "maps.google.com") return true;
    if (host === "search.google.com") return /\/local\/(?:writereview|reviews)/i.test(url.pathname);
    return /(^|\.)google\.[a-z]{2,3}(?:\.[a-z]{2})?$/i.test(host) && /\/maps(?:\/|$)/i.test(url.pathname);
  }
  function extractMapsFeaturePair(text) {
    const source = String(text || "");
    const direct = source.match(/(?:!1s|ftid=)(0x[0-9a-f]{1,16}):(0x[0-9a-f]{1,16})/i);
    if (direct) return { a: direct[1], b: direct[2] };
    const general = source.match(/(0x[0-9a-f]{6,16}):(0x[0-9a-f]{6,16})/i);
    return general ? { a: general[1], b: general[2] } : null;
  }
  function extractPlaceIdFromMapsInput(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    if (looksLikeGooglePlaceId(raw)) return { placeId: raw, name: "", source: "place-id" };
    const rawPair = parseMapsHexPair(raw);
    if (rawPair) return { placeId: mapsHexPairToPlaceId(rawPair.a, rawPair.b), name: "", source: "feature-id" };
    let url;
    try { url = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw); } catch (_) { return null; }
    if (!isGoogleMapsUrl(url)) return null;
    const placeParams = ["placeid", "place_id", "query_place_id"];
    for (let index = 0; index < placeParams.length; index += 1) {
      const key = placeParams[index];
      const param = url.searchParams.get(key);
      if (!param) continue;
      const pair = parseMapsHexPair(param);
      if (pair) return { placeId: mapsHexPairToPlaceId(pair.a, pair.b), name: mapsNameFromUrl(url), source: key === "placeid" ? "review-url" : "url" };
      if (looksLikeGooglePlaceId(param)) return { placeId: param.trim(), name: mapsNameFromUrl(url), source: "url" };
    }
    const ftid = url.searchParams.get("ftid");
    if (ftid) {
      const pair = parseMapsHexPair(ftid);
      if (pair) return { placeId: mapsHexPairToPlaceId(pair.a, pair.b), name: mapsNameFromUrl(url), source: "url" };
    }
    let decoded = "";
    try { decoded = decodeURIComponent(url.pathname + url.search + url.hash); } catch (_) { decoded = url.pathname + url.search + url.hash; }
    const pair = extractMapsFeaturePair(decoded);
    if (pair) return { placeId: mapsHexPairToPlaceId(pair.a, pair.b), name: mapsNameFromUrl(url), source: "url" };
    const query = url.searchParams.get("q") || url.searchParams.get("query") || "";
    const queryPlace = query.match(/place_id\s*:\s*([A-Za-z0-9_-]+)/i);
    if (queryPlace) return { placeId: queryPlace[1], name: mapsNameFromUrl(url), source: "url" };
    if (/\/maps\/search\//i.test(url.pathname) || (!/\/maps\/place\//i.test(url.pathname) && /\/maps\/@/i.test(url.pathname))) {
      return { placeId: "", name: mapsNameFromUrl(url), error: "Use a URL da ficha de um comércio, não uma busca do Google Maps." };
    }
    return { placeId: "", name: mapsNameFromUrl(url), unresolvedUrl: url.href, short: isShortMapsUrl(url), source: "unresolved" };
  }
  function reviewLinkForPlaceId(placeId) {
    return placeId ? "https://search.google.com/local/writereview?placeid=" + encodeURIComponent(placeId) : "";
  }
  function googlePlaceId(value) {
    const result = extractPlaceIdFromMapsInput(value);
    return result && result.placeId ? result.placeId : "";
  }
  function googleReviewUrl(value) {
    return reviewLinkForPlaceId(googlePlaceId(value));
  }
  function cleanMapsTitle(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text || /^google maps$/i.test(text)) return "";
    if (/^(?:https?:)?\/\//i.test(text) || /^0x[0-9a-f]+:/i.test(text) || /^ChIJ/i.test(text) || /%[0-9a-f]{2}/i.test(text)) return "";
    return text.split(" · ")[0].trim();
  }
  function readReviewCache(url) {
    if (!url) return null;
    try {
      const cache = JSON.parse(localStorage.getItem(REVIEW_CACHE_KEY) || "{}") || {};
      const item = cache[url];
      if (item && item.placeId && Date.now() - Number(item.at || 0) < REVIEW_CACHE_TTL) return item;
    } catch (_) {}
    return null;
  }
  function writeReviewCache(url, result) {
    if (!url || !result || !result.placeId) return;
    try {
      const cache = JSON.parse(localStorage.getItem(REVIEW_CACHE_KEY) || "{}") || {};
      cache[url] = { placeId: result.placeId, name: result.name || "", source: result.source || "resolved", at: Date.now() };
      const keys = Object.keys(cache);
      keys.forEach(function (key) {
        if (!cache[key] || Date.now() - Number(cache[key].at || 0) > REVIEW_CACHE_TTL) delete cache[key];
      });
      const remaining = Object.keys(cache);
      if (remaining.length > 80) {
        remaining.sort(function (a, b) { return Number(cache[a].at || 0) - Number(cache[b].at || 0); })
          .slice(0, remaining.length - 80)
          .forEach(function (key) { delete cache[key]; });
      }
      localStorage.setItem(REVIEW_CACHE_KEY, JSON.stringify(cache));
    } catch (_) {}
  }
  function reviewNameFromRedirect(value) {
    const text = String(value || "").replace(/\\\//g, "/").replace(/&amp;/gi, "&");
    const match = text.match(/\/maps\/place\/([^/@?]+)/i);
    if (!match) return "";
    try {
      return cleanMapsTitle(decodeURIComponent(match[1].replace(/\+/g, " ")));
    } catch (_) {
      return cleanMapsTitle(match[1].replace(/\+/g, " "));
    }
  }
  async function resolveReviewWithRemote(url) {
    let target = url;
    try {
      const parsed = new URL(url);
      if (isShortMapsUrl(parsed)) {
        parsed.searchParams.set("_imcp", "1");
        target = parsed.href;
      }
    } catch (_) {}
    const checker = REVIEW_REDIRECT_CHECKER + encodeURIComponent(target);
    const endpoint = REVIEW_REMOTE_ENDPOINT + checker;
    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, 20000);
    try {
      const response = await fetch(endpoint, { headers: { Accept: "text/plain" }, signal: controller.signal });
      if (!response.ok) return null;
      const text = await response.text();
      if (!text) return null;
      const pair = extractMapsFeaturePair(text);
      if (!pair) return null;
      const redirect = text.match(/"redirect_url":"([^"]+)"/);
      return { placeId: mapsHexPairToPlaceId(pair.a, pair.b), name: redirect ? reviewNameFromRedirect(redirect[1]) : "", source: "resolved" };
    } finally {
      clearTimeout(timeout);
    }
  }
  async function resolveReviewInput(value) {
    const direct = extractPlaceIdFromMapsInput(value);
    if (!direct) return { error: "Cole um link do Google Maps ou um Place ID." };
    if (direct.placeId || direct.reviewUrl) return direct;
    if (direct.error) return direct;
    const cached = readReviewCache(direct.unresolvedUrl);
    if (cached) return Object.assign({}, direct, cached);
    try {
      const remote = await resolveReviewWithRemote(direct.unresolvedUrl);
      if (remote) {
        writeReviewCache(direct.unresolvedUrl, remote);
        return Object.assign({}, direct, remote);
      }
    } catch (_) {}
    return Object.assign({}, direct, { needsManual: true });
  }
  function cleanLinks(links) {
    return (Array.isArray(links) ? links : []).filter(function (item) {
      return item && typeof item === "object" && String(item.label || "").trim() && String(item.url || "").trim();
    }).map(function (item) {
      return { label: String(item.label).trim(), url: normalizeUrlValue(item.url) };
    });
  }
  function formatExtraLinks(links) {
    const valid = cleanLinks(links);
    return valid.length ? valid.map(function (item) { return "- " + item.label + ": " + item.url; }).join("\n") : "nenhum";
  }
  function promptTokenValues(lead, options) {
    const source = lead && typeof lead === "object" ? lead : SAMPLE_LEAD;
    const settings = options && typeof options === "object" ? options : {};
    const projectFolder = String(settings.projectFolder || source.siteProjectFolder || ("sites/" + slugify(source.name))).trim();
    const imagesFolder = String(settings.imagesFolder || source.siteImagesFolder || (projectFolder + "/assets")).trim();
    const whatsappLink = siteWhatsAppHref(source.phone);
    const instagram = String(source.instagram || "").trim();
    const instagramUrl = instagramProfileUrl(instagram);
    const reviewLink = String(source.reviewUrl || "").trim() || googleReviewUrl(source.googleUrl);
    const links = cleanLinks(source.links);
    const data = {
      nome: String(source.name || ""),
      categoria: String(source.category || ""),
      bairroCidade: String(source.location || ""),
      telefone: String(source.phone || ""),
      whatsapp: whatsappLink,
      googleMaps: String(source.googleUrl || ""),
      instagram: instagram,
      instagramUrl: instagramUrl,
      linkAvaliacao: reviewLink,
      siteAtual: String(source.website || ""),
      nota: String(source.rating || ""),
      avaliacoes: String(source.reviews || ""),
      linksExtras: links,
      pastaProjeto: projectFolder,
      pastaImagens: imagesFolder,
      geradoEm: new Date().toISOString()
    };
    return {
      DADOS_JSON: "````json\n" + JSON.stringify(data, null, 2) + "\n````",
      NOME: data.nome || "não informado",
      CATEGORIA: data.categoria || "não informado",
      BAIRRO_CIDADE: data.bairroCidade || "não informado",
      TELEFONE: data.telefone || "não informado",
      WHATSAPP_LINK: whatsappLink || "não informado",
      GOOGLE_MAPS: data.googleMaps || "não informado",
      INSTAGRAM: instagram || "não informado",
      INSTAGRAM_URL: instagramUrl || "não informado",
      REVIEW_LINK: reviewLink || "não informado",
      SITE_ATUAL: data.siteAtual || "não informado",
      NOTA: data.nota || "não informado",
      AVALIACOES: data.avaliacoes || "não informado",
      LINKS_EXTRAS: formatExtraLinks(links),
      PASTA_PROJETO: projectFolder,
      PASTA_IMAGENS: imagesFolder,
      DATA: new Date().toLocaleDateString("pt-BR")
    };
  }
  function fillPromptTemplate(template, values) {
    return String(template || "").replace(/\{\{([A-Z0-9_]+)\}\}/g, function (match, key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match;
    });
  }
  function buildPromptText(kind, template, lead, options) {
    return fillPromptTemplate(template, promptTokenValues(lead, options));
  }

  function promptTemplate(text, category, location) {
    let template = String(text || "");
    if (category) template = template.split(category).join("[CATEGORIA]");
    if (location) template = template.split(location).join("[BAIRRO, CIDADE]");
    template = template.replace(/(Busque\s+)(.+?)(\s+em\s+)(.+?)(\.\s+Traga)/i, "$1[CATEGORIA]$3[BAIRRO, CIDADE]$5");
    return template;
  }
  const promptBlockMeta = [
    ["Papel e oferta", "Define quem a IA deve representar e qual é seu produto ou serviço."],
    ["Busca e quantidade", "Define a categoria, a região e quantos comércios procurar."],
    ["Dados de cada comércio", "Escolhe os campos que a pesquisa deve levantar para cada lead."],
    ["Script de abordagem", "Define o script completo de WhatsApp que a IA escreve para cada comércio, as 5 mensagens, seguindo seu modelo."],
    ["Formato da resposta", "Define como a IA entrega os dados para colar no CRM."],
    ["Prioridade dos leads", "Define como comparar e ordenar as oportunidades."],
    ["Regras de verificação", "Define o que precisa ser confirmado e o que fazer quando faltar dado."]
  ];
  function promptBlocksFromText(text) {
    return String(text || "").trim().split(/\n\s*\n/).filter(function (part) { return part.trim(); }).map(function (part, index) {
      const meta = promptBlockMeta[index] || ["Instrução extra " + (index - promptBlockMeta.length + 1), "Edite esta parte adicional do comando."];
      return { title: meta[0], help: meta[1], text: part.trim() };
    });
  }
  function composePrompt(blocks) {
    return (blocks || []).map(function (block) { return String(block.text || "").trim(); }).filter(Boolean).join("\n\n");
  }

  function newState() {
    return { promptCategory: "", promptLocation: "", promptText: defaultPrompt, promptBlocks: promptBlocksFromText(defaultPrompt), promptHistory: [], leads: [], reminders: [], sales: [], promptTemplates: defaultPromptTemplates(), _promptUpdatedAt: "", _schemaVersion: SCHEMA_VERSION };
  }
  function localDateKey(value) {
    const date = value instanceof Date ? value : value ? new Date(value) : new Date();
    if (!date || isNaN(date.getTime())) return "";
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }
  const SCRIPT_STEP_NOTES = {
    "Apresentação da plaquinha": "enviar o vídeo junto com esta mensagem",
    "Caso a pessoa não pergunte o preço": "enviar alguns minutos depois, se não receber resposta"
  };
  function normalizeScriptSteps(steps) {
    const clean = (Array.isArray(steps) ? steps : []).filter(function (step) {
      return step && typeof step === "object" && String(step.text || "").trim();
    }).map(function (step) {
      return { num: 0, title: String(step.title || "").trim() || "Mensagem", text: String(step.text || "").trim(), note: String(step.note || "").trim() };
    });
    return clean.map(function (step, index) {
      step.num = index + 1;
      return step;
    });
  }
  function scriptStepFromText(index, rawText, title) {
    let text = String(rawText || "").trim();
    let note = SCRIPT_STEP_NOTES[title] || "";
    const noteMatch = text.match(/^Nota:\s*([^.!?:]+[.!?:])\s*([\s\S]+)$/i);
    if (noteMatch) {
      note = noteMatch[1].trim();
      text = noteMatch[2].trim();
    }
    return { num: index + 1, title: title || SCRIPT_STEP_TITLES[index] || ("Mensagem " + (index + 1)), text: text, note: note };
  }
  const SCRIPT_CELL_SPLIT = /\s*###\s*|\s*\|\|\|\s*/;
  const SCRIPT_BLOCK_TITLE = /^\s*(?:\*\*|__)?\s*(?:(\d{1,2})\s*[.)]\s*)?(?:\*\*|__)?\s*([^:]{2,60}?):\s*(?:\*\*|__)?\s*([\s\S]*)$/;
  function cleanScriptMarkup(value) {
    return String(value == null ? "" : value).replace(/^[*_]+|[*_]+$/g, "").trim();
  }
  function knownScriptTitle(value) {
    const title = normalize(String(value == null ? "" : value).replace(/[*_]+/g, ""));
    return SCRIPT_STEP_TITLES.some(function (known) { return normalize(known) === title; }) ||
      /mensagem|abertura|follow|oportunidade|plaquinha|preco/.test(title);
  }
  function knownScriptLineTitle(value) {
    const title = String(value == null ? "" : value).replace(/^\s*\d{1,2}\s*[.)]\s*/, "").replace(/[*_]+/g, "").trim();
    return knownScriptTitle(title) && !/[,.?!]/.test(title) && !/\d\s*[.)]/.test(title);
  }
  function scriptPartsFromBlock(block) {
    const normalized = block.replace(/\s*⏎⏎\s*/g, "\n\n").replace(/\s*⏎\s*/g, "\n").replace(/<br\s*\/?\s*>/gi, "\n");
    const starts = [];
    const pattern = /\d{1,2}\s*[.)]\s*(?:\*\*|__)?\s*([^:]{2,60}?):/g;
    let match;
    while ((match = pattern.exec(normalized))) {
      if (/^\s*\d/.test(match[1])) {
        const inner = match[1].match(/\d{1,2}\s*[.)]/);
        if (inner) {
          pattern.lastIndex = match.index + match[0].indexOf(match[1]) + inner.index;
          continue;
        }
      }
      if (knownScriptTitle(match[1])) starts.push(match.index);
    }
    const linePattern = /^(?:\*\*|__)?\s*([^:\n]{2,60}?):/gm;
    while ((match = linePattern.exec(normalized))) {
      if (knownScriptLineTitle(match[1])) starts.push(match.index);
    }
    const ordered = starts.slice().sort(function (a, b) { return a - b; }).reduce(function (list, start) {
      if (!list.length) { list.push(start); return list; }
      const previous = list[list.length - 1];
      if (start === previous) return list;
      if (!/[a-z0-9]/i.test(normalized.slice(previous, start))) return list;
      list.push(start);
      return list;
    }, []);
    if (!ordered.length) return [normalized.trim()].filter(Boolean);
    if (ordered.length === 1) return [normalized.slice(ordered[0]).trim()].filter(Boolean);
    return ordered.map(function (start, index) {
      const end = index + 1 < ordered.length ? ordered[index + 1] : normalized.length;
      return normalized.slice(start, end).trim();
    }).filter(Boolean);
  }
  function looksLikeScript(value) {
    const text = String(value == null ? "" : value);
    if (/###|\|\|\||<br\s*\/?>|⏎/.test(text)) return true;
    const numbered = /\d{1,2}\s*[.)]\s*(?:\*\*|__)?\s*([^:]{2,60}?):/g;
    let match;
    while ((match = numbered.exec(text))) {
      if (!/^\s*\d/.test(match[1]) && knownScriptTitle(match[1])) return true;
    }
    const line = /^(?:\*\*|__)?\s*([^:\n]{2,60}?):/gm;
    while ((match = line.exec(text))) {
      if (knownScriptLineTitle(match[1])) return true;
    }
    return false;
  }
  function parseScriptCell(cell) {
    const blocks = String(cell || "").split(SCRIPT_CELL_SPLIT).map(function (part) { return part.trim(); }).filter(Boolean);
    const parts = [];
    blocks.forEach(function (block) {
      scriptPartsFromBlock(block).forEach(function (part) { parts.push(part); });
    });
    return parts.map(function (block, index) {
      const match = block.match(SCRIPT_BLOCK_TITLE);
      const title = match ? cleanScriptMarkup(match[2]) : "";
      const text = cleanScriptMarkup(match ? match[3] : block);
      return scriptStepFromText(index, text, title || undefined);
    }).filter(function (step) { return step.text; });
  }
  function scriptStepsText(value) {
    if (typeof value === "string") return value;
    return normalizeScriptSteps(value).map(function (step) {
      return (step.title ? step.title + ": " : "") + step.text;
    }).join("\n\n");
  }
  function scriptFromMessage(message) {
    return [scriptStepFromText(0, message, SCRIPT_STEP_TITLES[0])];
  }
  function fillScriptText(text, lead) {
    const name = String(lead.name || "").trim();
    const category = String(lead.category || "").trim();
    const rating = String(lead.rating || "").trim();
    const reviews = String(lead.reviews || "").trim();
    const competitorReviews = String(lead.competitorReviews || "").trim();
    let out = String(text || "");
    if (competitorReviews) {
      const tipo = category ? "negócios de " + category : "estabelecimentos";
      out = out.replace(/outros \[tipo de estabelecimento\] aqui da região já estão com mais de \[número\] avaliações/g, "outros " + tipo + " aqui da região já estão com mais de " + competitorReviews + " avaliações");
    }
    if (name) out = out.replace(/\[nome do estabelecimento\]/g, name);
    if (rating) out = out.replace(/\[nota\]/g, rating);
    else out = out.replace(/,\s*\[nota\] estrelas/g, "");
    if (reviews) out = out.replace(/apenas \[número\] avaliações/g, "apenas " + reviews + " avaliações");
    if (category) {
      out = out.replace(/\[o tipo de serviço ou estabelecimento\]/g, category);
      out = out.replace(/\[tipo de estabelecimento\]/g, category);
    } else {
      out = out.replace(/\[tipo de estabelecimento\]/g, "estabelecimentos");
      out = out.replace(/\[o tipo de serviço ou estabelecimento\]/g, "esse tipo de serviço");
    }
    if (!competitorReviews || !category) {
      out = out.split("\n").filter(function (line) {
        return !(line.indexOf("Enquanto isso") >= 0 && (line.indexOf("[tipo de estabelecimento]") >= 0 || line.indexOf("[número]") >= 0 || (line.indexOf("estabelecimentos") >= 0 && line.indexOf("mais de") >= 0)));
      }).join("\n");
    }
    return out;
  }
  function defaultScriptFor(lead) {
    return scriptStepsModel.map(function (step, index) {
      return { num: index + 1, title: step[0], text: fillScriptText(step[1], lead), note: SCRIPT_STEP_NOTES[step[0]] || "" };
    });
  }
  function migrateLead(lead) {
    if (!lead || typeof lead !== "object") return lead;
    if (lead.status === LEGACY_SOLD_STATUS) lead.status = SOLD_STATUS;
    if (typeof lead.instagram !== "string") lead.instagram = "";
    if (typeof lead.reviewUrl !== "string") lead.reviewUrl = "";
    if (typeof lead.website !== "string") lead.website = "";
    if (typeof lead.siteProjectFolder !== "string") lead.siteProjectFolder = "";
    if (typeof lead.siteImagesFolder !== "string") lead.siteImagesFolder = "";
    lead.links = cleanLinks(lead.links);
    if (!Array.isArray(lead.script) || !lead.script.length) lead.script = lead.message ? scriptFromMessage(lead.message) : defaultScriptFor(lead);
    else lead.script = normalizeScriptSteps(lead.script);
    lead.message = (lead.script[0] && lead.script[0].text) || "";
    const history = Array.isArray(lead.statusHistory) ? lead.statusHistory : [];
    if (!history.length) {
      const status = STATUSES.includes(lead.status) ? lead.status : "Novo";
      lead.statusHistory = [{ at: lead.createdAt || lead.updatedAt || new Date().toISOString(), from: "", to: status }];
    } else {
      lead.statusHistory = history.map(function (entry) {
        const source = entry && typeof entry === "object" ? entry : {};
        const to = source.to === LEGACY_SOLD_STATUS ? SOLD_STATUS : source.to || "";
        const from = source.from === LEGACY_SOLD_STATUS ? SOLD_STATUS : source.from || "";
        return { at: source.at || "", from: from, to: to };
      });
    }
    return lead;
  }
  function buildSale(lead, extra) {
    const now = new Date().toISOString();
    const sale = {
      id: uid(),
      leadId: lead && lead.id ? lead.id : "",
      leadName: (lead && lead.name) || "Comércio sem nome",
      category: (lead && lead.category) || "",
      location: (lead && lead.location) || "",
      source: (lead && lead.source) || "",
      valueCents: null,
      soldAt: localDateKey(),
      valuePending: true,
      notes: "",
      createdAt: now,
      updatedAt: now
    };
    return Object.assign(sale, extra || {});
  }
  function migratePromptBlocks(blocks) {
    return (Array.isArray(blocks) ? blocks : []).filter(Boolean).map(function (block) {
      const text = String(block.text || "");
      if (/Uma única mensagem de abertura|Faça somente essa versão/.test(text)) {
        return Object.assign({}, block, { title: "Script de abordagem", help: promptBlockMeta[3] ? promptBlockMeta[3][1] : "", text: scriptRule });
      }
      if (/Uma mensagem de abertura de WhatsApp/.test(text)) {
        const replaced = text.replace(/^[^\n]*Uma mensagem de abertura de WhatsApp[^\n]*$/m, function () { return scriptRule; });
        return Object.assign({}, block, { title: "Script de abordagem", help: promptBlockMeta[3] ? promptBlockMeta[3][1] : "", text: replaced });
      }
      if (/\|\s*Mensagem\s*\|/.test(text)) return Object.assign({}, block, { text: text.replace(/\|\s*Mensagem\s*\|/, "| Script |") });
      return block;
    });
  }
  function migrateState(data) {
    if (!data || typeof data !== "object") return data;
    const version = Number(data._schemaVersion) || 1;
    data.leads = Array.isArray(data.leads) ? data.leads.map(migrateLead) : [];
    data.sales = Array.isArray(data.sales) ? data.sales : [];
    data.promptTemplates = normalizePromptTemplates(data.promptTemplates);
    if (Array.isArray(data.promptBlocks)) data.promptBlocks = migratePromptBlocks(data.promptBlocks);
    if (version < SCHEMA_VERSION) {
      const known = {};
      data.sales.forEach(function (sale) { if (sale && sale.leadId) known[sale.leadId] = true; });
      data.leads.forEach(function (lead) {
        if (lead && lead.status === SOLD_STATUS && !known[lead.id]) {
          data.sales.push(buildSale(lead, { soldAt: localDateKey(lead.createdAt || lead.updatedAt), valuePending: true }));
          known[lead.id] = true;
        }
      });
    }
    data._schemaVersion = SCHEMA_VERSION;
    return data;
  }
  function loadState(storageKey) {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey || STORAGE_KEY) || "null");
      if (data && typeof data.promptText === "string") {
        if (data.promptText.includes("tom de cliente, não de vendedor")) {
          data.promptText = data.promptText.replace(/^- Uma mensagem de abertura de WhatsApp[^\n]*$/m, scriptRule);
        }
        data.promptText = data.promptText.replace(/\n+(- Uma única mensagem de abertura para WhatsApp)/g, "\n\n$1");
      }
      if (data && typeof data.promptText === "string" && data.promptText.includes("Você é meu assistente de prospecção") && data.promptText.includes("ENTREGUE SOMENTE") && !data.promptText.includes("Link do Google")) {
        data.promptText = data.promptText
          .replace(/(- Telefone\/WhatsApp[^\n]*\n)/, '$1- Link direto da ficha pública desse comércio no Google Maps (use a URL da ficha do estabelecimento; não use uma busca genérica nem invente o link; se não encontrar, escreva "não encontrado")\n')
          .replace("| Comércio | Telefone | Avaliações |", "| Comércio | Telefone | Link do Google | Avaliações |");
      }
    return migrateState(data ? (function () {
      const promptCategory = data.promptCategory || "";
      const promptLocation = data.promptLocation || "";
      const promptText = promptTemplate(data.promptText || defaultPrompt, promptCategory, promptLocation);
      const promptBlocks = Array.isArray(data.promptBlocks) && data.promptBlocks.length
        ? migratePromptBlocks(data.promptBlocks).map(function (block, index) {
          const meta = promptBlockMeta[index] || ["Instrução extra " + (index - promptBlockMeta.length + 1), "Edite esta parte adicional do comando."];
          return { title: block.title || meta[0], help: block.help || meta[1], text: String(block.text || "") };
        })
        : promptBlocksFromText(promptText);
      return {
        promptCategory: promptCategory,
        promptLocation: promptLocation,
        promptText: composePrompt(promptBlocks),
        promptBlocks: promptBlocks,
        promptHistory: Array.isArray(data.promptHistory) ? data.promptHistory.slice(0, 10) : [],
        leads: Array.isArray(data.leads) ? data.leads : [],
        reminders: Array.isArray(data.reminders) ? data.reminders : [],
        sales: Array.isArray(data.sales) ? data.sales : [],
        promptTemplates: normalizePromptTemplates(data.promptTemplates),
        _promptUpdatedAt: typeof data._promptUpdatedAt === "string" ? data._promptUpdatedAt : "",
        _schemaVersion: Number(data._schemaVersion) || 1
      };
    })() : newState());
    } catch (_) { return newState(); }
  }

  let state = loadState();
  let currentUser = null;
  let activeStorageKey = STORAGE_KEY;
  let cloudReady = false;
  let localOnly = false;
  let syncDirty = false;
  let syncTimer = null;
  let syncInFlight = false;
  let syncPromise = null;
  let resolveSyncPromise = null;
  let syncVersion = 0;
  let activatingUserId = null;
  let retryDelayMs = 5000;
  let lastRemoteUpdatedAt = "";
  let lastStateSnapshot = JSON.parse(JSON.stringify(state));
  let authMode = "login";
  let activeStatus = "Todos";
  let activeCategory = "Todas";
  let activeSource = "Todas";
  let leadSort = "recentes";
  try {
    const savedSort = localStorage.getItem(LEAD_SORT_KEY);
    if (savedSort && LEAD_SORTS.some(function (option) { return option[0] === savedSort; })) leadSort = savedSort;
  } catch (_) {}
  let agendaFilter = "upcoming";
  let toastTimer;
  let pendingImport = null;
  let existingDuplicateSelections = {};
  let pendingSingleField = "";
  let saleExitDecision = "";
  let leadOpenedStatus = "";
  let modelsTab = "site";
  let modelsDirty = false;
  let currentView = "prompt";
  let sitePromptLeadId = "";
  let sitePromptTab = "site";
  let sitePromptDirty = false;
  let reviewResultData = null;
  let reviewPendingUrl = "";
  let reviewBusy = false;
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  function setTheme(theme, persist) {
    const dark = theme === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    const toggle = $("#themeToggle");
    const icon = $("#themeIcon");
    const label = toggle && toggle.querySelector(".theme-toggle-label");
    const action = dark ? "Ativar tema claro" : "Ativar tema escuro";
    if (icon) icon.textContent = dark ? "☼" : "☾";
    if (label) label.textContent = dark ? "Claro" : "Escuro";
    if (toggle) {
      toggle.setAttribute("aria-label", action);
      toggle.title = action;
    }
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = dark ? "#111012" : "#f7f5f1";
    if (persist) {
      try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (_) {}
    }
  }
  const leadDialog = $("#leadDialog");
  const reminderDialog = $("#reminderDialog");
  const sitePromptDialog = $("#sitePromptDialog");
  const authForm = $("#authForm");
  const singleFieldMap = {
    leadName: ["name", "Nome"], leadPhone: ["phone", "Telefone"], leadCategory: ["category", "Categoria"],
    leadLocation: ["location", "Região"], leadSource: ["source", "Origem"], leadReviews: ["reviews", "Avaliações"],
    leadRating: ["rating", "Nota"], leadCompetitor: ["competitor", "Concorrente"],
    leadCompetitorReviews: ["competitorReviews", "Avaliações do concorrente"], leadGoogleUrl: ["googleUrl", "Ficha do Google"],
    leadInstagram: ["instagram", "Instagram"], leadReviewUrl: ["reviewUrl", "Link de avaliação"], leadWebsite: ["website", "Site"],
    leadStatus: ["status", "Status"], leadNotes: ["notes", "Observações"]
  };

  function accountStorageKey(userId) { return USER_STATE_PREFIX + userId; }
  function syncMetaKey(userId) { return SYNC_META_PREFIX + userId; }
  function readSyncMeta(userId) {
    try { return JSON.parse(localStorage.getItem(syncMetaKey(userId)) || "{}"); } catch (_) { return {}; }
  }
  function setSyncMeta(meta) {
    if (!currentUser) return;
    try { localStorage.setItem(syncMetaKey(currentUser.id), JSON.stringify(meta)); } catch (_) {}
  }
  function saveLocalSnapshot() {
    try { localStorage.setItem(activeStorageKey, JSON.stringify(state)); } catch (_) {}
  }
  function setSyncState(status, label, detail) {
    const pill = $("#syncStatus");
    if (pill) {
      pill.dataset.state = status;
      const text = pill.querySelector("span:last-child");
      if (text) text.textContent = label;
    }
    const title = $("#sidebarSyncTitle");
    const subtitle = $("#sidebarSyncDetail");
    if (title) title.textContent = label;
    if (subtitle) subtitle.textContent = detail || ({ synced: "Disponível nos seus dispositivos", syncing: "Enviando alterações", offline: "Alterações guardadas neste navegador", local: "Apenas neste navegador" }[status] || "Sincronização da conta");
    const promptHint = $("#promptSaveHint");
    const agendaHint = $("#agendaStorageHint");
    const localCopy = status === "local";
    if (promptHint) promptHint.textContent = localCopy ? "Alterações ficam somente neste navegador." : status === "offline" ? "Alterações ficam guardadas e serão sincronizadas quando a conexão voltar." : "Alterações são salvas automaticamente na sua conta.";
    if (agendaHint) agendaHint.textContent = localCopy ? "Seus lembretes ficam somente neste navegador." : "Seus lembretes sincronizam na conta e aparecem aqui por data.";
  }
  function showAuthMessage(message, isError) {
    const node = $("#authMessage");
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("error", Boolean(isError));
  }
  function setAuthMode(mode) {
    authMode = mode;
    const signup = mode === "signup";
    $("#authTitle").textContent = signup ? "Crie sua conta" : "Entre no seu CRM";
    $("#authDescription").textContent = signup ? "Crie um acesso com seu e-mail e uma senha para sincronizar seus dados." : "Acesse sua conta para sincronizar leads, lembretes e prompts.";
    $("#authSubmit").textContent = signup ? "Criar conta" : "Entrar";
    $("#authModeToggle").textContent = signup ? "Já tenho uma conta" : "Criar uma conta";
    $("#authPassword").setAttribute("autocomplete", signup ? "new-password" : "current-password");
    showAuthMessage("");
  }
  function cloudState(data) {
    const source = data && typeof data === "object" ? data : {};
    const before = JSON.stringify({
      version: Number(source._schemaVersion) || 1,
      leads: Array.isArray(source.leads) ? source.leads : [],
      blocks: Array.isArray(source.promptBlocks) && source.promptBlocks.length ? source.promptBlocks.map(function (block) { return String(block.text || ""); }) : (typeof source.promptText === "string" ? source.promptText : defaultPrompt),
      templates: promptTemplateSignature(source.promptTemplates)
    });
    const result = newState();
    result.promptCategory = typeof source.promptCategory === "string" ? source.promptCategory : "";
    result.promptLocation = typeof source.promptLocation === "string" ? source.promptLocation : "";
    result.promptBlocks = Array.isArray(source.promptBlocks) && source.promptBlocks.length
      ? source.promptBlocks.map(function (block, index) {
        const meta = promptBlockMeta[index] || ["Instrução extra " + (index - promptBlockMeta.length + 1), "Edite esta parte adicional do comando."];
        return { title: block.title || meta[0], help: block.help || meta[1], text: String(block.text || "") };
      })
      : promptBlocksFromText(typeof source.promptText === "string" ? source.promptText : defaultPrompt);
    result.promptText = composePrompt(result.promptBlocks);
    result.promptHistory = Array.isArray(source.promptHistory) ? source.promptHistory.slice(0, 10) : [];
    result.leads = Array.isArray(source.leads) ? source.leads : [];
    result.reminders = Array.isArray(source.reminders) ? source.reminders : [];
    result.sales = Array.isArray(source.sales) ? source.sales : [];
    result.promptTemplates = normalizePromptTemplates(source.promptTemplates);
    result._promptUpdatedAt = typeof source._promptUpdatedAt === "string" ? source._promptUpdatedAt : "";
    result._schemaVersion = Number(source._schemaVersion) || 1;
    const migrated = migrateState(result);
    if (JSON.stringify({
      version: migrated._schemaVersion,
      leads: migrated.leads,
      blocks: migrated.promptBlocks.map(function (block) { return String(block.text || ""); }),
      templates: promptTemplateSignature(migrated.promptTemplates)
    }) !== before) migrated._migrateChanged = true;
    return migrated;
  }
  function stampChangedRecords() {
    const now = new Date().toISOString();
    function stamp(list, previousList) {
      const previous = new Map((previousList || []).map(function (item) { return [item.id, item]; }));
      (list || []).forEach(function (item) {
        const old = previous.get(item.id);
        const currentCopy = Object.assign({}, item); delete currentCopy.updatedAt;
        const oldCopy = old ? Object.assign({}, old) : null; if (oldCopy) delete oldCopy.updatedAt;
        if (!old || JSON.stringify(currentCopy) !== JSON.stringify(oldCopy)) item.updatedAt = now;
      });
    }
    stamp(state.leads, lastStateSnapshot.leads);
    stamp(state.reminders, lastStateSnapshot.reminders);
    stamp(state.sales, lastStateSnapshot.sales);
    const promptFields = ["promptCategory", "promptLocation", "promptText", "promptBlocks", "promptHistory"];
    if (promptFields.some(function (key) { return JSON.stringify(state[key]) !== JSON.stringify(lastStateSnapshot[key]); })) state._promptUpdatedAt = now;
    PROMPT_TEMPLATE_KINDS.forEach(function (key) {
      const current = state.promptTemplates && state.promptTemplates[key];
      const previous = lastStateSnapshot.promptTemplates && lastStateSnapshot.promptTemplates[key];
      if (current && (!previous || String(current.text || "") !== String(previous.text || ""))) current.updatedAt = now;
    });
  }
  function mergeSyncedState(localState, remoteState, remoteUpdatedAt, meta) {
    const localPromptAt = Date.parse(localState._promptUpdatedAt || meta.localUpdatedAt || "") || 0;
    const remotePromptAt = Date.parse(remoteState._promptUpdatedAt || remoteUpdatedAt || "") || 0;
    const promptSource = localPromptAt > remotePromptAt ? localState : remoteState;
    function mergeRecords(localItems, remoteItems) {
      const merged = new Map((remoteItems || []).map(function (item) { return [item.id, item]; }));
      (localItems || []).forEach(function (item) {
        const remoteItem = merged.get(item.id);
        if (!remoteItem || (Date.parse(item.updatedAt || item.createdAt || "") || 0) > (Date.parse(remoteItem.updatedAt || remoteItem.createdAt || "") || 0)) merged.set(item.id, item);
      });
      return Array.from(merged.values());
    }
    const history = new Map();
    (remoteState.promptHistory || []).concat(localState.promptHistory || []).forEach(function (item) {
      const key = item.readyText || item.text || "";
      if (key && (!history.has(key) || (Date.parse(item.usedAt || "") || 0) > (Date.parse(history.get(key).usedAt || "") || 0))) history.set(key, item);
    });
    const merged = Object.assign({}, remoteState, {
      promptCategory: promptSource.promptCategory,
      promptLocation: promptSource.promptLocation,
      promptText: promptSource.promptText,
      promptBlocks: promptSource.promptBlocks,
      promptHistory: Array.from(history.values()).sort(function (a,b) { return (Date.parse(b.usedAt || "") || 0) - (Date.parse(a.usedAt || "") || 0); }).slice(0, 10),
      promptTemplates: mergePromptTemplates(localState.promptTemplates, remoteState.promptTemplates),
      _promptUpdatedAt: promptSource._promptUpdatedAt,
      leads: mergeRecords(localState.leads, remoteState.leads),
      reminders: mergeRecords(localState.reminders, remoteState.reminders),
      sales: mergeRecords(localState.sales, remoteState.sales)
    });
    return cloudState(merged);
  }
  async function flushCloudSync() {
    if (!supabase || !currentUser || !cloudReady || localOnly || !syncDirty) return;
    if (syncInFlight) return syncPromise || Promise.resolve();
    syncInFlight = true;
    syncPromise = new Promise(function (resolve) { resolveSyncPromise = resolve; });
    const userId = currentUser.id;
    const version = syncVersion;
    const snapshot = JSON.parse(JSON.stringify(state));
    const timestamp = new Date().toISOString();
    try {
      const result = await supabase.from("crm_state").upsert({ user_id: userId, state: snapshot, updated_at: timestamp }, { onConflict: "user_id" }).select("updated_at").single();
      if (result.error) throw result.error;
      if (!currentUser || currentUser.id !== userId) return;
      lastRemoteUpdatedAt = result.data.updated_at || timestamp;
      retryDelayMs = 5000;
      syncDirty = syncVersion !== version;
      setSyncMeta({ dirty: syncDirty, localUpdatedAt: syncDirty ? new Date().toISOString() : lastRemoteUpdatedAt, remoteUpdatedAt: lastRemoteUpdatedAt, migratingLegacy: false });
      if (!syncDirty) {
        try { localStorage.setItem(LEGACY_MIGRATED_KEY, "true"); } catch (_) {}
        setSyncState("synced", "Sincronizado");
      } else {
        setSyncState("syncing", "Salvando…");
        clearTimeout(syncTimer);
        syncTimer = setTimeout(flushCloudSync, 200);
      }
    } catch (error) {
      if (!currentUser || currentUser.id !== userId) return;
      syncDirty = true;
      setSyncMeta({ dirty: true, localUpdatedAt: new Date().toISOString(), remoteUpdatedAt: lastRemoteUpdatedAt, migratingLegacy: readSyncMeta(userId).migratingLegacy });
      setSyncState("offline", "Sem conexão");
      if (window.console && console.warn) console.warn("Supabase sync unavailable:", error.message || error);
      clearTimeout(syncTimer);
      syncTimer = setTimeout(flushCloudSync, retryDelayMs);
      retryDelayMs = Math.min(retryDelayMs * 2, 60000);
    } finally {
      syncInFlight = false;
      if (resolveSyncPromise) resolveSyncPromise();
      syncPromise = null;
      resolveSyncPromise = null;
    }
  }
  async function activateSession(session) {
    if (!session || !session.user) return;
    const user = session.user;
    if (currentUser && currentUser.id === user.id && (cloudReady || activatingUserId === user.id)) return;
    activatingUserId = user.id;
    currentUser = user;
    localOnly = false;
    cloudReady = false;
    activeStorageKey = accountStorageKey(user.id);
    $("#accountEmail").textContent = user.email || "Conta conectada";
    setSyncState("syncing", "Carregando…");
    const userCacheExists = localStorage.getItem(activeStorageKey) !== null;
    const cachedState = userCacheExists ? loadState(activeStorageKey) : null;
    const meta = readSyncMeta(user.id);
    try {
      const result = await supabase.from("crm_state").select("state, updated_at").eq("user_id", user.id).maybeSingle();
      if (result.error) throw result.error;
      if (!currentUser || currentUser.id !== user.id) return;
      if (result.data) {
        const remoteState = cloudState(result.data.state);
        lastRemoteUpdatedAt = result.data.updated_at || "";
        if (cachedState && meta.dirty) {
          state = mergeSyncedState(cachedState, remoteState, lastRemoteUpdatedAt, meta);
          syncDirty = true;
          syncVersion += 1;
        } else if (localStorage.getItem(STORAGE_KEY) !== null && localStorage.getItem(LEGACY_MIGRATED_KEY) !== "true") {
          const legacyState = loadState(STORAGE_KEY);
          const localCandidate = cachedState ? mergeSyncedState(legacyState, cachedState, meta.remoteUpdatedAt, meta) : legacyState;
          state = mergeSyncedState(localCandidate, remoteState, lastRemoteUpdatedAt, {});
          syncDirty = true;
          syncVersion += 1;
          meta.migratingLegacy = true;
        } else {
          const migratedChanged = remoteState._migrateChanged === true;
          delete remoteState._migrateChanged;
          state = remoteState;
          syncDirty = migratedChanged;
          if (migratedChanged) syncVersion += 1;
        }
        if (typeof state._migrateChanged !== "undefined") delete state._migrateChanged;
      } else if (cachedState) {
        state = cachedState;
        syncDirty = true;
        syncVersion += 1;
      } else if (localStorage.getItem(STORAGE_KEY) !== null && localStorage.getItem(LEGACY_MIGRATED_KEY) !== "true") {
        state = loadState(STORAGE_KEY);
        syncDirty = true;
        syncVersion += 1;
        meta.migratingLegacy = true;
      } else {
        state = newState();
        syncDirty = false;
      }
      cloudReady = true;
      lastStateSnapshot = JSON.parse(JSON.stringify(state));
      saveLocalSnapshot();
      if (meta.migratingLegacy) {
        try { localStorage.setItem(LEGACY_MIGRATED_KEY, "true"); } catch (_) {}
      }
      setSyncMeta({ dirty: syncDirty, localUpdatedAt: meta.localUpdatedAt || lastRemoteUpdatedAt, remoteUpdatedAt: lastRemoteUpdatedAt, migratingLegacy: Boolean(meta.migratingLegacy) });
      document.body.classList.add("authenticated");
      renderAll();
      if (syncDirty) {
        setSyncState("syncing", "Sincronizando…");
        clearTimeout(syncTimer);
        syncTimer = setTimeout(flushCloudSync, 100);
      } else setSyncState("synced", "Sincronizado");
      activatingUserId = null;
    } catch (error) {
      if (!currentUser || currentUser.id !== user.id) { activatingUserId = null; return; }
      state = cachedState || (localStorage.getItem(STORAGE_KEY) !== null && localStorage.getItem(LEGACY_MIGRATED_KEY) !== "true" ? loadState(STORAGE_KEY) : newState());
      syncDirty = Boolean(cachedState || localStorage.getItem(STORAGE_KEY) !== null);
      cloudReady = true;
      lastStateSnapshot = JSON.parse(JSON.stringify(state));
      saveLocalSnapshot();
      const migratingLegacy = !cachedState && localStorage.getItem(STORAGE_KEY) !== null && localStorage.getItem(LEGACY_MIGRATED_KEY) !== "true";
      setSyncMeta({ dirty: syncDirty, localUpdatedAt: new Date().toISOString(), remoteUpdatedAt: lastRemoteUpdatedAt, migratingLegacy: migratingLegacy });
      if (migratingLegacy) {
        try { localStorage.setItem(LEGACY_MIGRATED_KEY, "true"); } catch (_) {}
      }
      document.body.classList.add("authenticated");
      renderAll();
      setSyncState("offline", "Sem conexão");
      if (syncDirty) {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(flushCloudSync, 1200);
      }
      if (window.console && console.warn) console.warn("Could not load CRM cloud state:", error.message || error);
      activatingUserId = null;
    }
  }
  async function refreshCloudState() {
    if (!supabase || !currentUser || !cloudReady || localOnly || syncInFlight) return;
    try {
      const result = await supabase.from("crm_state").select("state, updated_at").eq("user_id", currentUser.id).maybeSingle();
      if (result.error) throw result.error;
      if (!result.data || (Date.parse(result.data.updated_at || "") || 0) <= (Date.parse(lastRemoteUpdatedAt || "") || 0)) {
        if (syncDirty) flushCloudSync();
        return;
      }
      if (syncDirty) {
        state = mergeSyncedState(state, cloudState(result.data.state), result.data.updated_at, { localUpdatedAt: readSyncMeta(currentUser.id).localUpdatedAt });
        lastRemoteUpdatedAt = result.data.updated_at || "";
        syncVersion += 1;
        lastStateSnapshot = JSON.parse(JSON.stringify(state));
        saveLocalSnapshot();
        syncDirty = true;
        setSyncMeta({ dirty: true, localUpdatedAt: new Date().toISOString(), remoteUpdatedAt: lastRemoteUpdatedAt, migratingLegacy: false });
        flushCloudSync();
        return;
      }
      state = cloudState(result.data.state);
      lastRemoteUpdatedAt = result.data.updated_at || "";
      lastStateSnapshot = JSON.parse(JSON.stringify(state));
      saveLocalSnapshot();
      if (state._migrateChanged === true) {
        delete state._migrateChanged;
        syncDirty = true;
        syncVersion += 1;
        setSyncMeta({ dirty: true, localUpdatedAt: new Date().toISOString(), remoteUpdatedAt: lastRemoteUpdatedAt, migratingLegacy: false });
        flushCloudSync();
        return;
      }
      setSyncMeta({ dirty: false, localUpdatedAt: lastRemoteUpdatedAt, remoteUpdatedAt: lastRemoteUpdatedAt, migratingLegacy: false });
      renderAll();
      setSyncState("synced", "Atualizado");
    } catch (_) { setSyncState("offline", "Sem conexão"); }
  }
  function initializeAuth() {
    if (supabaseReadyPromise) return supabaseReadyPromise;
    if (!supabaseConfig.url || !supabaseConfig.publishableKey) {
      showAuthMessage("A configuração do Supabase está ausente. Você ainda pode usar o CRM somente neste navegador.");
      return Promise.resolve(null);
    }
    supabaseReadyPromise = (async function () {
      try {
        const sdk = await import("https://esm.sh/@supabase/supabase-js@2.112.3");
        supabase = sdk.createClient(supabaseConfig.url, supabaseConfig.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
        supabase.auth.onAuthStateChange(function (event, session) {
          if (event === "SIGNED_OUT") { lockApp(); return; }
          if (session) window.setTimeout(function () { activateSession(session); }, 0);
          else if (event === "INITIAL_SESSION") setSyncState("offline", "Entre na sua conta");
        });
        return supabase;
      } catch (error) {
        supabaseReadyPromise = null;
        showAuthMessage("Não foi possível carregar a conexão segura. Você pode tentar novamente ou usar somente este navegador.");
        setSyncState("offline", "Sem conexão");
        if (window.console && console.warn) console.warn("Supabase client unavailable:", error.message || error);
        return null;
      }
    })();
    return supabaseReadyPromise;
  }
  function lockApp() {
    document.body.classList.remove("authenticated");
    currentUser = null;
    cloudReady = false;
    localOnly = false;
    syncDirty = false;
    activeStorageKey = STORAGE_KEY;
    state = newState();
    lastStateSnapshot = JSON.parse(JSON.stringify(state));
    $("#accountEmail").textContent = "";
    $("#authPassword").value = "";
    setAuthMode("login");
    setSyncState("offline", "Desconectado");
    renderAll();
    showAuthMessage("");
  }
  function startLocalOnly() {
    currentUser = null;
    cloudReady = false;
    localOnly = true;
    syncDirty = false;
    activeStorageKey = STORAGE_KEY;
    state = loadState(STORAGE_KEY);
    lastStateSnapshot = JSON.parse(JSON.stringify(state));
    $("#accountEmail").textContent = "Somente neste navegador";
    document.body.classList.add("authenticated");
    renderAll();
    setSyncState("local", "Somente local");
  }

  function saveState() {
    stampChangedRecords();
    lastStateSnapshot = JSON.parse(JSON.stringify(state));
    try { localStorage.setItem(activeStorageKey, JSON.stringify(state)); }
    catch (_) { showToast("Não foi possível salvar neste navegador."); }
    if (!cloudReady || localOnly || !currentUser) return;
    syncDirty = true;
    syncVersion += 1;
    setSyncState("syncing", "Salvando…");
    setSyncMeta({ dirty: true, localUpdatedAt: new Date().toISOString(), remoteUpdatedAt: lastRemoteUpdatedAt });
    clearTimeout(syncTimer);
    syncTimer = setTimeout(flushCloudSync, 650);
  }
  function uid() {
    return window.crypto && crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
    });
  }
  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  function digits(value) { return String(value || "").replace(/\D/g, ""); }
  function numeric(value) {
    const match = String(value == null ? "" : value).match(/-?\d[\d.]*/);
    if (!match) return null;
    const parsed = Number(match[0].replace(/\./g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  function gapFor(lead) {
    const competitor = numeric(lead.competitorReviews);
    const own = numeric(lead.reviews);
    return competitor === null || own === null ? null : competitor - own;
  }
  function ratingValue(value) {
    const text = String(value == null ? "" : value).replace(/\s/g, "").replace(",", ".");
    if (!text) return null;
    const parsed = parseFloat(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function leadTimestamp(lead) {
    const parsed = Date.parse((lead && lead.createdAt) || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function compareText(a, b) {
    return String(a || "").localeCompare(String(b || ""), "pt-BR", { sensitivity: "base" });
  }
  function compareDesc(a, b) {
    const left = a == null || Number.isNaN(a) ? null : a;
    const right = b == null || Number.isNaN(b) ? null : b;
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left;
  }
  function sortLeads(list) {
    const byName = function (a, b) { return compareText(a.name, b.name); };
    return list.slice().sort(function (a, b) {
      switch (leadSort) {
        case "antigos": return leadTimestamp(a) - leadTimestamp(b) || byName(a, b);
        case "nome-az": return compareText(a.name, b.name);
        case "nome-za": return compareText(b.name, a.name);
        case "categoria": return compareText(a.category, b.category) || byName(a, b);
        case "origem": return compareText(a.source, b.source) || byName(a, b);
        case "regiao": return compareText(a.location, b.location) || byName(a, b);
        case "status": return STATUSES.indexOf(a.status || "Novo") - STATUSES.indexOf(b.status || "Novo") || byName(a, b);
        case "nota": return compareDesc(ratingValue(a.rating), ratingValue(b.rating)) || byName(a, b);
        case "avaliacoes": return compareDesc(numeric(a.reviews), numeric(b.reviews)) || byName(a, b);
        case "gap": return compareDesc(gapFor(a), gapFor(b)) || byName(a, b);
        default: return leadTimestamp(b) - leadTimestamp(a) || byName(a, b);
      }
    });
  }
  function currencyToCents(value) {
    let text = String(value == null ? "" : value).replace(/[^\d.,-]/g, "").trim();
    if (!text) return null;
    const negative = text.charAt(0) === "-";
    text = text.replace(/-/g, "");
    if (text.indexOf(",") >= 0) text = text.replace(/\./g, "").replace(",", ".");
    else text = text.replace(/\./g, "");
    const parsed = parseFloat(text);
    if (!Number.isFinite(parsed)) return null;
    const cents = Math.round(parsed * 100);
    return negative ? -cents : cents;
  }
  function formatCurrency(cents) {
    if (typeof cents !== "number" || !Number.isFinite(cents)) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  }
  function formatCurrencyInput(cents) {
    if (typeof cents !== "number" || !Number.isFinite(cents)) return "";
    return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
  }
  function salesForLead(leadId) {
    return state.sales.filter(function (sale) { return sale.leadId === leadId; });
  }
  function saleForLead(leadId) {
    const list = salesForLead(leadId);
    if (!list.length) return null;
    return list.slice().sort(function (a, b) {
      return String(b.soldAt || "").localeCompare(String(a.soldAt || "")) || (Date.parse(b.updatedAt || "") || 0) - (Date.parse(a.updatedAt || "") || 0);
    })[0];
  }
  function createSaleForLead(lead, fields) {
    const sale = buildSale(lead, {});
    applySaleFields(sale, lead, fields);
    state.sales.push(sale);
    return sale;
  }
  function applySaleFields(sale, lead, fields) {
    sale.leadId = lead.id;
    sale.leadName = lead.name || sale.leadName || "Comércio sem nome";
    sale.category = lead.category || "";
    sale.location = lead.location || "";
    sale.source = lead.source || "";
    if (Object.prototype.hasOwnProperty.call(fields, "valueCents")) sale.valueCents = fields.valueCents;
    if (Object.prototype.hasOwnProperty.call(fields, "soldAt")) sale.soldAt = fields.soldAt || localDateValue();
    if (Object.prototype.hasOwnProperty.call(fields, "notes")) sale.notes = fields.notes || "";
    sale.valuePending = !(typeof sale.valueCents === "number" && sale.valueCents > 0);
    sale.updatedAt = new Date().toISOString();
    return sale;
  }
  function upsertSaleForLead(lead, fields) {
    const sale = saleForLead(lead.id);
    if (!sale) return createSaleForLead(lead, fields);
    return applySaleFields(sale, lead, fields);
  }
  function removeSaleForLead(leadId) {
    state.sales = state.sales.filter(function (sale) { return sale.leadId !== leadId; });
  }
  function removeSaleById(saleId) {
    state.sales = state.sales.filter(function (sale) { return sale.id !== saleId; });
  }
  function updateSaleSnapshot(lead) {
    salesForLead(lead.id).forEach(function (sale) {
      sale.leadName = lead.name || sale.leadName;
      sale.category = lead.category || "";
      sale.location = lead.location || "";
      sale.source = lead.source || "";
      sale.updatedAt = new Date().toISOString();
    });
  }
  function recordStatusChange(lead, from, to) {
    if (!lead || from === to) return;
    lead.statusHistory = Array.isArray(lead.statusHistory) ? lead.statusHistory : [];
    lead.statusHistory.push({ at: new Date().toISOString(), from: from || "", to: to });
  }
  function finalizeLeadStatus(lead, isNew, next, saleFields) {
    const previous = isNew ? "" : (STATUSES.includes(lead.status) ? lead.status : "Novo");
    next = STATUSES.includes(next) ? next : "Novo";
    if (next === SOLD_STATUS) {
      const existing = salesForLead(lead.id);
      if (!existing.length) {
        const cents = currencyToCents(saleFields.value);
        if (cents === null || cents <= 0) return { error: "Adicione o valor da venda para marcar como Vendido.", needValue: true };
        createSaleForLead(lead, { valueCents: cents, soldAt: saleFields.date || localDateValue(), notes: saleFields.notes || "" });
      }
    } else if (!isNew && previous === SOLD_STATUS) {
      if (saleExitDecision === "keep") updateSaleSnapshot(lead);
      else removeSaleForLead(lead.id);
    }
    if (isNew) {
      lead.statusHistory = [{ at: lead.createdAt || new Date().toISOString(), from: "", to: next }];
    } else {
      recordStatusChange(lead, previous, next);
    }
    lead.status = next;
    return { ok: true };
  }
  function leadPayloadHasData(lead) {
    const fields = [lead.name, lead.phone, lead.category, lead.location, lead.googleUrl, lead.reviews, lead.rating, lead.competitor, lead.competitorReviews, lead.message, lead.notes, lead.instagram, lead.reviewUrl, lead.website];
    return fields.some(function (value) { return value && String(value).trim(); }) || (Array.isArray(lead.script) && lead.script.length > 0);
  }
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2500);
  }
  function localDateValue(date) {
    const d = date || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function formatDate(dateValue, options) {
    if (!dateValue) return "";
    const parts = dateValue.split("-").map(Number);
    if (parts.length !== 3 || !parts[0]) return dateValue;
    return new Intl.DateTimeFormat("pt-BR", options || { day: "2-digit", month: "short", year: "numeric" }).format(new Date(parts[0], parts[1] - 1, parts[2]));
  }
  function calendarDateStamp(date) {
    return String(date.getFullYear()) + String(date.getMonth() + 1).padStart(2, "0") + String(date.getDate()).padStart(2, "0");
  }
  function calendarDateTimeStamp(date) {
    return calendarDateStamp(date) + "T" + String(date.getHours()).padStart(2, "0") + String(date.getMinutes()).padStart(2, "0") + "00";
  }
  function googleCalendarTemplateHref(reminder, lead) {
    const parts = String(reminder.date || "").split("-").map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return "";
    const params = new URLSearchParams({ action: "TEMPLATE", text: reminder.title || "Lembrete Praça CRM" });
    const details = [lead ? "Lead: " + lead.name : "", reminder.notes || ""].filter(Boolean).join("\n");
    if (details) params.set("details", details);
    if (lead && lead.location) params.set("location", lead.location);
    params.set("ctz", "America/Sao_Paulo");
    if (reminder.time) {
      const timeParts = String(reminder.time).split(":").map(Number);
      if (timeParts.length < 2 || !Number.isFinite(timeParts[0]) || !Number.isFinite(timeParts[1])) return "";
      const start = new Date(parts[0], parts[1] - 1, parts[2], timeParts[0], timeParts[1], 0);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);
      params.set("dates", calendarDateTimeStamp(start) + "/" + calendarDateTimeStamp(end));
    } else {
      const start = new Date(parts[0], parts[1] - 1, parts[2]);
      const end = new Date(parts[0], parts[1] - 1, parts[2] + 1);
      params.set("dates", calendarDateStamp(start) + "/" + calendarDateStamp(end));
    }
    return "https://calendar.google.com/calendar/render?" + params.toString();
  }
  function openGoogleCalendarReminder(reminder) {
    const lead = state.leads.find(function (item) { return item.id === reminder.leadId; });
    const href = googleCalendarTemplateHref(reminder, lead);
    if (!href) { showToast("Confira a data e o horário do lembrete."); return; }
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "sr-only";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  function readyPrompt() {
    return readyPromptText(state.promptText);
  }
  function readyPromptText(text) {
    return String(text || "")
      .replace(/\[CATEGORIA\]/g, state.promptCategory.trim() || "[CATEGORIA]")
      .replace(/\[BAIRRO, CIDADE\]/g, state.promptLocation.trim() || "[BAIRRO, CIDADE]");
  }
  function renderPromptBlocks() {
    const blocks = Array.isArray(state.promptBlocks) ? state.promptBlocks : [];
    $("#promptSections").innerHTML = blocks.map(function (block, index) {
      return '<details class="prompt-block"><summary><span>' + escapeHtml(block.title) + '</span><small>Editar</small></summary><div class="prompt-block-body"><p>' + escapeHtml(block.help) + '</p><textarea rows="4" data-prompt-block-index="' + index + '" aria-label="' + escapeHtml(block.title) + '"></textarea></div></details>';
    }).join("");
    $$("[data-prompt-block-index]").forEach(function (textarea) {
      textarea.value = readyPromptText(blocks[Number(textarea.dataset.promptBlockIndex)].text);
    });
  }
  function renderPrompt() {
    $("#promptCategory").value = state.promptCategory;
    $("#promptLocation").value = state.promptLocation;
    $("#promptEditor").value = readyPrompt();
    renderPromptBlocks();
    renderPromptHistory();
  }
  function renderPromptHistory() {
    const history = Array.isArray(state.promptHistory) ? state.promptHistory : [];
    $("#promptHistoryCount").textContent = history.length + "/10";
    $("#promptHistoryList").innerHTML = history.length ? history.map(function (item, index) {
      const date = item.usedAt ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.usedAt)) : "Salvo anteriormente";
      const excerpt = String(item.readyText || item.text || "").replace(/\s+/g, " ").trim();
      return '<button class="history-item" type="button" data-history-index="' + index + '"><span class="history-date">' + escapeHtml(date) + '</span><span class="history-excerpt">' + escapeHtml(excerpt.slice(0, 150)) + (excerpt.length > 150 ? "…" : "") + '</span><span class="history-restore">Restaurar</span></button>';
    }).join("") : '<div class="history-empty">Ainda não há versões. Salve uma versão ou copie um prompt para começar.</div>';
  }
  function rememberPrompt(text) {
    const prompt = String(text || "").trim();
    if (!prompt) { showToast("Escreva um prompt antes de salvar."); return false; }
    state.promptHistory = Array.isArray(state.promptHistory) ? state.promptHistory : [];
    state.promptHistory = [{ text: state.promptText, readyText: prompt, usedAt: new Date().toISOString() }]
      .concat(state.promptHistory.filter(function (item) { return (item.readyText || item.text) !== prompt; }))
      .slice(0, 10);
    saveState();
    renderPromptHistory();
    return true;
  }
  function renderModelTokens() {
    const container = $("#modelsTokenList");
    if (!container) return;
    container.innerHTML = PROMPT_TEMPLATE_TOKENS.map(function (item) {
      return '<button class="token-chip" type="button" data-model-token="' + escapeHtml(item[0]) + '" title="' + escapeHtml(item[1]) + '">' + escapeHtml(item[0]) + '</button>';
    }).join("");
  }
  function modelsPreviewLead() {
    const select = $("#modelsPreviewLead");
    const id = select ? select.value : "";
    return state.leads.find(function (item) { return item.id === id; }) || SAMPLE_LEAD;
  }
  function renderModelsPreview() {
    const editor = $("#modelsEditor");
    const preview = $("#modelsPreviewText");
    if (!editor || !preview) return;
    preview.value = buildPromptText(modelsTab, editor.value, modelsPreviewLead());
    const warning = $("#modelsTokenWarning");
    if (!warning) return;
    const unknown = (editor.value.match(/\{\{[A-Z0-9_]+\}\}/g) || []).filter(function (token) {
      return !PROMPT_TEMPLATE_TOKENS.some(function (item) { return item[0] === token; });
    });
    const missing = (PROMPT_REQUIRED_TOKENS[modelsTab] || []).filter(function (token) { return editor.value.indexOf(token) < 0; });
    const messages = [];
    if (unknown.length) messages.push("Tokens desconhecidos: " + unknown.join(", "));
    if (missing.length) messages.push("Tokens recomendados ausentes: " + missing.join(", "));
    warning.textContent = messages.join(" ");
    warning.classList.toggle("hidden", !messages.length);
  }
  function renderModelsLeadOptions() {
    const select = $("#modelsPreviewLead");
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Lead de exemplo</option>' + state.leads.map(function (lead) {
      return '<option value="' + escapeHtml(lead.id) + '">' + escapeHtml(lead.name || "Comércio sem nome") + '</option>';
    }).join("");
    select.value = state.leads.some(function (lead) { return lead.id === current; }) ? current : "";
  }
  function setModelsDirtyState(dirty) {
    modelsDirty = dirty;
    const saveStateEl = $("#modelsSaveState");
    if (!saveStateEl) return;
    saveStateEl.textContent = dirty ? "Alterações não salvas" : "Salvo";
    saveStateEl.classList.toggle("dirty", dirty);
  }
  function renderModels() {
    const editor = $("#modelsEditor");
    if (!editor) return;
    renderModelsLeadOptions();
    const templates = normalizePromptTemplates(state.promptTemplates);
    if (!modelsDirty) editor.value = templates[modelsTab].text;
    $$(".models-tab").forEach(function (button) {
      const active = button.dataset.modelTab === modelsTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    setModelsDirtyState(modelsDirty);
    renderModelTokens();
    renderModelsPreview();
  }
  function setModelTab(tab) {
    if (PROMPT_TEMPLATE_KINDS.indexOf(tab) < 0 || tab === modelsTab) return;
    if (modelsDirty && !window.confirm("Você tem alterações não salvas no modelo. Descartar?")) return;
    modelsTab = tab;
    setModelsDirtyState(false);
    renderModels();
  }
  function insertModelToken(token) {
    const editor = $("#modelsEditor");
    if (!editor) return;
    const start = typeof editor.selectionStart === "number" ? editor.selectionStart : editor.value.length;
    const end = typeof editor.selectionEnd === "number" ? editor.selectionEnd : editor.value.length;
    editor.value = editor.value.slice(0, start) + token + editor.value.slice(end);
    editor.selectionStart = editor.selectionEnd = start + token.length;
    editor.focus();
    setModelsDirtyState(true);
    renderModelsPreview();
  }
  function saveModel() {
    const editor = $("#modelsEditor");
    if (!editor) return;
    if (!editor.value.trim()) { showToast("O modelo não pode ficar vazio."); return; }
    state.promptTemplates = normalizePromptTemplates(state.promptTemplates);
    const current = state.promptTemplates[modelsTab];
    if (current && current.text === editor.value) {
      setModelsDirtyState(false);
      showToast("O modelo já está salvo.");
      return;
    }
    state.promptTemplates[modelsTab] = { text: editor.value, updatedAt: new Date().toISOString() };
    setModelsDirtyState(false);
    saveState();
    renderModels();
    showToast("Modelo salvo.");
  }
  function discardModel() {
    if (!modelsDirty) return;
    setModelsDirtyState(false);
    renderModels();
  }
  function restoreModel() {
    if (!window.confirm("Restaurar o modelo padrão de " + PROMPT_TEMPLATE_LABELS[modelsTab] + "? As alterações não salvas serão perdidas.")) return;
    const editor = $("#modelsEditor");
    if (!editor) return;
    editor.value = PROMPT_TEMPLATE_DEFAULTS[modelsTab];
    setModelsDirtyState(true);
    renderModelsPreview();
    showToast("Padrão restaurado. Clique em Salvar modelo para aplicar.");
  }
  function sitePromptLead() {
    return state.leads.find(function (item) { return item.id === sitePromptLeadId; }) || null;
  }
  function sitePromptOverrides() {
    return {
      googleUrl: normalizeUrlValue($("#siteLinkGoogle") ? $("#siteLinkGoogle").value : ""),
      reviewUrl: normalizeUrlValue($("#siteLinkReview") ? $("#siteLinkReview").value : ""),
      phone: digits($("#siteLinkPhone") ? $("#siteLinkPhone").value : ""),
      instagram: $("#siteLinkInstagram") ? $("#siteLinkInstagram").value.trim() : "",
      website: normalizeUrlValue($("#siteLinkWebsite") ? $("#siteLinkWebsite").value : ""),
      projectFolder: $("#siteLinkProjectFolder") ? $("#siteLinkProjectFolder").value.trim() : "",
      imagesFolder: $("#siteLinkImagesFolder") ? $("#siteLinkImagesFolder").value.trim() : "",
      links: collectSiteExtraLinks()
    };
  }
  function sitePromptLeadWithOverrides() {
    const lead = sitePromptLead();
    if (!lead) return null;
    const overrides = sitePromptOverrides();
    return Object.assign({}, lead, {
      googleUrl: overrides.googleUrl,
      reviewUrl: overrides.reviewUrl,
      phone: overrides.phone,
      instagram: overrides.instagram,
      website: overrides.website,
      links: overrides.links,
      siteProjectFolder: overrides.projectFolder,
      siteImagesFolder: overrides.imagesFolder
    });
  }
  function siteExtraLinkRowMarkup(label, url) {
    return '<div class="site-extra-row">' +
      '<input class="site-extra-label" value="' + escapeHtml(label) + '" placeholder="Nome do link (ex.: Cardápio)" aria-label="Nome do link extra">' +
      '<input class="site-extra-url" value="' + escapeHtml(url) + '" placeholder="https://..." inputmode="url" aria-label="URL do link extra">' +
      '<button class="icon-button icon-button-danger" type="button" data-extra-remove aria-label="Remover link">×</button>' +
      '</div>';
  }
  function renderSiteExtraLinks(links) {
    const container = $("#siteExtraLinks");
    if (!container) return;
    const list = Array.isArray(links) ? links : [];
    container.innerHTML = list.map(function (item) { return siteExtraLinkRowMarkup(item.label || "", item.url || ""); }).join("");
    if (!list.length) container.innerHTML = '<p class="empty-small site-extra-empty">Nenhum link extra. Use “Adicionar link” abaixo.</p>';
  }
  function collectSiteExtraLinks() {
    return $$("#siteExtraLinks .site-extra-row").map(function (row) {
      const label = row.querySelector(".site-extra-label");
      const url = row.querySelector(".site-extra-url");
      return { label: label ? label.value.trim() : "", url: url ? normalizeUrlValue(url.value) : "" };
    }).filter(function (item) { return item.label && item.url; });
  }
  function renderSitePromptTabs() {
    $$(".site-prompt-tab").forEach(function (button) {
      const active = button.dataset.siteTab === sitePromptTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }
  function renderSitePrompt() {
    const preview = $("#sitePromptText");
    if (!preview) return;
    const lead = sitePromptLeadWithOverrides();
    if (!lead) { preview.value = ""; return; }
    preview.value = buildPromptText(sitePromptTab, promptTemplateText(sitePromptTab), lead);
    const hint = $("#sitePromptHint");
    if (hint) hint.textContent = PROMPT_TEMPLATE_LABELS[sitePromptTab] + " · montado com o modelo salvo";
  }
  function markSitePromptDirty() {
    sitePromptDirty = true;
    renderSitePrompt();
  }
  function syncLeadFormPresence(lead) {
    if (!$("#leadId") || $("#leadId").value !== lead.id) return;
    $("#leadPhone").value = lead.phone || "";
    $("#leadGoogleUrl").value = lead.googleUrl || "";
    $("#leadInstagram").value = lead.instagram || "";
    $("#leadReviewUrl").value = lead.reviewUrl || "";
    $("#leadWebsite").value = lead.website || "";
  }
  function saveSitePromptLinks() {
    const lead = sitePromptLead();
    if (!lead) return;
    const overrides = sitePromptOverrides();
    lead.googleUrl = overrides.googleUrl;
    lead.reviewUrl = overrides.reviewUrl;
    lead.phone = overrides.phone;
    lead.instagram = overrides.instagram;
    lead.website = overrides.website;
    lead.links = overrides.links;
    lead.siteProjectFolder = overrides.projectFolder;
    lead.siteImagesFolder = overrides.imagesFolder;
    sitePromptDirty = false;
    saveState();
    syncLeadFormPresence(lead);
    renderLeads();
  }
  function openSitePrompt(leadId) {
    const lead = state.leads.find(function (item) { return item.id === leadId; });
    if (!lead) return;
    sitePromptLeadId = lead.id;
    sitePromptTab = "site";
    sitePromptDirty = false;
    $("#sitePromptTitle").textContent = "Prompt do site · " + (lead.name || "Lead");
    $("#siteLinkGoogle").value = lead.googleUrl || "";
    $("#siteLinkReview").value = lead.reviewUrl || googleReviewUrl(lead.googleUrl) || "";
    $("#siteLinkPhone").value = lead.phone || "";
    $("#siteLinkInstagram").value = lead.instagram || "";
    $("#siteLinkWebsite").value = lead.website || "";
    $("#siteLinkProjectFolder").value = lead.siteProjectFolder || ("sites/" + slugify(lead.name));
    $("#siteLinkImagesFolder").value = lead.siteImagesFolder || ("sites/" + slugify(lead.name) + "/assets");
    renderSiteExtraLinks(lead.links);
    renderSitePromptTabs();
    renderSitePrompt();
    sitePromptDialog.showModal();
  }
  function reviewSourceLabel(source) {
    return {
      "place-id": "Place ID informado",
      "feature-id": "Código do Maps",
      url: "URL do Google Maps",
      "review-url": "Link de avaliação",
      resolved: "Link curto resolvido",
      manual: "Link curto confirmado"
    }[source] || "Link gerado";
  }
  function setReviewStatus(message, tone) {
    const element = $("#reviewStatus");
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("is-error", tone === "error");
    element.classList.toggle("is-success", tone === "success");
  }
  function setReviewBusy(busy, label) {
    reviewBusy = busy;
    const generate = $("#reviewGenerate");
    const resolvedGenerate = $("#reviewResolvedGenerate");
    const paste = $("#reviewPaste");
    [generate, resolvedGenerate, paste].forEach(function (button) {
      if (button) button.disabled = busy;
    });
    if (generate) generate.textContent = busy ? "Gerando..." : "Gerar link de avaliação";
    if (resolvedGenerate) resolvedGenerate.textContent = busy ? "Gerando..." : "Gerar com esta URL";
    const input = $("#reviewInput");
    const resolvedInput = $("#reviewResolvedInput");
    if (input) input.disabled = busy;
    if (resolvedInput) resolvedInput.disabled = busy;
    if (busy && label) setReviewStatus(label);
  }
  function renderReviewLeadOptions() {
    const select = $("#reviewLeadSelect");
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Selecione um lead</option>' + state.leads.map(function (lead) {
      return '<option value="' + escapeHtml(lead.id) + '">' + escapeHtml(lead.name || "Comércio sem nome") + '</option>';
    }).join("");
    select.value = state.leads.some(function (lead) { return lead.id === current; }) ? current : "";
    const save = $("#reviewSave");
    if (save) save.classList.toggle("hidden", !state.leads.length);
  }
  function renderReviewResult() {
    const empty = $("#reviewEmpty");
    const panel = $("#reviewResult");
    if (!empty || !panel) return;
    if (!reviewResultData) {
      empty.classList.remove("hidden");
      panel.classList.add("hidden");
      return;
    }
    const result = reviewResultData;
    const link = result.reviewUrl || reviewLinkForPlaceId(result.placeId);
    empty.classList.add("hidden");
    panel.classList.remove("hidden");
    if ($("#reviewResultName")) $("#reviewResultName").textContent = result.name || "Comércio identificado";
    if ($("#reviewResultSource")) $("#reviewResultSource").textContent = reviewSourceLabel(result.source);
    if ($("#reviewResultLink")) $("#reviewResultLink").value = link;
    if ($("#reviewResultPlaceId")) $("#reviewResultPlaceId").textContent = result.placeId || "—";
    if ($("#reviewOpen")) $("#reviewOpen").href = link || "#";
    if ($("#reviewMaps")) $("#reviewMaps").href = result.placeId ? "https://www.google.com/maps/place/?q=place_id:" + encodeURIComponent(result.placeId) : "#";
    if ($("#reviewSaveLead")) $("#reviewSaveLead").disabled = !result.placeId;
    renderReviewLeadOptions();
  }
  function renderReviewTool() {
    renderReviewLeadOptions();
    renderReviewResult();
  }
  function resetReviewTool() {
    if (reviewBusy) return;
    reviewResultData = null;
    reviewPendingUrl = "";
    if ($("#reviewInput")) $("#reviewInput").value = "";
    if ($("#reviewResolvedInput")) $("#reviewResolvedInput").value = "";
    if ($("#reviewRecovery")) $("#reviewRecovery").classList.add("hidden");
    setReviewStatus("");
    renderReviewResult();
    if ($("#reviewInput")) $("#reviewInput").focus();
  }
  function showReviewRecovery() {
    const panel = $("#reviewRecovery");
    if (panel) panel.classList.remove("hidden");
    const input = $("#reviewResolvedInput");
    if (input) {
      input.value = "";
      input.focus();
    }
  }
  async function startReviewGeneration(value) {
    if (reviewBusy) return;
    const input = String(value || "").trim();
    if (!input) {
      setReviewStatus("Cole um link do Google Maps ou um Place ID.", "error");
      return;
    }
    const pending = reviewPendingUrl;
    reviewResultData = null;
    reviewPendingUrl = "";
    if ($("#reviewRecovery")) $("#reviewRecovery").classList.add("hidden");
    renderReviewResult();
    setReviewBusy(true, "Lendo link...");
    try {
      const result = await resolveReviewInput(input);
      if (result && (result.placeId || result.reviewUrl)) {
        if (pending && result.placeId && input !== pending) {
          result.source = "manual";
          writeReviewCache(pending, result);
        }
        reviewResultData = result;
        setReviewStatus("Link de avaliação gerado.", "success");
        renderReviewResult();
      } else if (result && result.needsManual) {
        reviewPendingUrl = result.unresolvedUrl || input;
        showReviewRecovery();
        setReviewStatus("Não consegui ler esse link automaticamente. Use a opção abaixo.", "error");
      } else {
        setReviewStatus((result && result.error) || "Não encontrei o identificador nesse link. Use a URL completa da ficha do Maps.", "error");
      }
    } catch (_) {
      setReviewStatus("Não foi possível gerar o link agora. Tente novamente.", "error");
    } finally {
      setReviewBusy(false);
    }
  }
  function pasteReviewResolved() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      showToast("Cole a URL manualmente.");
      return;
    }
    navigator.clipboard.readText().then(function (text) {
      const input = $("#reviewResolvedInput");
      if (!input) return;
      input.value = String(text || "").trim();
      if (input.value) startReviewGeneration(input.value);
    }, function () {
      showToast("Não foi possível ler a área de transferência. Cole manualmente.");
    });
  }
  function saveReviewToLead() {
    if (!reviewResultData || !reviewResultData.placeId) {
      showToast("Gere um link primeiro.");
      return;
    }
    const select = $("#reviewLeadSelect");
    const leadId = select ? select.value : "";
    if (!leadId) {
      showToast("Selecione um lead.");
      return;
    }
    const lead = state.leads.find(function (item) { return item.id === leadId; });
    if (!lead) {
      showToast("Lead não encontrado. Atualize a página.");
      return;
    }
    const link = reviewResultData.reviewUrl || reviewLinkForPlaceId(reviewResultData.placeId);
    if (lead.reviewUrl === link) {
      showToast("Este link já está salvo neste lead.");
      return;
    }
    if (lead.reviewUrl && !window.confirm("Este lead já tem um link de avaliação. Substituir?")) return;
    lead.reviewUrl = link;
    saveState();
    renderLeads();
    renderReviewLeadOptions();
    showToast("Link de avaliação salvo no lead.");
  }
  function setView(view) {
    if (currentView === "models" && view !== "models" && modelsDirty) {
      if (!window.confirm("Você tem alterações não salvas no modelo. Sair mesmo assim?")) return;
      setModelsDirtyState(false);
    }
    currentView = view;
    $$(".page-view").forEach(function (section) { section.classList.toggle("active", section.id === "view-" + view); });
    $$(".nav-item").forEach(function (button) { button.classList.toggle("active", button.dataset.view === view); });
    $("#topTitle").textContent = { prompt: "Prompt de pesquisa", crm: "Leads", agenda: "Lembretes", reports: "Relatórios", review: "Link de avaliação", models: "Modelos de prompt" }[view] || "Prospecção";
    if (view === "crm") renderLeads();
    if (view === "agenda") renderAgenda();
    if (view === "reports") renderReports();
    if (view === "review") renderReviewTool();
    if (view === "models") renderModels();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function setSidebarCollapsed(collapsed) {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    const button = $("#sidebarToggle");
    button.setAttribute("aria-expanded", String(!collapsed));
    button.setAttribute("aria-label", collapsed ? "Abrir menu" : "Recolher menu");
    button.title = collapsed ? "Abrir menu" : "Recolher menu";
    try { localStorage.setItem(SIDEBAR_KEY, String(collapsed)); } catch (_) {}
  }
  function leadFirstMessage(lead) {
    const steps = Array.isArray(lead && lead.script) ? lead.script : [];
    const first = steps.find(function (step) { return step && String(step.text || "").trim(); });
    return first ? String(first.text).trim() : String((lead && lead.message) || "").trim();
  }
  function whatsappHref(lead) {
    const phone = digits(lead.phone);
    if (!phone) return "";
    const internationalPhone = phone.startsWith("55") ? phone : "55" + phone;
    const message = leadFirstMessage(lead);
    return "https://wa.me/" + internationalPhone + (message ? "?text=" + encodeURIComponent(message) : "");
  }
  function googleProfileHref(value) {
    const raw = String(value || "").trim();
    if (!/^https?:\/\//i.test(raw)) return "";
    try {
      const url = new URL(raw);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  }

  function updateLeadFilterOptions() {
    activeCategory = fillFilterSelect($("#leadFilterCategory"), activeCategory, "category");
    activeSource = fillFilterSelect($("#leadFilterSource"), activeSource, "source");
  }
  function fillFilterSelect(select, activeValue, field) {
    if (!select) return activeValue;
    const seen = {};
    state.leads.forEach(function (lead) {
      const value = String(lead[field] || "").trim();
      if (value) seen[value] = true;
    });
    const options = ["Todas"].concat(Object.keys(seen).sort(compareText));
    const value = options.indexOf(activeValue) >= 0 ? activeValue : "Todas";
    select.innerHTML = options.map(function (option) {
      return '<option value="' + escapeHtml(option) + '">' + escapeHtml(option) + "</option>";
    }).join("");
    select.value = value;
    return value;
  }
  function renderLeads() {
    updateLeadFilterOptions();
    const query = normalize($("#leadSearch").value.trim());
    const visible = sortLeads(state.leads.filter(function (lead) {
      const statusMatches = activeStatus === "Todos" || lead.status === activeStatus;
      const searchMatches = !query || normalize([lead.name, lead.phone, lead.category, lead.location, lead.competitor, lead.source, lead.instagram].join(" ")).includes(query);
      const categoryMatches = activeCategory === "Todas" || String(lead.category || "") === activeCategory;
      const sourceMatches = activeSource === "Todas" || String(lead.source || "") === activeSource;
      return statusMatches && searchMatches && categoryMatches && sourceMatches;
    }));
    $("#leadList").innerHTML = visible.map(function (lead) {
      const gap = gapFor(lead);
      const gapText = gap === null ? "Gap não informado" : (gap > 0 ? "+" : "") + gap + " avaliações";
      const subtitle = [lead.category, lead.location].filter(Boolean).join(" · ") || "Sem categoria ou região";
      const phone = lead.phone ? "WhatsApp " + lead.phone : "Sem telefone";
      const status = STATUSES.includes(lead.status) ? lead.status : "Novo";
      const googleLink = googleProfileHref(lead.googleUrl);
      return '<article class="lead-row" data-lead-id="' + escapeHtml(lead.id) + '" tabindex="0" role="button" aria-label="Abrir lead ' + escapeHtml(lead.name) + '">' +
        '<div><div class="lead-name">' + escapeHtml(lead.name || "Comércio sem nome") + '</div><div class="lead-sub">' + escapeHtml(subtitle) + " · " + escapeHtml(phone) + '</div></div>' +
        '<div class="lead-gap">' + escapeHtml(gapText) + '<small>' + escapeHtml(lead.competitor ? "vs. " + lead.competitor : "sem concorrente") + '</small></div>' +
        '<div class="lead-source">' + escapeHtml(lead.source || "Origem não informada") + (googleLink ? '<a class="google-quick-link" href="' + escapeHtml(googleLink) + '" target="_blank" rel="noopener noreferrer">Google ↗</a>' : '') + '</div>' +
        '<span class="status-chip" data-status="' + escapeHtml(status) + '">' + escapeHtml(status) + '</span><span class="lead-arrow">›</span></article>';
    }).join("");
    $$(".filter-tab").forEach(function (button) { button.classList.toggle("active", button.dataset.status === activeStatus); });
    $("#filterCountTodos").textContent = String(state.leads.length);
    const resultCount = $("#leadResultCount");
    if (resultCount) {
      resultCount.textContent = visible.length + (visible.length === 1 ? " lead" : " leads") + (visible.length < state.leads.length ? " de " + state.leads.length : "");
    }
    $("#emptyLeads").classList.toggle("hidden", state.leads.length > 0);
    $("#noResults").classList.toggle("hidden", state.leads.length === 0 || visible.length > 0);
    $("#leadList").classList.toggle("hidden", state.leads.length === 0 || visible.length === 0);
    $("#leadCountBadge").textContent = String(state.leads.length);
    $("#statTotal").textContent = String(state.leads.length);
    $("#statActive").textContent = String(state.leads.filter(function (lead) { return ["Mandei", "Respondeu", "Proposta"].includes(lead.status); }).length);
    $("#statWon").textContent = String(state.leads.filter(function (lead) { return lead.status === SOLD_STATUS; }).length);
    const soldValue = state.sales.reduce(function (total, sale) { return typeof sale.valueCents === "number" && sale.valueCents > 0 ? total + sale.valueCents : total; }, 0);
    const wonHint = $("#statWonHint");
    if (wonHint) wonHint.textContent = soldValue > 0 ? formatCurrency(soldValue) + " vendidos" : "sem valor informado";
    const pending = state.reminders.filter(function (item) { return !item.done; }).length;
    $("#statReminders").textContent = String(pending);
    $("#reminderCountBadge").textContent = String(pending);
    if (!$("#existingDuplicatePanel").classList.contains("hidden")) renderExistingDuplicateAnalysis();
  }
  function updateLeadActions(lead) {
    const link = $("#leadWhatsApp");
    const href = whatsappHref(lead);
    if (href) { link.href = href; link.classList.remove("hidden"); }
    else link.classList.add("hidden");
    const googleHref = googleProfileHref(lead.googleUrl);
    const googleButton = $("#leadGoogleProfile");
    if (googleHref) { googleButton.href = googleHref; googleButton.classList.remove("hidden"); }
    else googleButton.classList.add("hidden");
  }
  let scriptEditorSteps = [];
  function copyText(value, successMessage) {
    const done = function () { showToast(successMessage); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done, function () { fallbackCopy(value, successMessage); });
      return;
    }
    fallbackCopy(value, successMessage);
  }
  function fallbackCopy(value, successMessage) {
    const temporary = document.createElement("textarea");
    temporary.value = value;
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.appendChild(temporary);
    temporary.select();
    const copied = document.execCommand("copy");
    temporary.remove();
    showToast(copied ? successMessage : "Não foi possível copiar.");
  }
  function renderScriptSteps() {
    const container = $("#leadScriptSteps");
    if (!container) return;
    container.innerHTML = scriptEditorSteps.length ? scriptEditorSteps.map(function (step, index) {
      return '<div class="script-step">' +
        '<div class="script-step-head">' +
          '<span class="script-step-num" aria-hidden="true">' + (index + 1) + '</span>' +
          '<input class="script-step-title" data-script-title="' + index + '" value="' + escapeHtml(step.title || "") + '" placeholder="Título da etapa">' +
          '<button class="icon-button" type="button" data-script-copy="' + index + '" aria-label="Copiar esta etapa" title="Copiar esta mensagem"><svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="9" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2"/></svg></button>' +
          '<button class="icon-button icon-button-danger" type="button" data-script-remove="' + index + '" aria-label="Excluir esta etapa" title="Excluir esta etapa"><svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4h11M6 4V2.5h4V4m2.2 0-.6 9.2a1 1 0 0 1-1 .9H5.4a1 1 0 0 1-1-.9L3.8 4m2.7 2.2v5m3-5v5"/></svg></button>' +
        '</div>' +
        '<textarea class="script-step-text" data-script-text="' + index + '" rows="4" placeholder="Texto desta etapa para enviar no WhatsApp">' + escapeHtml(step.text || "") + '</textarea>' +
        '<input class="script-step-note" data-script-note="' + index + '" value="' + escapeHtml(step.note || "") + '" placeholder="Nota (não é enviada): ex. enviar junto o vídeo da plaquinha">' +
      '</div>';
    }).join("") : '<p class="empty-small">Sem etapas por enquanto. Use “Adicionar etapa” acima para escrever a primeira mensagem.</p>';
  }
  function collectScriptSteps() {
    const steps = [];
    $$("#leadScriptSteps .script-step").forEach(function (node) {
      const textArea = node.querySelector("[data-script-text]");
      const index = Number(textArea.dataset.scriptText);
      const text = textArea.value.trim();
      if (!text) return;
      steps.push({
        num: 0,
        title: node.querySelector('[data-script-title="' + index + '"]').value.trim() || "Mensagem " + (steps.length + 1),
        text: text,
        note: (node.querySelector('[data-script-note="' + index + '"]') || {}).value || ""
      });
    });
    return normalizeScriptSteps(steps);
  }
  function scriptFullCopyText(steps) {
    return steps.map(function (step) {
      return [step.num + ". " + step.title, step.note ? "(Nota: " + step.note + ")" : "", step.text].filter(Boolean).join("\n");
    }).join("\n\n");
  }
  function startLeadScriptEditor(lead) {
    scriptEditorSteps = lead && Array.isArray(lead.script) && lead.script.length
      ? normalizeScriptSteps(lead.script).map(function (step) { return { num: step.num, title: step.title, text: step.text, note: step.note }; })
      : [];
    renderScriptSteps();
  }
  function resetSingleFieldSave() {
    pendingSingleField = "";
    const button = $("#saveSingleField");
    button.disabled = true;
    button.textContent = "Salvar só o campo editado";
  }
  function openLead(id) {
    const lead = state.leads.find(function (item) { return item.id === id; });
    if (!lead) return;
    leadOpenedStatus = lead.status;
    saleExitDecision = "";
    $("#leadId").value = lead.id;
    $("#leadModalEyebrow").textContent = "LEAD · " + (lead.status || "Novo").toUpperCase();
    $("#leadModalTitle").textContent = "Editar lead";
    $("#leadName").value = lead.name || "";
    $("#leadPhone").value = lead.phone || "";
    $("#leadCategory").value = lead.category || "";
    $("#leadLocation").value = lead.location || "";
    $("#leadSource").value = lead.source || "Outro";
    $("#leadReviews").value = lead.reviews || "";
    $("#leadRating").value = lead.rating || "";
    $("#leadCompetitor").value = lead.competitor || "";
    $("#leadCompetitorReviews").value = lead.competitorReviews || "";
    $("#leadGoogleUrl").value = lead.googleUrl || "";
    $("#leadInstagram").value = lead.instagram || "";
    $("#leadReviewUrl").value = lead.reviewUrl || "";
    $("#leadWebsite").value = lead.website || "";
    $("#leadStatus").value = STATUSES.includes(lead.status) ? lead.status : "Novo";
    startLeadScriptEditor(lead);
    $("#leadNotes").value = lead.notes || "";
    resetAddSaleForm();
    renderLeadSaleList(lead.id);
    $("#deleteLead").classList.remove("hidden");
    $("#addReminderForLead").classList.remove("hidden");
    $("#leadSitePrompt").classList.remove("hidden");
    $("#saveSingleField").classList.remove("hidden");
    resetSingleFieldSave();
    updateSaleSectionVisibility();
    updateLeadActions(lead);
    leadDialog.showModal();
  }
  function resetAddSaleForm() {
    $("#leadSaleValue").value = "";
    $("#leadSaleDate").value = localDateValue();
    $("#leadSaleNotes").value = "";
    const fields = $("#leadSaleAddFields");
    if (fields) fields.classList.add("hidden");
  }
  function renderLeadSaleList(leadId) {
    const container = $("#leadSaleList");
    if (!container) return;
    const sales = salesForLead(leadId).slice().sort(function (a, b) {
      return String(b.soldAt || "").localeCompare(String(a.soldAt || "")) || (Date.parse(b.updatedAt || "") || 0) - (Date.parse(a.updatedAt || "") || 0);
    });
    if (!sales.length) {
      container.innerHTML = '<p class="empty-small">Nenhuma venda registrada. Use “Adicionar venda” abaixo.</p>';
      return;
    }
    container.innerHTML = sales.map(function (sale) {
      const value = typeof sale.valueCents === "number" && sale.valueCents > 0 ? escapeHtml(formatCurrency(sale.valueCents)) : '<span class="report-value-pending">valor pendente</span>';
      const date = sale.soldAt ? formatDate(sale.soldAt, { day: "2-digit", month: "short", year: "numeric" }) : "sem data";
      const notes = sale.notes ? '<small class="sale-item-notes">' + escapeHtml(sale.notes) + '</small>' : "";
      return '<div class="sale-item">' +
        '<div class="sale-item-main"><strong>' + value + '</strong><small>' + escapeHtml(date) + '</small>' + notes + '</div>' +
        '<button class="icon-button icon-button-danger" type="button" data-remove-sale="' + escapeHtml(sale.id) + '" aria-label="Excluir esta venda" title="Excluir esta venda">' +
          '<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4h11M6 4V2.5h4V4m2.2 0-.6 9.2a1 1 0 0 1-1 .9H5.4a1 1 0 0 1-1-.9L3.8 4m2.7 2.2v5m3-5v5"/></svg>' +
        '</button>' +
      '</div>';
    }).join("");
  }
  function updateSaleSectionVisibility() {
    const section = $("#leadSaleSection");
    if (!section) return;
    const id = $("#leadId").value;
    const selected = $("#leadStatus").value;
    const sold = selected === SOLD_STATUS;
    section.classList.toggle("hidden", !sold);
    if (id) renderLeadSaleList(id);
    const hint = $("#leadSaleHint");
    if (hint) {
      const sales = id ? salesForLead(id) : [];
      const pending = sold && (!sales.length || sales.some(function (sale) { return !(typeof sale.valueCents === "number" && sale.valueCents > 0); }));
      hint.textContent = pending ? "Informe o valor de cada venda para ela aparecer nos relatórios." : "Cada venda fica registrada e alimenta a aba Relatórios.";
      hint.classList.toggle("report-value-pending", pending);
    }
    const exit = $("#leadSaleExitSection");
    if (exit) {
      const sales = id ? salesForLead(id) : [];
      const leavingSold = Boolean(id) && leadOpenedStatus === SOLD_STATUS && !sold && sales.length > 0;
      exit.classList.toggle("hidden", !leavingSold);
      if (leavingSold) {
        const hint = $("#leadSaleExitHint");
        if (hint) hint.textContent = sales.length > 1
          ? "Este cliente tem " + sales.length + " vendas registradas. Ao mudar o status para algo que não seja Vendido, escolha o que fazer com todas elas:"
          : "Este lead está com uma venda registrada. Ao mudar o status para algo que não seja Vendido, escolha o que fazer com ela:";
      }
      if (!leavingSold) saleExitDecision = "";
    }
  }
  function ensureSaleExitDecision() {
    if (saleExitDecision) return true;
    const exit = $("#leadSaleExitSection");
    if (exit) exit.classList.remove("hidden");
    return false;
  }
  function handleSaleError(result) {
    showToast(result.error);
    const fields = $("#leadSaleAddFields");
    if (result.needValue && fields) fields.classList.remove("hidden");
    if (result.needValue && $("#leadSaleDate") && !$("#leadSaleDate").value) $("#leadSaleDate").value = localDateValue();
    $("#leadSaleValue").focus();
  }
  function resetLeadDialog() {
    $("#leadForm").reset();
    leadOpenedStatus = "";
    saleExitDecision = "";
    $("#leadId").value = "";
    $("#leadModalEyebrow").textContent = "NOVO REGISTRO";
    $("#leadModalTitle").textContent = "Adicionar lead";
    $("#leadStatus").value = "Novo";
    $("#leadSource").value = "Prospecção na rua";
    $("#deleteLead").classList.add("hidden");
    $("#addReminderForLead").classList.add("hidden");
    $("#leadSitePrompt").classList.add("hidden");
    $("#leadWhatsApp").classList.add("hidden");
    $("#leadGoogleProfile").classList.add("hidden");
    $("#saveSingleField").classList.add("hidden");
    resetAddSaleForm();
    const list = $("#leadSaleList");
    if (list) list.innerHTML = "";
    resetSingleFieldSave();
    scriptEditorSteps = [];
    renderScriptSteps();
    updateSaleSectionVisibility();
  }
  function openNewLead() {
    resetLeadDialog();
    leadDialog.showModal();
  }
  function deleteLeadById(id) {
    const lead = state.leads.find(function (item) { return item.id === id; });
    if (!lead || !window.confirm("Excluir " + lead.name + " e desvincular seus lembretes?")) return false;
    state.leads = state.leads.filter(function (item) { return item.id !== id; });
    state.reminders = state.reminders.map(function (item) { return item.leadId === id ? Object.assign({}, item, { leadId: "" }) : item; });
    saveState();
    renderLeads();
    renderAgenda();
    showToast("Lead excluído.");
    return true;
  }

  function splitTableRow(line) {
    let value = line.trim();
    if (value.startsWith("|")) value = value.slice(1);
    if (value.endsWith("|")) value = value.slice(0, -1);
    return value.split(/(?<!\\)\|/).map(function (cell) {
      return cell.replace(/\\\|/g, "|").trim().replace(/^["“]|["”]$/g, "");
    });
  }
  function isSeparatorRow(cells) {
    return cells.length > 0 && cells.every(function (cell) { return /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")); });
  }
  const NUMBER_MESSAGE_HEADERS = /^mensagem$/;
  function columnIndex(headers, kind) {
    const normalized = headers.map(normalize);
    const predicates = {
      competitorReviews: function (h) { return h.includes("avaliacoesdoconcorrente") || h.includes("avalconcorrente"); },
      competitor: function (h) { return h === "concorrente" || h.includes("nomedoconcorrente"); },
      reviews: function (h) { return (h === "avaliacoes" || h.includes("avaliacoesdogoogle") || h === "quantidadedeavaliacoes") && !h.includes("concorrente"); },
      name: function (h) { return ["comercio", "nome", "nomedocomercio", "negocio"].includes(h); },
      phone: function (h) { return h.includes("telefone") || h.includes("whatsapp") || h === "celular"; },
      googleUrl: function (h) { return h.includes("linkdogoogle") || h.includes("perfilnogoogle") || h.includes("googlemaps") || h.includes("urlperfilgoogle"); },
      rating: function (h) { return h === "nota" || h.includes("notamedia") || h === "avaliacao"; },
      approach: function (h) { return h === "abordagem" || h.includes("mensagemdeabertura") || (h.includes("abordagem") && !h.includes("script")); },
      message: function (h) { return h === "mensagem"; },
      script: function (h) { return h.includes("script"); },
      location: function (h) { return h.includes("bairro") || h.includes("regiao") || h.includes("cidade"); },
      category: function (h) { return h === "categoria" || h.includes("tipodenegocio"); },
      instagram: function (h) { return h === "instagram" || h.includes("perfilinstagram") || h.includes("instagramurl"); }
    };
    return normalized.findIndex(predicates[kind]);
  }
  function parseTableRows(lines, headerIndex, headers) {
    const rows = [];
    let current = null;
    for (let index = headerIndex + 1; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) continue;
      let cells = splitTableRow(line);
      if (isSeparatorRow(cells)) continue;
      if (cells.length > headers.length) {
        cells = cells.slice(0, headers.length - 1).concat([cells.slice(headers.length - 1).join(" | ")]);
      }
      if (cells.length === 1) {
        if (!current) current = cells;
        else current[current.length - 1] = (current[current.length - 1] + "\n" + cells[0]).trim();
      } else {
        if (current) rows.push(current);
        current = cells;
      }
    }
    if (current) rows.push(current);
    return rows;
  }
  function parseTable(text) {
    const lines = text.split(/\r?\n/).map(function (line) { return line.trim(); });
    const headerIndex = lines.findIndex(function (line) { return line.includes("|"); });
    if (headerIndex < 0) return { leads: [], error: "Não encontrei uma tabela Markdown. Confira se a resposta tem colunas separadas por |." };
    const headers = splitTableRow(lines[headerIndex]);
    const rows = parseTableRows(lines, headerIndex, headers);
    if (!rows.length) return { leads: [], error: "Não encontrei uma tabela Markdown. Confira se a resposta tem colunas separadas por |." };
    const indexes = {};
    ["name", "phone", "googleUrl", "reviews", "rating", "competitor", "competitorReviews", "approach", "message", "script", "location", "category", "instagram"].forEach(function (key) {
      indexes[key] = columnIndex(headers, key);
    });
    const messageColumns = headers.map(function (header, index) {
      const normalizedHeader = normalize(header).replace(/^\d+[aºª°]?/, "").replace(/\d+$/, "");
      const number = Number(String(header).replace(/\D/g, "")) || 0;
      return NUMBER_MESSAGE_HEADERS.test(normalizedHeader) ? { index: index, number: number } : null;
    }).filter(Boolean).sort(function (a, b) { return a.number - b.number; });
    if (indexes.name < 0) return { leads: [], error: "A tabela precisa ter uma coluna Comércio ou Nome." };
    if (indexes.reviews < 0) return { leads: [], error: "Não encontrei a coluna Avaliações." };
    const parsed = [];
    rows.forEach(function (cells) {
      if (isSeparatorRow(cells)) return;
      const val = function (key) {
        const index = indexes[key];
        return index >= 0 && cells[index] ? cells[index].trim() : "";
      };
      const name = val("name");
      if (!meaningfulImportValue(name) || normalize(name) === "comercio") return;
      const approachCell = val("approach");
      const legacyMessage = val("message");
      const approachIsFullScript = looksLikeScript(approachCell);
      const approachValue = approachCell && !approachIsFullScript && !isMissingValue(approachCell) ? approachCell : "";
      const scriptCell = val("script");
      let scriptSteps = scriptCell && looksLikeScript(scriptCell) ? parseScriptCell(scriptCell) : (scriptCell ? scriptFromMessage(scriptCell) : []);
      if (!scriptSteps.length) {
        const messageCells = messageColumns.map(function (column) { return (cells[column.index] || "").trim(); }).filter(function (value) { return value && !isMissingValue(value); });
        if (messageCells.length === 1) scriptSteps = looksLikeScript(messageCells[0]) ? parseScriptCell(messageCells[0]) : scriptFromMessage(messageCells[0]);
        else scriptSteps = messageCells.map(function (value, index) { return scriptStepFromText(index, value); });
      }
      if (!scriptSteps.length) {
        const fallbackMessage = approachCell || legacyMessage;
        if (fallbackMessage && !isMissingValue(fallbackMessage)) {
          scriptSteps = looksLikeScript(fallbackMessage) ? parseScriptCell(fallbackMessage) : scriptFromMessage(fallbackMessage);
        }
      }
      parsed.push({
        id: uid(), name: name, phone: val("phone"), googleUrl: val("googleUrl"), category: val("category") || state.promptCategory,
        location: val("location") || state.promptLocation, reviews: val("reviews"), rating: val("rating"),
        instagram: val("instagram"), reviewUrl: "", website: "",
        competitor: val("competitor"), competitorReviews: val("competitorReviews"), approach: approachValue,
        message: (scriptSteps[0] && scriptSteps[0].text) || approachValue || legacyMessage, notes: "", source: "Pesquisa online", status: "Novo",
        links: [], siteProjectFolder: "", siteImagesFolder: "",
        script: scriptSteps,
        statusHistory: [{ at: new Date().toISOString(), from: "", to: "Novo" }],
        createdAt: new Date().toISOString()
      });
    });
    return parsed.length ? { leads: parsed, error: "" } : { leads: [], error: "A tabela não tem linhas de comércio para importar." };
  }
  const missingValueTokens = ["", "na", "naoencontrado", "naoinformado", "naodisponivel", "naolocalizado", "naolocalizada", "nd", "n/a", "semregistro", "semtelefone", "semtelefoneinformado", "desconhecido", "unknown", "null", "undefined"];
  function isMissingValue(value) {
    const text = String(value == null ? "" : value).trim();
    const normalized = normalize(text);
    return !text || missingValueTokens.includes(normalized) || text === "-" || text === "—";
  }
  function normalizedProfileUrl(value) {
    if (isMissingValue(value)) return "";
    try {
      const url = new URL(String(value).trim());
      if (!["http:", "https:"].includes(url.protocol)) return "";
      const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
      const pathname = url.pathname.replace(/\/+$/, "").toLowerCase();
      const isGoogleMaps = hostname === "maps.app.goo.gl" || (/(^|\.)google\./i.test(hostname) && /\/maps(?:\/|$)/i.test(url.pathname));
      if (!isGoogleMaps) return "";

      const queryPlaceId = url.searchParams.get("query_place_id") || url.searchParams.get("place_id") || "";
      const queryText = Array.from(url.searchParams.values()).join(" ");
      const queryPlaceIdMatch = queryText.match(/(?:^|[?&\s])place_id\s*[:=]\s*([A-Za-z0-9_-]+)/i);
      const pathPlaceIdMatch = url.pathname.match(/!1s([^!/?&]+)/i);
      const placeId = queryPlaceId || (queryPlaceIdMatch && queryPlaceIdMatch[1]) || (pathPlaceIdMatch && pathPlaceIdMatch[1]);
      if (placeId) return "google-place-id:" + placeId.trim();

      const cid = url.searchParams.get("cid");
      if (cid) return "google-cid:" + cid.trim();

      if (hostname === "maps.app.goo.gl") return pathname ? hostname + pathname : "";

      const placePathMatch = url.pathname.match(/\/maps\/place\/([^/]+)/i);
      if (!placePathMatch || !placePathMatch[1]) return "";
      const placeSlug = normalize(decodeURIComponent(placePathMatch[1]));
      return placeSlug ? hostname + "/maps/place/" + placeSlug : "";
    } catch (_) { return ""; }
  }
  function duplicateKey(lead) {
    const normalizedName = normalize(lead.name);
    const name = isMissingValue(lead.name) ? "" : normalizedName;
    let phone = digits(lead.phone);
    if (phone.length > 11 && phone.startsWith("55")) phone = phone.slice(2);
    if (phone.length < 10 || phone.length > 11 || /^([0-9])\1+$/.test(phone)) phone = "";
    return { name: name, phone: phone, googleUrl: normalizedProfileUrl(lead.googleUrl) };
  }
  function duplicateMatchReasons(first, second) {
    return duplicateReasonsFromKeys(duplicateKey(first), duplicateKey(second));
  }
  function duplicateReasonsFromKeys(firstKey, secondKey) {
    const reasons = [];
    if (firstKey.name && firstKey.name === secondKey.name) reasons.push("Nome igual");
    if (firstKey.phone && firstKey.phone === secondKey.phone) reasons.push("Telefone igual");
    if (firstKey.googleUrl && firstKey.googleUrl === secondKey.googleUrl) reasons.push("Ficha do Google igual");
    return reasons;
  }
  const importFields = [
    ["name", "Nome"], ["phone", "Telefone"], ["googleUrl", "Ficha do Google"], ["category", "Categoria"],
    ["location", "Região"], ["reviews", "Avaliações"], ["rating", "Nota"], ["competitor", "Concorrente"],
    ["competitorReviews", "Avaliações do concorrente"], ["approach", "Abordagem (1ª mensagem)"], ["script", "Script completo"]
  ];
  const mergeFields = importFields.concat([["source", "Origem"], ["notes", "Observações"]]);
  function meaningfulImportValue(value) {
    return !isMissingValue(value);
  }
  function firstScriptText(record) {
    const steps = normalizeScriptSteps(record && record.script);
    const first = steps.find(function (step) { return String(step.text || "").trim(); });
    return first ? String(first.text).trim() : String((record && record.message) || "").trim();
  }
  function importFieldEqual(key, a, b) {
    if (key === "phone") return duplicateKey({ phone: a }).phone === duplicateKey({ phone: b }).phone;
    if (key === "googleUrl") return normalizedProfileUrl(a) === normalizedProfileUrl(b);
    return normalize(a) === normalize(b);
  }
  function importFieldValue(record, key) {
    if (key === "script") return scriptStepsText(record ? record.script : "");
    if (key === "approach") {
      const explicit = record && typeof record.approach === "string" ? record.approach.trim() : "";
      return explicit || firstScriptText(record);
    }
    return record ? record[key] : "";
  }
  function approachText(record) {
    return importFieldValue(record, "approach");
  }
  function setLeadApproach(lead, value) {
    const text = String(value == null ? "" : value).trim();
    if (!text) return;
    const steps = normalizeScriptSteps(lead.script);
    if (steps.length) {
      steps[0].text = text;
      lead.script = steps;
    } else {
      lead.script = scriptFromMessage(text);
    }
    lead.approach = text;
    lead.message = text;
  }
  function cloneScriptSteps(value) {
    return normalizeScriptSteps(value).map(function (step) {
      return { num: step.num, title: step.title, text: step.text, note: step.note };
    });
  }
  function selectedImportTarget(item) {
    return item.targets.find(function (target) { return target.type === item.selectedType && target.id === item.selectedId; }) || item.targets[0];
  }
  function defaultImportChoices(incoming, target) {
    const choices = {};
    importFields.forEach(function (field) {
      const key = field[0];
      const current = importFieldValue(target, key);
      const incomingValue = importFieldValue(incoming, key);
      choices[key] = meaningfulImportValue(incomingValue) && !meaningfulImportValue(current) ? "incoming" : "current";
    });
    return choices;
  }
  function setImportChoices(item, mode, target) {
    item.touched = {};
    importFields.forEach(function (field) {
      const key = field[0];
      const currentOk = meaningfulImportValue(importFieldValue(target, key));
      const incomingOk = meaningfulImportValue(importFieldValue(item.incoming, key));
      if (mode === "all") item.choices[key] = incomingOk ? "incoming" : "current";
      else if (mode === "fill") item.choices[key] = !currentOk && incomingOk ? "incoming" : "current";
      else item.choices[key] = "current";
    });
  }
  function importIncomingKeys(item) {
    const target = selectedImportTarget(item);
    if (!target) return [];
    return importFields.map(function (field) { return field[0]; }).filter(function (key) {
      if (item.choices[key] !== "incoming") return false;
      const incomingValue = importFieldValue(item.incoming, key);
      if (!meaningfulImportValue(incomingValue)) return false;
      const currentValue = importFieldValue(target.lead, key);
      if (!meaningfulImportValue(currentValue)) return true;
      return !importFieldEqual(key, currentValue, incomingValue);
    });
  }
  function appliedImportKeys(item) {
    const keys = importIncomingKeys(item);
    return keys.indexOf("script") >= 0 && keys.indexOf("approach") >= 0
      ? keys.filter(function (key) { return key !== "approach"; })
      : keys;
  }
  function findDuplicateTargets(incoming, pool, type) {
    return pool.map(function (lead) {
      return { type: type, id: lead.id, lead: lead, reasons: duplicateMatchReasons(incoming, lead) };
    }).filter(function (target) { return target.reasons.length > 0; });
  }
  function duplicateStatus(lead) {
    const status = STATUSES.includes(lead.status) ? lead.status : "Novo";
    if (status === "Novo") return "Sem mensagem registrada · Novo";
    if (["Mandei", "Respondeu", "Sem resposta"].includes(status)) return "Mensagem enviada · " + status;
    return "Já contatado · " + status;
  }
  function pairKey(pair) {
    return pair.first.id + "|" + pair.second.id;
  }
  function mergeFieldCount(lead) {
    return mergeFields.filter(function (field) { return meaningfulImportValue(importFieldValue(lead, field[0])); }).length;
  }
  function defaultMergeBase(first, second) {
    const firstScore = STATUSES.indexOf(first.status || "Novo") * 100 + mergeFieldCount(first) + salesForLead(first.id).length * 60;
    const secondScore = STATUSES.indexOf(second.status || "Novo") * 100 + mergeFieldCount(second) + salesForLead(second.id).length * 60;
    return secondScore > firstScore ? "second" : "first";
  }
  function defaultMergeSelection(pair, base) {
    const side = base === "second" ? "second" : "first";
    const otherSide = side === "first" ? "second" : "first";
    const baseLead = side === "first" ? pair.first : pair.second;
    const otherLead = otherSide === "first" ? pair.first : pair.second;
    const fields = {};
    mergeFields.forEach(function (field) {
      const key = field[0];
      const baseValue = importFieldValue(baseLead, key);
      const otherValue = importFieldValue(otherLead, key);
      fields[key] = meaningfulImportValue(baseValue) ? side : (meaningfulImportValue(otherValue) ? otherSide : side);
    });
    return { base: side, fields: fields, touched: {} };
  }
  function mergeSelectionFor(pair) {
    const key = pairKey(pair);
    const current = existingDuplicateSelections[key];
    if (current && current.fields) {
      mergeFields.forEach(function (field) {
        if (!current.fields[field[0]]) current.fields[field[0]] = current.base;
      });
      current.touched = current.touched || {};
      return current;
    }
    const selection = defaultMergeSelection(pair, defaultMergeBase(pair.first, pair.second));
    existingDuplicateSelections[key] = selection;
    return selection;
  }
  function mergeOtherFieldCount(pair, selection) {
    const otherSide = selection.base === "first" ? "second" : "first";
    const baseLead = selection.base === "first" ? pair.first : pair.second;
    const otherLead = otherSide === "first" ? pair.first : pair.second;
    return mergeFields.filter(function (field) {
      const key = field[0];
      if (selection.fields[key] !== otherSide) return false;
      const value = importFieldValue(otherLead, key);
      if (!meaningfulImportValue(value)) return false;
      const baseValue = importFieldValue(baseLead, key);
      return !meaningfulImportValue(baseValue) || !importFieldEqual(key, baseValue, value);
    }).length;
  }
  function shortValue(value, limit) {
    const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
  }
  function fieldValueMarkup(record, key) {
    const value = importFieldValue(record, key);
    if (!meaningfulImportValue(value)) return '<span class="dup-empty">(vazio)</span>';
    if (key === "script") {
      const count = normalizeScriptSteps(record.script).length;
      return '<span class="dup-script-count">' + count + ' mensagem(ns)</span>';
    }
    if (key === "googleUrl") {
      const href = googleProfileHref(value);
      if (href) return '<a class="dup-link" href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">Abrir no Google Maps</a>';
    }
    return escapeHtml(shortValue(value, key === "notes" || key === "approach" ? 180 : 90));
  }
  function fullTextMarkup(record, key, label) {
    const value = importFieldValue(record, key);
    return '<div class="dup-script-side"><strong>' + escapeHtml(label) + '</strong>' +
      (meaningfulImportValue(value) ? '<p class="dup-script-text">' + escapeHtml(value) + '</p>' : '<span class="dup-empty">(vazio)</span>') + '</div>';
  }
  function scriptCompareMarkup(first, second, firstLabel, secondLabel) {
    const blocks = [first, second].map(function (record, index) {
      const label = index === 0 ? firstLabel : secondLabel;
      const steps = normalizeScriptSteps(record && record.script);
      if (!steps.length) return '<div class="dup-script-side"><strong>' + escapeHtml(label) + '</strong><span class="dup-empty">(sem script)</span></div>';
      return '<div class="dup-script-side"><strong>' + escapeHtml(label) + ' · ' + steps.length + ' mensagem(ns)</strong><ol class="dup-script-steps">' +
        steps.map(function (step) {
          return '<li><b>' + escapeHtml(step.title || "Mensagem") + '</b><p>' + escapeHtml(step.text) + '</p></li>';
        }).join("") + '</ol></div>';
    }).join("");
    return '<details class="dup-field-detail"><summary>Ver os dois scripts completos</summary><div class="dup-script-grid">' + blocks + '</div></details>';
  }
  function textCompareMarkup(first, second, key, firstLabel, secondLabel) {
    return '<details class="dup-field-detail"><summary>Ver os dois textos completos</summary><div class="dup-script-grid">' +
      fullTextMarkup(first, key, firstLabel) + fullTextMarkup(second, key, secondLabel) + '</div></details>';
  }
  function optionMarkup(attributes, selected, sideLabel, record, key) {
    return '<label class="dup-option' + (selected ? ' is-selected' : '') + '">' +
      '<input type="radio" ' + attributes + (selected ? ' checked' : '') + '>' +
      '<span class="dup-option-check" aria-hidden="true"></span>' +
      '<span class="dup-option-body"><small>' + escapeHtml(sideLabel) + '</small>' + fieldValueMarkup(record, key) + '</span>' +
      '</label>';
  }
  function equalFieldMarkup(label, record, key) {
    return '<div class="dup-field dup-field-equal"><div class="dup-field-head"><span class="dup-field-label">' + escapeHtml(label) + '</span><span class="dup-field-tag">Igual</span></div><div class="dup-same-value">' + fieldValueMarkup(record, key) + '</div></div>';
  }
  function importFieldRowMarkup(item, index, field) {
    const key = field[0];
    const label = field[1];
    const target = selectedImportTarget(item);
    if (!target) return "";
    const targetLead = target.lead;
    const current = importFieldValue(targetLead, key);
    const incoming = importFieldValue(item.incoming, key);
    const currentOk = meaningfulImportValue(current);
    const incomingOk = meaningfulImportValue(incoming);
    if (!currentOk && !incomingOk) return "";
    if (currentOk && incomingOk && importFieldEqual(key, current, incoming)) return equalFieldMarkup(label, targetLead, key);
    const selected = item.choices[key] === "incoming" && incomingOk ? "incoming" : "current";
    const extra = key === "script"
      ? scriptCompareMarkup(targetLead, item.incoming, "Na ficha", "Da tabela")
      : (key === "approach" || key === "notes" ? textCompareMarkup(targetLead, item.incoming, key, "Na ficha", "Da tabela") : "");
    if (!incomingOk) {
      return '<div class="dup-field"><div class="dup-field-head"><span class="dup-field-label">' + escapeHtml(label) + '</span><span class="dup-field-tag">Sem dado novo</span></div><div class="dup-same-value">' + fieldValueMarkup(targetLead, key) + '</div></div>';
    }
    return '<div class="dup-field"><div class="dup-field-head"><span class="dup-field-label">' + escapeHtml(label) + '</span><span class="dup-field-tag">Escolha</span></div><div class="dup-options">' +
      optionMarkup('name="dup-import-' + index + '-' + key + '" value="current" data-duplicate-choice="' + index + '" data-duplicate-key="' + key + '"', selected === "current", "Na ficha", targetLead, key) +
      optionMarkup('name="dup-import-' + index + '-' + key + '" value="incoming" data-duplicate-choice="' + index + '" data-duplicate-key="' + key + '"', selected === "incoming", "Da tabela", item.incoming, key) +
      '</div>' + extra + '</div>';
  }
  function mergeFieldRowMarkup(pair, selection, field) {
    const key = field[0];
    const label = field[1];
    const firstValue = importFieldValue(pair.first, key);
    const secondValue = importFieldValue(pair.second, key);
    const firstOk = meaningfulImportValue(firstValue);
    const secondOk = meaningfulImportValue(secondValue);
    if (!firstOk && !secondOk) return "";
    if (firstOk && secondOk && importFieldEqual(key, firstValue, secondValue)) return equalFieldMarkup(label, pair.first, key);
    let selected = selection.fields[key] || selection.base;
    if (selected === "first" && !firstOk) selected = secondOk ? "second" : "first";
    if (selected === "second" && !secondOk) selected = firstOk ? "first" : "second";
    const extra = key === "script"
      ? scriptCompareMarkup(pair.first, pair.second, "Ficha 1", "Ficha 2")
      : (key === "approach" || key === "notes" ? textCompareMarkup(pair.first, pair.second, key, "Ficha 1", "Ficha 2") : "");
    const groupName = "dup-merge-" + escapeHtml(pairKey(pair)) + "-" + key;
    const attrs = function (source) {
      return 'name="' + groupName + '" value="' + source + '" data-merge-field="' + escapeHtml(pairKey(pair)) + '" data-merge-key="' + key + '" data-merge-source="' + source + '"';
    };
    return '<div class="dup-field"><div class="dup-field-head"><span class="dup-field-label">' + escapeHtml(label) + '</span><span class="dup-field-tag">Escolha</span></div><div class="dup-options">' +
      optionMarkup(attrs("first"), selected === "first", "Ficha 1" + (firstOk ? "" : " (vazia)"), pair.first, key) +
      optionMarkup(attrs("second"), selected === "second", "Ficha 2" + (secondOk ? "" : " (vazia)"), pair.second, key) +
      '</div>' + extra + '</div>';
  }
  function mergeLeadCardMarkup(pair, lead, side, selection) {
    const key = pairKey(pair);
    const isBase = selection.base === side;
    const location = [lead.category, lead.location].filter(Boolean).join(" · ");
    return '<div class="dup-ficha' + (isBase ? ' is-base' : '') + '">' +
      '<label class="dup-ficha-pick"><input type="radio" name="dup-base-' + escapeHtml(key) + '" data-merge-base="' + escapeHtml(key) + '" value="' + side + '"' + (isBase ? " checked" : "") + '><span>' + (isBase ? "Fica esta ficha" : "Escolher esta") + '</span></label>' +
      '<strong>' + escapeHtml(lead.name || "Comércio sem nome") + '</strong>' +
      '<small>' + escapeHtml(lead.phone || "Sem telefone") + (location ? " · " + escapeHtml(location) : "") + '</small>' +
      '<div class="dup-ficha-tags"><span class="dup-ficha-tag">' + escapeHtml(duplicateStatus(lead)) + '</span><span class="dup-ficha-tag">' + mergeFieldCount(lead) + ' campo(s)</span></div>' +
      '<div class="dup-ficha-actions"><button class="small-action" type="button" data-open-existing-lead="' + escapeHtml(lead.id) + '">Abrir ficha</button><button class="duplicate-delete-button" type="button" data-delete-existing-lead="' + escapeHtml(lead.id) + '" aria-label="Excluir ficha de ' + escapeHtml(lead.name || "comércio sem nome") + '" title="Excluir esta ficha"><svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4h11M6 4V2.5h4V4m2.2 0-.6 9.2a1 1 0 0 1-1 .9H5.4a1 1 0 0 1-1-.9L3.8 4m2.7 2.2v5m3-5v5"/></svg></button></div>' +
      '<span class="dup-ficha-role ' + (isBase ? 'is-keep' : 'is-drop') + '">' + (isBase ? "Ficha principal" : "Ficha secundária") + '</span>' +
      '</div>';
  }
  function mergePairMarkup(pair) {
    const selection = mergeSelectionFor(pair);
    const baseLead = selection.base === "first" ? pair.first : pair.second;
    const otherLead = selection.base === "first" ? pair.second : pair.first;
    const otherCount = mergeOtherFieldCount(pair, selection);
    const remindersCount = state.reminders.filter(function (reminder) { return reminder.leadId === otherLead.id; }).length;
    const salesCount = salesForLead(otherLead.id).length;
    const evidence = pair.reasons.map(function (reason) {
      let values = "";
      if (reason === "Nome igual") values = pair.first.name;
      if (reason === "Telefone igual") values = pair.first.phone + " · " + pair.second.phone;
      if (reason === "Ficha do Google igual") values = "mesmo estabelecimento do Google Maps";
      return '<span class="dup-reason"><strong>' + escapeHtml(reason) + ':</strong> ' + escapeHtml(values) + '</span>';
    }).join("");
    const rows = mergeFields.map(function (field) { return mergeFieldRowMarkup(pair, selection, field); }).filter(Boolean).join("");
    const transferNote = [remindersCount ? remindersCount + " lembrete(s)" : "", salesCount ? salesCount + " venda(s)" : ""].filter(Boolean).join(" e ");
    const summary = '<strong>' + escapeHtml(baseLead.name || "Comércio sem nome") + '</strong> fica como ficha principal. ' +
      (otherCount ? otherCount + ' campo(s) serão copiados da outra ficha. ' : 'Nenhum dado da outra ficha será copiado. ') +
      (transferNote ? 'Ao excluir a outra, ' + transferNote + ' serão movidos para esta ficha.' : 'Nenhum lembrete ou venda está ligado à outra ficha.');
    return '<article class="duplicate-card existing-duplicate-card dup-merge-card">' +
      '<div class="duplicate-card-heading"><div><strong>Possível duplicado</strong><small>Escolha a ficha que fica e clique nos dados que devem permanecer.</small></div><span class="duplicate-match-badge">' + pair.reasons.length + ' dado(s) em comum</span></div>' +
      '<div class="dup-reasons">' + evidence + '</div>' +
      '<div class="dup-ficha-grid">' + mergeLeadCardMarkup(pair, pair.first, "first", selection) + mergeLeadCardMarkup(pair, pair.second, "second", selection) + '</div>' +
      '<div class="dup-compare-head"><strong>O que fica na ficha principal?</strong><small>Cada linha é um dado. Se não clicar, continua como está.</small></div>' +
      '<div class="dup-fields">' + rows + '</div>' +
      '<div class="dup-merge-footer"><div class="dup-merge-summary">' + summary + '</div><div class="dup-merge-actions">' +
      '<button class="button button-secondary" type="button" data-merge-save="' + escapeHtml(pairKey(pair)) + '">Salvar escolhas sem excluir</button>' +
      '<button class="button button-primary" type="button" data-merge-apply="' + escapeHtml(pairKey(pair)) + '">Unificar e excluir a outra</button>' +
      '</div></div></article>';
  }
  function existingDuplicatePairs() {
    const pairs = [];
    const leads = state.leads.map(function (lead) { return { lead: lead, key: duplicateKey(lead) }; });
    for (let i = 0; i < leads.length; i += 1) {
      for (let j = i + 1; j < leads.length; j += 1) {
        const first = leads[i];
        const second = leads[j];
        const reasons = duplicateReasonsFromKeys(first.key, second.key);
        if (reasons.length) pairs.push({ first: first.lead, second: second.lead, reasons: reasons });
      }
    }
    return pairs;
  }
  function renderExistingDuplicateAnalysis() {
    const pairs = existingDuplicatePairs();
    const summary = $("#existingDuplicateSummary");
    const list = $("#existingDuplicateList");
    summary.textContent = pairs.length
      ? pairs.length + " par(es) encontrado(s) entre " + state.leads.length + " leads. Escolha abaixo qual ficha fica e clique nos dados que devem permanecer. Nota e quantidade de avaliações não contam como identidade."
      : "Nenhum duplicado encontrado entre " + state.leads.length + " leads com os critérios atuais: nome, telefone válido ou ficha real do Google.";
    list.innerHTML = pairs.length ? pairs.map(mergePairMarkup).join("") : '<div class="existing-duplicate-empty">Nenhuma ficha correspondeu. Leads sem nome, telefone válido ou identidade reconhecível da ficha do Google não são marcados como duplicados.</div>';
  }
  function mergeSelectedFields(pair, selection) {
    const baseLead = selection.base === "first" ? pair.first : pair.second;
    const firstLead = pair.first;
    const secondLead = pair.second;
    const approachSource = selection.fields.approach === "first" ? firstLead : secondLead;
    mergeFields.forEach(function (field) {
      const key = field[0];
      if (key === "approach") return;
      const source = selection.fields[key] === "first" ? firstLead : secondLead;
      if (key === "script") {
        const steps = cloneScriptSteps(source.script);
        if (steps.length) baseLead.script = steps;
        return;
      }
      if (meaningfulImportValue(importFieldValue(source, key))) baseLead[key] = source[key];
    });
    const approach = approachText(approachSource);
    const otherSide = selection.base === "first" ? "second" : "first";
    const scriptFromOther = selection.fields.script === otherSide;
    if (approach && (!scriptFromOther || (selection.touched && selection.touched.approach))) setLeadApproach(baseLead, approach);
    baseLead.script = normalizeScriptSteps(baseLead.script);
    baseLead.approach = firstScriptText(baseLead);
    baseLead.message = (baseLead.script[0] && baseLead.script[0].text) || "";
  }
  function unifyExistingPair(key, deleteOther) {
    const pair = existingDuplicatePairs().find(function (item) { return pairKey(item) === key; });
    if (!pair) {
      showToast("Este par de duplicados não está mais disponível.");
      renderExistingDuplicateAnalysis();
      return;
    }
    const selection = mergeSelectionFor(pair);
    const baseLead = selection.base === "first" ? pair.first : pair.second;
    const otherLead = selection.base === "first" ? pair.second : pair.first;
    const otherCount = mergeOtherFieldCount(pair, selection);
    const remindersCount = state.reminders.filter(function (reminder) { return reminder.leadId === otherLead.id; }).length;
    const salesCount = salesForLead(otherLead.id).length;
    if (deleteOther) {
      const lines = [
        "Unificar as fichas de " + (pair.first.name || "sem nome") + " e " + (pair.second.name || "sem nome") + "?",
        "",
        "Fica: " + (baseLead.name || "sem nome"),
        "Sai: " + (otherLead.name || "sem nome"),
        otherCount ? otherCount + " campo(s) serão copiados para a ficha que fica." : "Nenhum campo será copiado.",
        (remindersCount || salesCount) ? (remindersCount + " lembrete(s) e " + salesCount + " venda(s) serão movidos para a ficha que fica.") : ""
      ].filter(Boolean);
      if (!window.confirm(lines.join("\n"))) return;
    }
    mergeSelectedFields(pair, selection);
    if (deleteOther) {
      state.sales.forEach(function (sale) {
        if (sale.leadId === otherLead.id) {
          sale.leadId = baseLead.id;
          sale.leadName = baseLead.name || "Comércio sem nome";
        }
      });
      state.reminders.forEach(function (reminder) {
        if (reminder.leadId === otherLead.id) reminder.leadId = baseLead.id;
      });
      state.leads = state.leads.filter(function (lead) { return lead.id !== otherLead.id; });
    }
    state.sales.forEach(function (sale) {
      if (sale.leadId === baseLead.id) sale.leadName = baseLead.name || "Comércio sem nome";
    });
    delete existingDuplicateSelections[key];
    saveState();
    renderLeads();
    renderAgenda();
    renderReports();
    renderExistingDuplicateAnalysis();
    showToast(deleteOther ? "Fichas unificadas; a ficha secundária foi excluída." : "Escolhas salvas na ficha principal.");
  }
  function showExistingDuplicateAnalysis() {
    const panel = $("#existingDuplicatePanel");
    panel.classList.remove("hidden");
    renderExistingDuplicateAnalysis();
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function importDuplicateCardMarkup(item, index) {
    const chosen = selectedImportTarget(item);
    if (!chosen) return "";
    if (!item.choices) item.choices = defaultImportChoices(item.incoming, chosen.lead);
    const incoming = item.incoming;
    const targetOptions = item.targets.length > 1
      ? '<fieldset class="dup-targets"><legend>Qual ficha vai receber os dados?</legend>' + item.targets.map(function (target, targetIndex) {
        const selected = target.type === item.selectedType && target.id === item.selectedId;
        const label = target.type === "new" ? "Outro item desta importação: " + (target.lead.name || "Sem nome") : (target.lead.name || "Lead sem nome");
        return '<label class="dup-target"><input type="radio" name="duplicate-target-' + index + '" data-duplicate-target="' + index + '" value="' + targetIndex + '"' + (selected ? " checked" : "") + '><span><strong>' + escapeHtml(label) + '</strong><small>' + escapeHtml(target.reasons.join(" · ")) + ' · ' + escapeHtml(duplicateStatus(target.lead)) + '</small></span></label>';
      }).join("") + '</fieldset>'
      : '<div class="dup-targets-single">Comparando com <strong>' + escapeHtml(chosen.lead.name || "Lead sem nome") + '</strong><small>' + escapeHtml(chosen.reasons.join(" · ")) + ' · ' + escapeHtml(duplicateStatus(chosen.lead)) + '</small></div>';
    const rows = importFields.map(function (field) { return importFieldRowMarkup(item, index, field); }).filter(Boolean).join("");
    const changeCount = appliedImportKeys(item).length;
    return '<article class="duplicate-card dup-card">' +
      '<div class="duplicate-card-heading"><div><strong>Importado: ' + escapeHtml(incoming.name || "Comércio sem nome") + '</strong><small>' + escapeHtml(incoming.phone || "Sem telefone informado") + '</small></div><span class="duplicate-match-badge">Possível duplicado</span></div>' +
      targetOptions +
      '<div class="dup-quick-actions"><span class="dup-quick-label">Atalhos:</span><button class="dup-quick" type="button" data-duplicate-quick="keep" data-duplicate-index="' + index + '">Manter tudo</button><button class="dup-quick" type="button" data-duplicate-quick="fill" data-duplicate-index="' + index + '">Completar vazios</button><button class="dup-quick" type="button" data-duplicate-quick="all" data-duplicate-index="' + index + '">Usar tudo da tabela</button></div>' +
      '<div class="dup-compare-head"><strong>Clique no dado que deve ficar</strong><small>O que não for escolhido continua como está na ficha.</small></div>' +
      '<div class="dup-fields">' + rows + '</div>' +
      '<div class="dup-card-footer"><span class="dup-count' + (changeCount ? "" : " is-empty") + '">' + (changeCount ? changeCount + ' campo(s) marcado(s) para atualizar' : "Nada será alterado nesta ficha") + '</span></div>' +
      '</article>';
  }
  function renderDuplicateReview() {
    if (!pendingImport) return;
    const duplicateCount = pendingImport.duplicates.length;
    const updatesCount = pendingImport.duplicates.filter(function (item) { return appliedImportKeys(item).length > 0; }).length;
    const addedCount = pendingImport.addedCount;
    $("#duplicateSummary").innerHTML = '<strong>' + duplicateCount + ' possível(is) duplicado(s)</strong>' +
      '<span class="duplicate-summary-detail">' + addedCount + ' lead(s) novo(s) já adicionado(s). ' + updatesCount + ' ficha(s) com dados escolhidos para atualizar; status, observações e lembretes serão preservados.</span>';
    $("#duplicateList").innerHTML = pendingImport.duplicates.map(importDuplicateCardMarkup).join("");
    $("#duplicateReview").classList.remove("hidden");
  }
  function importTable() {
    pendingImport = null;
    $("#duplicateReview").classList.add("hidden");
    const result = parseTable($("#importText").value);
    const status = $("#importStatus");
    if (result.error) {
      status.textContent = result.error;
      status.classList.add("error-text");
      return;
    }
    const staged = [];
    const duplicates = [];
    result.leads.forEach(function (lead) {
      let targets = findDuplicateTargets(lead, state.leads, "existing");
      if (!targets.length) targets = findDuplicateTargets(lead, staged, "new");
      if (targets.length) {
        duplicates.push({ incoming: lead, targets: targets, selectedType: targets[0].type, selectedId: targets[0].id, choices: defaultImportChoices(lead, targets[0].lead) });
      } else staged.push(lead);
    });
    if (staged.length) {
      staged.forEach(function (lead) { delete lead.approach; });
      state.leads = state.leads.concat(staged);
      saveState();
      renderLeads();
      renderAgenda();
    }
    duplicates.forEach(function (item) {
      item.targets.forEach(function (target) { if (target.type === "new") target.type = "existing"; });
      if (item.selectedType === "new") item.selectedType = "existing";
    });
    $("#importText").value = "";
    pendingImport = { addedCount: staged.length, duplicates: duplicates };
    status.classList.remove("error-text");
    if (duplicates.length) {
      renderDuplicateReview();
      status.textContent = staged.length + " lead(s) novo(s) adicionado(s). Revise apenas os " + duplicates.length + " possível(is) duplicado(s).";
      showToast(staged.length + " novo(s) adicionado(s); " + duplicates.length + " duplicado(s) em revisão.");
    } else {
      $("#duplicateReview").classList.add("hidden");
      status.textContent = staged.length + " lead(s) novo(s) adicionado(s). Nenhum duplicado encontrado.";
      showToast(staged.length + " novo(s) adicionado(s) ao CRM.");
    }
  }
  function cancelImportReview() {
    const addedCount = pendingImport ? pendingImport.addedCount : 0;
    const duplicateCount = pendingImport ? pendingImport.duplicates.length : 0;
    pendingImport = null;
    $("#duplicateReview").classList.add("hidden");
    $("#duplicateSummary").innerHTML = "";
    $("#duplicateList").innerHTML = "";
    $("#importStatus").textContent = "Revisão descartada. " + addedCount + " lead(s) novo(s) permanecem no CRM; os " + duplicateCount + " duplicado(s) não foram alterados.";
    $("#importStatus").classList.remove("error-text");
  }
  function applyImportChoices(lead, item) {
    const keys = appliedImportKeys(item);
    const scriptSelected = keys.indexOf("script") >= 0;
    const approachSelected = keys.indexOf("approach") >= 0;
    const currentApproach = approachText(lead);
    keys.forEach(function (key) {
      if (key === "script" || key === "approach") return;
      if (meaningfulImportValue(item.incoming[key])) lead[key] = item.incoming[key];
    });
    if (scriptSelected) {
      const steps = cloneScriptSteps(item.incoming.script);
      if (steps.length) lead.script = steps;
    }
    if (scriptSelected && item.choices.approach === "current" && currentApproach && item.touched && item.touched.approach) setLeadApproach(lead, currentApproach);
    if (!scriptSelected && approachSelected) {
      const approach = approachText(item.incoming);
      if (approach) setLeadApproach(lead, approach);
    }
    if (scriptSelected || approachSelected) lead.approach = firstScriptText(lead);
    lead.script = normalizeScriptSteps(lead.script);
    lead.message = (lead.script[0] && lead.script[0].text) || "";
  }
  function applyImportReview() {
    if (!pendingImport) return;
    const newCount = pendingImport.addedCount;
    const duplicateCount = pendingImport.duplicates.length;
    let updateCount = 0;
    let fieldCount = 0;
    pendingImport.duplicates.forEach(function (item) {
      const target = selectedImportTarget(item);
      const keys = appliedImportKeys(item);
      const current = target ? state.leads.find(function (lead) { return lead.id === target.id; }) : null;
      if (!current || !keys.length) return;
      applyImportChoices(current, item);
      updateCount += 1;
      fieldCount += keys.length;
    });
    if (updateCount) saveState();
    pendingImport = null;
    $("#duplicateReview").classList.add("hidden");
    $("#duplicateSummary").innerHTML = "";
    $("#duplicateList").innerHTML = "";
    const ignoredCount = duplicateCount - updateCount;
    $("#importStatus").textContent = newCount + " lead(s) novo(s) já adicionados; " + updateCount + " ficha(s) atualizada(s) com " + fieldCount + " campo(s) e " + ignoredCount + " duplicado(s) mantido(s) como estavam.";
    $("#importStatus").classList.remove("error-text");
    renderLeads();
    renderAgenda();
    showToast(updateCount + " ficha(s) atualizada(s); " + ignoredCount + " duplicado(s) mantido(s) como estavam.");
  }

  function openReminder(id, defaultLeadId) {
    const reminder = id ? state.reminders.find(function (item) { return item.id === id; }) : null;
    $("#reminderForm").reset();
    $("#reminderId").value = reminder ? reminder.id : "";
    $("#reminderModalTitle").textContent = reminder ? "Editar lembrete" : "Novo lembrete";
    $("#reminderLead").innerHTML = '<option value="">Sem lead específico</option>' + state.leads.map(function (lead) {
      return '<option value="' + escapeHtml(lead.id) + '">' + escapeHtml(lead.name) + '</option>';
    }).join("");
    $("#reminderTitle").value = reminder ? reminder.title : "";
    $("#reminderDate").value = reminder ? reminder.date : localDateValue();
    $("#reminderTime").value = reminder ? reminder.time || "" : "";
    $("#reminderNotes").value = reminder ? reminder.notes || "" : "";
    $("#reminderLead").value = reminder ? reminder.leadId || "" : defaultLeadId || "";
    $("#deleteReminder").classList.toggle("hidden", !reminder);
    $("#calendarReminderHelp").textContent = reminder
      ? "Ao editar, o lembrete do CRM é atualizado. Para criar um evento no Google Calendar com esses dados, use o botão Calendar na agenda."
      : "Ao salvar um novo lembrete, o Google Calendar abrirá o evento preenchido. Revise e confirme em Salvar.";
    reminderDialog.showModal();
  }
  function renderAgenda() {
    const today = localDateValue();
    let items = state.reminders.slice();
    if (agendaFilter === "upcoming") items = items.filter(function (item) { return !item.done; });
    if (agendaFilter === "done") items = items.filter(function (item) { return item.done; });
    items.sort(function (a, b) {
      return (a.date + " " + (a.time || "23:59")).localeCompare(b.date + " " + (b.time || "23:59"));
    });
    $("#reminderList").innerHTML = items.map(function (item) {
      const lead = state.leads.find(function (entry) { return entry.id === item.leadId; });
      const overdue = !item.done && item.date < today;
      const weekday = formatDate(item.date, { weekday: "short" }).replace(".", "");
      return '<article class="reminder-card ' + (item.done ? "is-done" : "") + (overdue ? " is-overdue" : "") + '" data-reminder-id="' + escapeHtml(item.id) + '">' +
        '<div class="reminder-date"><strong>' + escapeHtml(item.date ? item.date.slice(8, 10) : "—") + '</strong><small>' + escapeHtml(weekday || "data") + '</small></div>' +
        '<div><div class="reminder-title">' + escapeHtml(item.title) + (overdue ? ' <span class="overdue-label">Atrasado</span>' : "") + '</div>' +
        '<div class="reminder-meta">' + escapeHtml(formatDate(item.date)) + (item.time ? " · " + escapeHtml(item.time) : "") + (lead ? " · " + escapeHtml(lead.name) : " · Sem lead") + '</div>' +
        (item.notes ? '<div class="reminder-notes">' + escapeHtml(item.notes) + '</div>' : "") + '</div>' +
        '<div class="reminder-actions"><button class="small-action complete" data-action="toggle">' + (item.done ? "Reabrir" : "Concluir") + '</button><button class="small-action" data-action="edit">Editar</button><button class="small-action calendar-action" data-action="calendar" title="Abrir um evento preenchido no Google Calendar">Calendar ↗</button></div></article>';
    }).join("");
    $("#emptyAgenda").classList.toggle("hidden", items.length > 0);
    if (!items.length) {
      $("#emptyAgenda h3").textContent = state.reminders.length ? "Nenhum lembrete neste filtro" : "Nenhum lembrete por enquanto";
      $("#emptyAgenda p").textContent = state.reminders.length ? "Troque o filtro para ver outros lembretes ou crie um novo." : "Crie um lembrete para uma visita, retorno ou detalhe importante de uma venda.";
      $("#emptyReminder").classList.toggle("hidden", state.reminders.length > 0);
    }
    $("#reminderList").classList.toggle("hidden", items.length === 0);
    $$(".agenda-filter").forEach(function (button) { button.classList.toggle("active", button.dataset.agenda === agendaFilter); });
    $("#reminderList").querySelectorAll(".reminder-card").forEach(function (card) {
      card.querySelector('[data-action="edit"]').addEventListener("click", function () { openReminder(card.dataset.reminderId); });
      card.querySelector('[data-action="calendar"]').addEventListener("click", function () {
        const reminder = state.reminders.find(function (item) { return item.id === card.dataset.reminderId; });
        if (reminder) openGoogleCalendarReminder(reminder);
      });
      card.querySelector('[data-action="toggle"]').addEventListener("click", function () {
        const reminder = state.reminders.find(function (item) { return item.id === card.dataset.reminderId; });
        if (reminder) {
          reminder.done = !reminder.done;
          saveState();
          renderAgenda();
          renderLeads();
        }
      });
    });
    const pending = state.reminders.filter(function (item) { return !item.done; }).length;
    $("#reminderCountBadge").textContent = String(pending);
    $("#statReminders").textContent = String(pending);
  }
  let reportPeriod = "all";
  function parseLocalDateKey(key) {
    const parts = String(key || "").split("-").map(Number);
    return parts.length === 3 && parts[0] ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date();
  }
  function earliestActivityKey() {
    let earliest = "";
    function consider(key) {
      if (key && (!earliest || key < earliest)) earliest = key;
    }
    state.leads.forEach(function (lead) {
      consider(dateKeyFromISO(lead.createdAt));
      (lead.statusHistory || []).forEach(function (entry) { consider(dateKeyFromISO(entry && entry.at)); });
    });
    state.sales.forEach(function (sale) { consider(sale.soldAt || dateKeyFromISO(sale.createdAt)); });
    return earliest;
  }
  function reportRange() {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    if (reportPeriod === "all") {
      const key = earliestActivityKey();
      const start = key ? parseLocalDateKey(key) : new Date(end);
      start.setHours(0, 0, 0, 0);
      return { start: start, end: end };
    }
    let start = new Date(end);
    if (reportPeriod === "today") start = new Date(end);
    else if (reportPeriod === "30") start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 29);
    else if (reportPeriod === "month") start = new Date(end.getFullYear(), end.getMonth(), 1);
    else start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
    return { start: start, end: end };
  }
  function dateKeyFromISO(value) {
    const ms = Date.parse(value || "");
    return Number.isFinite(ms) ? localDateKey(new Date(ms)) : "";
  }
  function statusAtEndOfDay(lead, endMs) {
    const history = Array.isArray(lead.statusHistory) ? lead.statusHistory : [];
    let current = null;
    for (let i = 0; i < history.length; i += 1) {
      const at = Date.parse((history[i] && history[i].at) || "");
      if (!Number.isFinite(at) || at > endMs) continue;
      current = history[i].to;
    }
    return current;
  }
  function buildDailyReport(range) {
    const index = {};
    const rows = [];
    for (let day = new Date(range.start); day <= range.end; day.setDate(day.getDate() + 1)) {
      const key = localDateKey(day);
      const row = { key: key, date: new Date(day), leadsNew: 0, sent: 0, responded: 0, refused: 0, noReply: 0, sold: 0, soldValue: 0, open: 0 };
      index[key] = row;
      rows.push(row);
    }
    state.leads.forEach(function (lead) {
      const createdKey = dateKeyFromISO(lead.createdAt);
      if (index[createdKey]) index[createdKey].leadsNew += 1;
      const seen = {};
      (lead.statusHistory || []).forEach(function (entry) {
        const key = dateKeyFromISO(entry && entry.at);
        const to = entry && entry.to;
        if (!key || !index[key]) return;
        if (CONTACTED_STATUSES.indexOf(to) >= 0 && !seen["s|" + key]) { seen["s|" + key] = true; index[key].sent += 1; }
        if (RESPONDED_STATUSES.indexOf(to) >= 0 && !seen["r|" + key]) { seen["r|" + key] = true; index[key].responded += 1; }
        if (to === "Recusa" && !seen["x|" + key]) { seen["x|" + key] = true; index[key].refused += 1; }
        if (to === "Sem resposta" && !seen["n|" + key]) { seen["n|" + key] = true; index[key].noReply += 1; }
      });
    });
    state.sales.forEach(function (sale) {
      const key = sale.soldAt || dateKeyFromISO(sale.createdAt);
      const row = index[key];
      if (!row) return;
      row.sold += 1;
      if (typeof sale.valueCents === "number" && sale.valueCents > 0) row.soldValue += sale.valueCents;
    });
    rows.forEach(function (row) {
      const day = row.date;
      const endMs = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999).getTime();
      state.leads.forEach(function (lead) {
        const status = statusAtEndOfDay(lead, endMs);
        if (status && OPEN_STATUSES.indexOf(status) >= 0) row.open += 1;
      });
    });
    return rows;
  }
  function conversionText(sold, base) {
    if (!base) return "—";
    const pct = (sold / base) * 100;
    return (pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10) + "%";
  }
  function reportCard(label, value, hint, tone) {
    return '<article class="stat-card' + (tone ? " stat-card-" + tone : "") + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong><small>' + escapeHtml(hint || "") + '</small></article>';
  }
  function renderReportChart(rows) {
    const container = $("#reportChart");
    if (!container) return;
    if (!rows.length) { container.innerHTML = '<div class="empty-small">Sem dados no período.</div>'; return; }
    const max = rows.reduce(function (m, row) { return Math.max(m, row.sent, row.sold); }, 0) || 1;
    const bars = rows.map(function (row) {
      const sentHeight = Math.max(Math.round((row.sent / max) * 100), row.sent ? 5 : 0);
      const soldHeight = Math.max(Math.round((row.sold / max) * 100), row.sold ? 5 : 0);
      const parts = row.key.split("-");
      const label = parts[2] + "/" + parts[1];
      const title = formatDate(row.key) + " — " + row.sent + " mensagem(ns), " + row.sold + " venda(s)" + (row.soldValue ? ", " + formatCurrency(row.soldValue) : "");
      return '<div class="chart-col" title="' + escapeHtml(title) + '">' +
        '<div class="chart-bars">' +
          '<span class="chart-bar chart-bar-sent" style="height:' + sentHeight + '%"></span>' +
          '<span class="chart-bar chart-bar-sold" style="height:' + soldHeight + '%"></span>' +
        '</div>' +
        '<small class="chart-label">' + escapeHtml(label) + '</small>' +
      '</div>';
    }).join("");
    const soldRows = rows.filter(function (row) { return row.sold > 0; });
    let footer = "";
    if (soldRows.length) {
      footer = '<div class="chart-sales">' + soldRows.map(function (row) {
        const parts = row.key.split("-");
        return '<span class="chart-sale-chip"><b>' + escapeHtml(parts[2] + "/" + parts[1]) + '</b> ' + escapeHtml(formatCurrency(row.soldValue)) + '</span>';
      }).join("") + '</div>';
    }
    container.innerHTML = '<div class="chart-scroll"><div class="chart-track">' + bars + '</div></div>' + footer;
  }
  function renderReportTable(rows) {
    const table = $("#reportTable");
    if (!table) return;
    if (!rows.length) { table.innerHTML = ""; return; }
    const head = '<thead><tr><th>Dia</th><th>Novos</th><th>Mensagens</th><th>Respostas</th><th>Recusas</th><th>Sem resposta</th><th>Aguardando</th><th>Em aberto</th><th>Vendas</th><th>Valor</th><th>Conversão</th></tr></thead>';
    const body = rows.map(function (row) {
      const waiting = Math.max(row.sent - row.responded - row.refused - row.noReply, 0);
      return '<tr><td>' + escapeHtml(formatDate(row.key, { weekday: "short", day: "2-digit", month: "2-digit" })) + '</td>' +
        '<td>' + row.leadsNew + '</td><td>' + row.sent + '</td><td>' + row.responded + '</td><td>' + row.refused + '</td><td>' + row.noReply + '</td>' +
        '<td>' + waiting + '</td><td>' + row.open + '</td><td>' + row.sold + '</td>' +
        '<td>' + (row.soldValue ? escapeHtml(formatCurrency(row.soldValue)) : "—") + '</td>' +
        '<td>' + escapeHtml(conversionText(row.sold, row.sent)) + '</td></tr>';
    }).join("");
    table.innerHTML = head + '<tbody>' + body + '</tbody>';
  }
  function renderRecentSales() {
    const container = $("#recentSales");
    if (!container) return;
    const sales = state.sales.slice().sort(function (a, b) {
      return String(b.soldAt || "").localeCompare(String(a.soldAt || "")) || (Date.parse(b.updatedAt || "") || 0) - (Date.parse(a.updatedAt || "") || 0);
    }).slice(0, 12);
    if (!sales.length) { container.innerHTML = '<div class="empty-small">Nenhuma venda registrada ainda. Marque um lead como Vendido para começar.</div>'; return; }
    container.innerHTML = sales.map(function (sale) {
      const lead = state.leads.find(function (item) { return item.id === sale.leadId; });
      const subtitle = [sale.category, sale.location].filter(Boolean).join(" · ") || "Sem categoria ou região";
      const value = typeof sale.valueCents === "number" && sale.valueCents > 0 ? escapeHtml(formatCurrency(sale.valueCents)) : '<span class="report-value-pending">valor pendente</span>';
      const date = sale.soldAt ? formatDate(sale.soldAt, { day: "2-digit", month: "short", year: "numeric" }) : "sem data";
      return '<article class="sale-row"' + (lead ? ' data-sale-lead="' + escapeHtml(sale.leadId) + '" tabindex="0" role="button" aria-label="Abrir venda de ' + escapeHtml(sale.leadName) + '"' : "") + '>' +
        '<div class="sale-main"><strong>' + escapeHtml(sale.leadName || "Comércio sem nome") + '</strong><small>' + escapeHtml(subtitle) + " · " + escapeHtml(date) + (lead ? "" : " · lead excluído") + '</small></div>' +
        '<div class="sale-value">' + value + '</div>' +
        (lead ? '<span class="lead-arrow">›</span>' : "") + '</article>';
    }).join("");
  }
  function renderReports() {
    const cards = $("#reportCards");
    if (!cards) return;
    const range = reportRange();
    const rows = buildDailyReport(range);
    const totals = rows.reduce(function (acc, row) {
      acc.leadsNew += row.leadsNew; acc.sent += row.sent; acc.responded += row.responded;
      acc.refused += row.refused; acc.noReply += row.noReply; acc.sold += row.sold; acc.soldValue += row.soldValue;
      return acc;
    }, { leadsNew: 0, sent: 0, responded: 0, refused: 0, noReply: 0, sold: 0, soldValue: 0 });
    const contacted = {};
    const startKey = rows.length ? rows[0].key : localDateKey(range.start);
    const endKey = rows.length ? rows[rows.length - 1].key : localDateKey(range.end);
    state.leads.forEach(function (lead) {
      (lead.statusHistory || []).forEach(function (entry) {
        const key = dateKeyFromISO(entry && entry.at);
        if (key && key >= startKey && key <= endKey && CONTACTED_STATUSES.indexOf(entry.to) >= 0) contacted[lead.id] = true;
      });
    });
    const contactedCount = Object.keys(contacted).length;
    const openNow = state.leads.filter(function (lead) { return OPEN_STATUSES.indexOf(lead.status) >= 0; }).length;
    const waiting = Math.max(totals.sent - totals.responded - totals.refused - totals.noReply, 0);
    const ticket = totals.sold ? Math.round(totals.soldValue / totals.sold) : null;
    cards.innerHTML = [
      reportCard("Mensagens enviadas", String(totals.sent), "leads contatados no período"),
      reportCard("Respostas", String(totals.responded), "dos contatados no período"),
      reportCard("Recusas", String(totals.refused), "dos contatados no período"),
      reportCard("Sem resposta", String(totals.noReply), "dos contatados no período"),
      reportCard("Aguardando resposta", String(waiting), "contatados sem desfecho ainda"),
      reportCard("Em aberto", String(openNow), "no pipeline, agora"),
      reportCard("Novos leads", String(totals.leadsNew), "cadastrados no período"),
      reportCard("Vendas", String(totals.sold), "no período"),
      reportCard("Valor vendido", formatCurrency(totals.soldValue), "total no período"),
      reportCard("Ticket médio", ticket === null ? "—" : formatCurrency(ticket), "por venda"),
      reportCard("Conversão do período", conversionText(totals.sold, contactedCount), "vendas ÷ contatados", "highlight"),
      reportCard("Conversão por envio", conversionText(totals.sold, totals.sent), "vendas ÷ mensagens", "highlight")
    ].join("");
    renderReportChart(rows);
    renderReportTable(rows);
    renderRecentSales();
    $$(".report-period-button").forEach(function (button) {
      button.classList.toggle("active", button.dataset.period === reportPeriod);
    });
  }
  function renderAll() { renderPrompt(); renderLeads(); renderAgenda(); renderReports(); renderReviewTool(); renderModels(); }

  $$(".nav-item").forEach(function (button) {
    button.addEventListener("click", function () { setView(button.dataset.view); });
  });
  $$("[data-go]").forEach(function (button) {
    button.addEventListener("click", function () {
      const target = button.dataset.go;
      const nav = $('.nav-item[data-view="' + target + '"]');
      if (nav) nav.click();
    });
  });

  $("#reviewGenerate").addEventListener("click", function () { startReviewGeneration($("#reviewInput").value); });
  $("#reviewInput").addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    startReviewGeneration($("#reviewInput").value);
  });
  $("#reviewClear").addEventListener("click", resetReviewTool);
  $("#reviewCopy").addEventListener("click", function () {
    const link = $("#reviewResultLink").value;
    if (!link) { showToast("Nada para copiar."); return; }
    copyText(link, "Link de avaliação copiado.");
  });
  $("#reviewResolvedGenerate").addEventListener("click", function () { startReviewGeneration($("#reviewResolvedInput").value); });
  $("#reviewResolvedInput").addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    startReviewGeneration($("#reviewResolvedInput").value);
  });
  $("#reviewPaste").addEventListener("click", pasteReviewResolved);
  $("#reviewRecoveryOpen").addEventListener("click", function () {
    if (!reviewPendingUrl) return;
    window.open(reviewPendingUrl, "_blank", "noopener,noreferrer");
  });
  $("#reviewSaveLead").addEventListener("click", saveReviewToLead);

  $("#promptCategory").addEventListener("input", function (event) { state.promptCategory = event.target.value; $("#promptEditor").value = readyPrompt(); renderPromptBlocks(); saveState(); });
  $("#sidebarToggle").addEventListener("click", function () { setSidebarCollapsed(!document.body.classList.contains("sidebar-collapsed")); });
  $("#promptLocation").addEventListener("input", function (event) { state.promptLocation = event.target.value; $("#promptEditor").value = readyPrompt(); renderPromptBlocks(); saveState(); });
  $("#promptSections").addEventListener("input", function (event) {
    const textarea = event.target.closest("[data-prompt-block-index]");
    if (!textarea) return;
    const index = Number(textarea.dataset.promptBlockIndex);
    state.promptBlocks[index].text = promptTemplate(textarea.value, state.promptCategory.trim(), state.promptLocation.trim());
    state.promptText = composePrompt(state.promptBlocks);
    $("#promptEditor").value = readyPrompt();
    saveState();
  });
  $("#promptEditor").addEventListener("input", function (event) {
    state.promptText = promptTemplate(event.target.value, state.promptCategory.trim(), state.promptLocation.trim());
    state.promptBlocks = promptBlocksFromText(state.promptText);
    saveState();
  });
  $("#promptEditor").addEventListener("change", renderPromptBlocks);
  $("#savePromptHistory").addEventListener("click", function () {
    if (rememberPrompt(readyPrompt())) showToast("Versão salva no histórico.");
  });
  $("#promptHistoryList").addEventListener("click", function (event) {
    const button = event.target.closest("[data-history-index]");
    if (!button) return;
    const item = state.promptHistory[Number(button.dataset.historyIndex)];
    if (!item) return;
    state.promptText = promptTemplate(item.text, state.promptCategory, state.promptLocation);
    state.promptBlocks = promptBlocksFromText(state.promptText);
    saveState();
    renderPrompt();
    showToast("Prompt restaurado do histórico.");
    $("#promptEditor").focus();
  });
  $("#copyPrompt").addEventListener("click", function () {
    const ready = readyPrompt();
    rememberPrompt(ready);
    copyText(ready, "Prompt pronto copiado.");
  });
  $("#restorePrompt").addEventListener("click", function () {
    if (!window.confirm("Restaurar o texto original do prompt?")) return;
    state.promptText = defaultPrompt;
    state.promptBlocks = promptBlocksFromText(defaultPrompt);
    saveState();
    renderPrompt();
    showToast("Modelo original restaurado.");
  });

  $("#toggleImport").addEventListener("click", function () {
    $("#importPanel").classList.toggle("hidden");
    if (!$("#importPanel").classList.contains("hidden")) $("#importText").focus();
  });
  $("#analyzeDuplicates").addEventListener("click", showExistingDuplicateAnalysis);
  $("#closeExistingDuplicatePanel").addEventListener("click", function () { $("#existingDuplicatePanel").classList.add("hidden"); });
  $("#existingDuplicateList").addEventListener("click", function (event) {
    const openButton = event.target.closest("[data-open-existing-lead]");
    if (openButton) { openLead(openButton.dataset.openExistingLead); return; }
    const deleteButton = event.target.closest("[data-delete-existing-lead]");
    if (deleteButton) {
      if (deleteLeadById(deleteButton.dataset.deleteExistingLead)) renderExistingDuplicateAnalysis();
      return;
    }
    const saveButton = event.target.closest("[data-merge-save]");
    if (saveButton) { unifyExistingPair(saveButton.dataset.mergeSave, false); return; }
    const applyButton = event.target.closest("[data-merge-apply]");
    if (applyButton) { unifyExistingPair(applyButton.dataset.mergeApply, true); return; }
  });
  $("#existingDuplicateList").addEventListener("change", function (event) {
    const baseRadio = event.target.closest("[data-merge-base]");
    if (baseRadio) {
      const pair = existingDuplicatePairs().find(function (item) { return pairKey(item) === baseRadio.dataset.mergeBase; });
      if (pair) {
        existingDuplicateSelections[baseRadio.dataset.mergeBase] = defaultMergeSelection(pair, baseRadio.value);
        renderExistingDuplicateAnalysis();
      }
      return;
    }
    const fieldRadio = event.target.closest("[data-merge-field]");
    if (fieldRadio) {
      const pair = existingDuplicatePairs().find(function (item) { return pairKey(item) === fieldRadio.dataset.mergeField; });
      if (pair) {
        const selection = mergeSelectionFor(pair);
        selection.fields[fieldRadio.dataset.mergeKey] = fieldRadio.dataset.mergeSource;
        selection.touched[fieldRadio.dataset.mergeKey] = true;
        renderExistingDuplicateAnalysis();
      }
    }
  });
  $("#emptyImport").addEventListener("click", function () { $("#importPanel").classList.remove("hidden"); $("#importText").focus(); });
  $("#closeImport").addEventListener("click", function () { $("#importPanel").classList.add("hidden"); });
  $("#importLeads").addEventListener("click", importTable);
  $("#cancelImportReview").addEventListener("click", cancelImportReview);
  $("#applyImport").addEventListener("click", applyImportReview);
  $("#duplicateReview").addEventListener("click", function (event) {
    const bulk = event.target.closest("[data-import-bulk]");
    if (!bulk || !pendingImport) return;
    pendingImport.duplicates.forEach(function (item) {
      const target = selectedImportTarget(item);
      if (target) setImportChoices(item, bulk.dataset.importBulk, target.lead);
    });
    renderDuplicateReview();
  });
  $("#duplicateList").addEventListener("click", function (event) {
    const quick = event.target.closest("[data-duplicate-quick]");
    if (quick && pendingImport) {
      const item = pendingImport.duplicates[Number(quick.dataset.duplicateIndex)];
      const target = item && selectedImportTarget(item);
      if (item && target) {
        setImportChoices(item, quick.dataset.duplicateQuick, target.lead);
        renderDuplicateReview();
      }
    }
  });
  $("#duplicateList").addEventListener("change", function (event) {
    const radio = event.target.closest("[data-duplicate-target]");
    if (radio && pendingImport) {
      const index = Number(radio.dataset.duplicateTarget);
      const duplicate = pendingImport.duplicates[index];
      const target = duplicate && duplicate.targets[Number(radio.value)];
      if (duplicate && target) {
        duplicate.selectedType = target.type;
        duplicate.selectedId = target.id;
        duplicate.choices = defaultImportChoices(duplicate.incoming, target.lead);
        duplicate.touched = {};
        renderDuplicateReview();
      }
      return;
    }
    const choice = event.target.closest("[data-duplicate-choice]");
    if (choice && pendingImport) {
      const duplicate = pendingImport.duplicates[Number(choice.dataset.duplicateChoice)];
      if (duplicate) {
        duplicate.choices[choice.dataset.duplicateKey] = choice.value;
        duplicate.touched = duplicate.touched || {};
        duplicate.touched[choice.dataset.duplicateKey] = true;
        renderDuplicateReview();
      }
    }
  });
  $("#newLead").addEventListener("click", openNewLead);
  $("#emptyAdd").addEventListener("click", openNewLead);
  $("#leadSearch").addEventListener("input", renderLeads);
  $("#leadList").addEventListener("click", function (event) {
    if (event.target.closest(".google-quick-link")) return;
    const row = event.target.closest(".lead-row");
    if (row) openLead(row.dataset.leadId);
  });
  $("#leadList").addEventListener("keydown", function (event) {
    if (event.target.closest("a")) return;
    const row = event.target.closest(".lead-row");
    if (row && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openLead(row.dataset.leadId);
    }
  });
  $$(".filter-tab").forEach(function (button) {
    button.addEventListener("click", function () { activeStatus = button.dataset.status; renderLeads(); });
  });
  const leadSortSelect = $("#leadSort");
  if (leadSortSelect) {
    leadSortSelect.value = leadSort;
    leadSortSelect.addEventListener("change", function (event) {
      leadSort = event.target.value;
      try { localStorage.setItem(LEAD_SORT_KEY, leadSort); } catch (_) {}
      renderLeads();
    });
  }
  $("#leadFilterCategory").addEventListener("change", function (event) { activeCategory = event.target.value; renderLeads(); });
  $("#leadFilterSource").addEventListener("change", function (event) { activeSource = event.target.value; renderLeads(); });
  $("#leadStatus").addEventListener("change", function () {
    saleExitDecision = "";
    updateSaleSectionVisibility();
  });
  $("#keepSaleOnExit").addEventListener("click", function () {
    saleExitDecision = "keep";
    $("#leadSaleExitSection").classList.add("hidden");
    showToast("Venda será mantida no histórico de relatórios.");
  });
  $("#removeSaleOnExit").addEventListener("click", function () {
    saleExitDecision = "remove";
    $("#leadSaleExitSection").classList.add("hidden");
    showToast("Venda será excluída ao salvar.");
  });
  $("#toggleAddSale").addEventListener("click", function () {
    const fields = $("#leadSaleAddFields");
    const opening = fields.classList.contains("hidden");
    fields.classList.toggle("hidden", !opening);
    if (opening) { $("#leadSaleDate").value = localDateValue(); $("#leadSaleValue").focus(); }
  });
  $("#cancelAddSale").addEventListener("click", resetAddSaleForm);
  $("#confirmAddSale").addEventListener("click", function () {
    const id = $("#leadId").value;
    const lead = state.leads.find(function (item) { return item.id === id; });
    if (!lead) return;
    const cents = currencyToCents($("#leadSaleValue").value);
    if (cents === null || cents <= 0) { showToast("Informe o valor da venda."); $("#leadSaleValue").focus(); return; }
    createSaleForLead(lead, { valueCents: cents, soldAt: $("#leadSaleDate").value || localDateValue(), notes: $("#leadSaleNotes").value || "" });
    saveState();
    resetAddSaleForm();
    renderLeadSaleList(id);
    updateSaleSectionVisibility();
    renderReports();
    renderLeads();
    showToast("Venda adicionada ao histórico.");
  });
  $("#leadSaleList").addEventListener("click", function (event) {
    const button = event.target.closest("[data-remove-sale]");
    if (!button) return;
    const saleId = button.dataset.removeSale;
    if (!window.confirm("Excluir esta venda do histórico de relatórios?")) return;
    removeSaleById(saleId);
    saveState();
    const id = $("#leadId").value;
    renderLeadSaleList(id);
    updateSaleSectionVisibility();
    renderReports();
    renderLeads();
    showToast("Venda excluída do histórico.");
  });
  $("#leadSaleValue").addEventListener("blur", function () {
    if (!this.value.trim()) return;
    const cents = currencyToCents(this.value);
    if (cents !== null) this.value = formatCurrencyInput(cents);
  });
  $$(".report-period-button").forEach(function (button) {
    button.addEventListener("click", function () { reportPeriod = button.dataset.period; renderReports(); });
  });
  $("#recentSales").addEventListener("click", function (event) {
    const row = event.target.closest("[data-sale-lead]");
    if (row) openLead(row.dataset.saleLead);
  });
  $("#recentSales").addEventListener("keydown", function (event) {
    const row = event.target.closest("[data-sale-lead]");
    if (row && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openLead(row.dataset.saleLead); }
  });

  $("#leadScriptSteps").addEventListener("click", function (event) {
    const copy = event.target.closest("[data-script-copy]");
    if (copy) {
      const text = copy.closest(".script-step").querySelector("[data-script-text]").value.trim();
      if (!text) { showToast("Escreva o texto desta etapa antes de copiar."); return; }
      copyText(text, "Etapa copiada. Cole no WhatsApp.");
      return;
    }
    const remove = event.target.closest("[data-script-remove]");
    if (remove) {
      const target = Number(remove.dataset.scriptRemove);
      const steps = [];
      $$("#leadScriptSteps .script-step").forEach(function (node, index) {
        if (index === target) return;
        const textArea = node.querySelector("[data-script-text]");
        const stepIndex = Number(textArea.dataset.scriptText);
        const text = textArea.value.trim();
        if (!text) return;
        steps.push({
          num: 0,
          title: node.querySelector('[data-script-title="' + stepIndex + '"]').value.trim() || "Mensagem " + (steps.length + 1),
          text: text,
          note: (node.querySelector('[data-script-note="' + stepIndex + '"]') || {}).value || ""
        });
      });
      scriptEditorSteps = normalizeScriptSteps(steps);
      renderScriptSteps();
    }
  });
  $("#addScriptStep").addEventListener("click", function () {
    scriptEditorSteps = collectScriptSteps();
    scriptEditorSteps.push({ num: 0, title: "", text: "", note: "" });
    renderScriptSteps();
    const nodes = $$("#leadScriptSteps .script-step");
    const last = nodes[nodes.length - 1];
    if (last) last.querySelector("[data-script-text]").focus();
  });
  $("#copyLeadScript").addEventListener("click", function () {
    const steps = collectScriptSteps();
    if (!steps.length) { showToast("Nenhuma etapa para copiar."); return; }
    scriptEditorSteps = steps;
    renderScriptSteps();
    copyText(scriptFullCopyText(steps), "Script completo copiado.");
  });

  function markSingleFieldChanged(event) {
    const field = singleFieldMap[event.target.id];
    if (!field || !$("#leadId").value) return;
    pendingSingleField = event.target.id;
    const button = $("#saveSingleField");
    button.textContent = "Salvar só “" + field[1] + "”";
    button.disabled = false;
  }
  $("#leadForm").addEventListener("input", markSingleFieldChanged);
  $("#leadForm").addEventListener("change", markSingleFieldChanged);
  $("#saveSingleField").addEventListener("click", function () {
    const id = $("#leadId").value;
    const field = singleFieldMap[pendingSingleField];
    const lead = state.leads.find(function (item) { return item.id === id; });
    if (!lead || !field) return;
    const input = $("#" + pendingSingleField);
    const statusChanged = leadOpenedStatus === SOLD_STATUS && $("#leadStatus").value !== SOLD_STATUS && salesForLead(lead.id).length > 0;
    if (statusChanged && !ensureSaleExitDecision()) {
      showToast("Escolha o que fazer com a venda registrada antes de salvar.");
      return;
    }
    if (pendingSingleField === "leadStatus" || statusChanged) {
      const result = finalizeLeadStatus(lead, false, $("#leadStatus").value, { value: $("#leadSaleValue").value, date: $("#leadSaleDate").value, notes: $("#leadSaleNotes").value });
      if (result.error) { handleSaleError(result); return; }
      leadOpenedStatus = lead.status;
      saleExitDecision = "";
      $("#leadModalEyebrow").textContent = "LEAD · " + lead.status.toUpperCase();
      updateSaleSectionVisibility();
    }
    if (pendingSingleField !== "leadStatus") {
      lead[field[0]] = input.value.trim();
    }
    updateSaleSnapshot(lead);
    saveState();
    renderLeads();
    renderAgenda();
    renderReports();
    updateLeadActions(lead);
    const savedLabel = field[1];
    resetSingleFieldSave();
    showToast(savedLabel + " salvo. Os outros dados não foram alterados.");
  });

  $("#leadForm").addEventListener("submit", function (event) {
    event.preventDefault();
    const id = $("#leadId").value;
    const current = id ? state.leads.find(function (lead) { return lead.id === id; }) : null;
    const steps = collectScriptSteps();
    const lead = {
      id: id || uid(), name: $("#leadName").value.trim(), phone: $("#leadPhone").value.trim(),
      category: $("#leadCategory").value.trim(), location: $("#leadLocation").value.trim(),
      googleUrl: $("#leadGoogleUrl").value.trim(),
      instagram: $("#leadInstagram").value.trim(), reviewUrl: $("#leadReviewUrl").value.trim(), website: $("#leadWebsite").value.trim(),
      source: $("#leadSource").value, reviews: $("#leadReviews").value.trim(), rating: $("#leadRating").value.trim(),
      competitor: $("#leadCompetitor").value.trim(), competitorReviews: $("#leadCompetitorReviews").value.trim(),
      status: current ? current.status : "Novo", message: "", notes: $("#leadNotes").value.trim(),
      links: current && Array.isArray(current.links) ? current.links : [],
      siteProjectFolder: current ? current.siteProjectFolder || "" : "",
      siteImagesFolder: current ? current.siteImagesFolder || "" : "",
      script: steps,
      statusHistory: current && Array.isArray(current.statusHistory) ? current.statusHistory.slice() : [],
      createdAt: current ? current.createdAt : new Date().toISOString()
    };
    if (!leadPayloadHasData(Object.assign({}, lead, { script: steps })) && !$("#leadSaleValue").value.trim()) {
      showToast("Preencha ao menos um dado do lead para salvar.");
      return;
    }
    if (steps.length) lead.script = steps;
    else if (current) lead.script = Array.isArray(current.script) ? current.script : [];
    else lead.script = defaultScriptFor(lead);
    lead.message = leadFirstMessage(lead);
    const statusChanged = current && leadOpenedStatus === SOLD_STATUS && $("#leadStatus").value !== SOLD_STATUS && salesForLead(current.id).length > 0;
    if (statusChanged && !ensureSaleExitDecision()) {
      showToast("Escolha o que fazer com a venda registrada antes de salvar.");
      return;
    }
    const result = finalizeLeadStatus(lead, !current, $("#leadStatus").value, { value: $("#leadSaleValue").value, date: $("#leadSaleDate").value, notes: $("#leadSaleNotes").value });
    if (result.error) { handleSaleError(result); return; }
    saleExitDecision = "";
    if (current) {
      state.leads = state.leads.map(function (item) { return item.id === id ? lead : item; });
      showToast("Lead atualizado.");
    } else {
      state.leads.push(lead);
      showToast("Lead adicionado.");
    }
    saveState();
    leadDialog.close();
    renderLeads();
    renderAgenda();
    renderReports();
  });
  $("#deleteLead").addEventListener("click", function () {
    const id = $("#leadId").value;
    if (deleteLeadById(id)) leadDialog.close();
  });

  $("#newReminder").addEventListener("click", function () { openReminder(""); });
  $("#emptyReminder").addEventListener("click", function () { openReminder(""); });
  $("#addReminderForLead").addEventListener("click", function () {
    const leadId = $("#leadId").value;
    leadDialog.close();
    openReminder("", leadId);
  });
  $$(".agenda-filter").forEach(function (button) {
    button.addEventListener("click", function () { agendaFilter = button.dataset.agenda; renderAgenda(); });
  });
  $("#reminderForm").addEventListener("submit", function (event) {
    event.preventDefault();
    const id = $("#reminderId").value;
    const old = id ? state.reminders.find(function (item) { return item.id === id; }) : null;
    const reminder = {
      id: id || uid(), leadId: $("#reminderLead").value, title: $("#reminderTitle").value.trim(),
      date: $("#reminderDate").value, time: $("#reminderTime").value, notes: $("#reminderNotes").value.trim(),
      done: old ? old.done : false, createdAt: old ? old.createdAt : new Date().toISOString()
    };
    if (old) state.reminders = state.reminders.map(function (item) { return item.id === id ? reminder : item; });
    else state.reminders.push(reminder);
    saveState();
    if (!old) openGoogleCalendarReminder(reminder);
    reminderDialog.close();
    renderAgenda();
    renderLeads();
    showToast(old ? "Lembrete atualizado." : "Lembrete salvo. Confirme a inclusão no Google Calendar.");
  });
  $("#deleteReminder").addEventListener("click", function () {
    const id = $("#reminderId").value;
    if (!id || !window.confirm("Excluir este lembrete?")) return;
    state.reminders = state.reminders.filter(function (item) { return item.id !== id; });
    saveState();
    reminderDialog.close();
    renderAgenda();
    renderLeads();
    showToast("Lembrete excluído.");
  });

  $$("[data-close]").forEach(function (button) {
    button.addEventListener("click", function () {
      const dialog = $("#" + button.dataset.close);
      if (dialog === leadDialog) resetLeadDialog();
      dialog.close();
    });
  });
  [leadDialog, reminderDialog, sitePromptDialog].forEach(function (dialog) {
    dialog.addEventListener("click", function (event) { if (event.target === dialog) dialog.close(); });
  });
  leadDialog.addEventListener("close", resetLeadDialog);
  sitePromptDialog.addEventListener("close", function () {
    if (sitePromptDirty) saveSitePromptLinks();
    sitePromptLeadId = "";
  });
  $("#leadSitePrompt").addEventListener("click", function () { openSitePrompt($("#leadId").value); });
  $$(".models-tab").forEach(function (button) {
    button.addEventListener("click", function () { setModelTab(button.dataset.modelTab); });
  });
  $("#modelsEditor").addEventListener("input", function () {
    setModelsDirtyState(true);
    renderModelsPreview();
  });
  $("#modelsTokenList").addEventListener("click", function (event) {
    const button = event.target.closest("[data-model-token]");
    if (button) insertModelToken(button.dataset.modelToken);
  });
  $("#modelsSave").addEventListener("click", saveModel);
  $("#modelsDiscard").addEventListener("click", discardModel);
  $("#modelsRestore").addEventListener("click", restoreModel);
  $("#modelsPreviewLead").addEventListener("change", renderModelsPreview);
  $("#modelsCopyPreview").addEventListener("click", function () {
    const text = $("#modelsPreviewText").value;
    if (!text.trim()) { showToast("Nada para copiar."); return; }
    copyText(text, "Prévia copiada.");
  });
  $$(".site-prompt-tab").forEach(function (button) {
    button.addEventListener("click", function () {
      if (button.dataset.siteTab === sitePromptTab) return;
      sitePromptTab = button.dataset.siteTab;
      renderSitePromptTabs();
      renderSitePrompt();
    });
  });
  ["siteLinkGoogle", "siteLinkReview", "siteLinkPhone", "siteLinkInstagram", "siteLinkWebsite", "siteLinkProjectFolder", "siteLinkImagesFolder"].forEach(function (id) {
    const input = $("#" + id);
    if (input) input.addEventListener("input", markSitePromptDirty);
  });
  $("#siteExtraLinks").addEventListener("input", markSitePromptDirty);
  $("#siteExtraLinks").addEventListener("click", function (event) {
    const remove = event.target.closest("[data-extra-remove]");
    if (!remove) return;
    const row = remove.closest(".site-extra-row");
    if (row) row.remove();
    sitePromptDirty = true;
    renderSitePrompt();
  });
  $("#siteAddExtraLink").addEventListener("click", function () {
    const container = $("#siteExtraLinks");
    if (!container) return;
    const empty = container.querySelector(".site-extra-empty");
    if (empty) empty.remove();
    container.insertAdjacentHTML("beforeend", siteExtraLinkRowMarkup("", ""));
    const rows = $$("#siteExtraLinks .site-extra-row");
    const last = rows[rows.length - 1];
    const label = last ? last.querySelector(".site-extra-label") : null;
    if (label) label.focus();
    sitePromptDirty = true;
    renderSitePrompt();
  });
  $("#sitePromptCopy").addEventListener("click", function () {
    const text = $("#sitePromptText").value;
    if (!text.trim()) { showToast("Nada para copiar."); return; }
    saveSitePromptLinks();
    copyText(text, "Prompt copiado.");
  });
  $("#sitePromptEditModel").addEventListener("click", function () {
    const tab = sitePromptTab;
    if (sitePromptDirty) saveSitePromptLinks();
    sitePromptDialog.close();
    if (leadDialog.open) leadDialog.close();
    setModelTab(tab);
    setView("models");
  });
  $("#sitePromptForm").addEventListener("submit", function (event) { event.preventDefault(); });
  $("#themeToggle").addEventListener("click", function () {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
  });
  $("#authModeToggle").addEventListener("click", function () { setAuthMode(authMode === "login" ? "signup" : "login"); });
  $("#localMode").addEventListener("click", startLocalOnly);
  authForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!supabase) await initializeAuth();
    if (!supabase) {
      const message = supabaseConfig.url && supabaseConfig.publishableKey
        ? "Não foi possível conectar ao serviço. Confira a internet ou use somente este navegador."
        : "A conexão com o Supabase não está configurada. Use somente este navegador.";
      showAuthMessage(message, true);
      return;
    }
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    const button = $("#authSubmit");
    button.disabled = true;
    showAuthMessage(authMode === "signup" ? "Criando sua conta…" : "Entrando…");
    try {
      if (authMode === "signup") {
        const redirectTo = window.location.origin + window.location.pathname;
        const result = await supabase.auth.signUp({ email: email, password: password, options: { emailRedirectTo: redirectTo } });
        if (result.error) throw result.error;
        if (result.data.session) showAuthMessage("Conta criada. Abrindo seu CRM…");
        else showAuthMessage("Conta criada. Confirme o e-mail enviado para entrar e sincronizar seus dados.");
      } else {
        const result = await supabase.auth.signInWithPassword({ email: email, password: password });
        if (result.error) throw result.error;
        showAuthMessage("Acesso confirmado. Carregando seus dados…");
      }
    } catch (error) {
      showAuthMessage(error.message || "Não foi possível autenticar. Confira e tente novamente.", true);
    } finally {
      button.disabled = false;
    }
  });
  $("#signOut").addEventListener("click", async function () {
    if (localOnly || !supabase) { lockApp(); return; }
    if (syncDirty) await flushCloudSync();
    const result = await supabase.auth.signOut();
    if (result.error) showToast("Não foi possível sair: " + result.error.message);
  });
  window.addEventListener("online", function () { if (syncDirty) flushCloudSync(); else refreshCloudState(); });
  window.addEventListener("focus", refreshCloudState);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") refreshCloudState(); });
  let savedTheme = "dark";
  try { savedTheme = localStorage.getItem(THEME_KEY) || "dark"; } catch (_) {}
  setTheme(savedTheme, false);
  initializeAuth();
  renderAll();
  try { setSidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === "true"); } catch (_) { setSidebarCollapsed(false); }
})();
