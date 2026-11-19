# art.crm — direção de design

## 1. Decisão

Marca: somente o wordmark textual **art.crm**, sempre em minúsculas. Sem logo, símbolo, monograma, flor ou mascote.

Direção escolhida: **verde profundo refinado**, pensada primeiro para tema escuro. O padrão é o preset **Floresta**. O app terá um painel de aparência com 7 presets, 4 destaques por preset, ajuste de raio (0 a 20) e 3 densidades.

O nome interno do repositório é "praça CRM". A marca visível é art.crm. Não usar "Praça" na interface.

## 2. Princípios

1. **Dados primeiro.** A tela existe para ler nome, status, telefone, valor e próximo passo. Contraste, alinhamento e densidade vêm antes de qualquer efeito.
2. **Um acento por tela.** O verde é ação, seleção e sucesso. Laranja é atenção. Vermelho é recusa, erro e perigo. Nunca os três com o mesmo peso.
3. **Escuro por padrão, claro por escolha.** O uso na rua e à noite pede superfícies profundas. O preset Papel existe para luz do dia, não para "modo claro" genérico.
4. **A palavra é a marca.** O wordmark é texto puro. Nada de ícone ao lado, caixa alta ou símbolo.
5. **Densidade ajustável, não apertada.** O app é denso, mas cada linha respira. O usuário escolhe compacta, confortável ou espaçada.
6. **Nada de enfeite.** Sem gradiente, glow, vidro, 3D, sombra colorida ou animação decorativa.

## 3. Wordmark

- Texto: `art.crm`
- Fonte: Georgia, serif
- Tamanho: 22px na sidebar, 24px na tela de entrada
- Peso: 400 (nunca bold)
- Espaçamento: `letter-spacing: -0.04em`
- Cor: `--ink`
- Linha de apoio: `CRM LOCAL` ou `CRM DE PROSPECÇÃO`, 10px, peso 750, `letter-spacing: .08em`, `--muted`
- Não usar ponto final, não abreviar, não separar em duas linhas, não colocar dentro de caixa ou badge.

## 4. Tipografia

Fontes já usadas no projeto. Não adicionar webfont.

- Títulos: `Georgia, "Times New Roman", serif`
- Texto e interface: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
- Editor, prévia e códigos: `"SFMono-Regular", Consolas, "Liberation Mono", monospace`

| Token | Fonte | Tamanho / linha | Peso | Uso |
|---|---|---|---|---|
| `--type-display` | Georgia | 32px / 1.1 | 500 | Título da tela de entrada |
| `--type-h1` | Georgia | 28px / 1.15 | 500 | Título de página (26px no celular) |
| `--type-h2` | Georgia | 19px / 1.25 | 500 | Título de painel |
| `--type-h3` | system-ui | 15px / 1.35 | 650 | Título de card |
| `--type-body` | system-ui | 14px / 1.5 | 400 | Texto corrido |
| `--type-ui` | system-ui | 13px / 1.4 | 600 | Botões, navegação, nomes de lead |
| `--type-small` | system-ui | 12px / 1.45 | 400 | Apoio, ajuda, metadados |
| `--type-label` | system-ui | 11px / 1.3 | 650 | Rótulos de campo, `letter-spacing: .02em` |
| `--type-caps` | system-ui | 11px / 1.3 | 750 | Micro rótulos em caixa alta, `letter-spacing: .08em` |
| `--type-mono` | mono | 12px / 1.6 | 400 | Editor de prompt, prévia, Place ID |
| `--type-stat` | Georgia | 30px / 1.1 | 500 | Números dos cards de estatística |

Regras:
- Caixa alta só em micro rótulos de 11px. Nunca em títulos, botões ou frases.
- Números de tabela e relatório: system-ui 12px, peso 600, `font-variant-numeric: tabular-nums`.
- Nada abaixo de 11px. Placeholder não substitui rótulo.
- Títulos em Georgia peso 500, não 700. O contraste de peso fica para a interface.

## 5. Cor

### 5.1 Presets

| Preset | `data-scheme` | Uso | Racional curto |
|---|---|---|---|
| **Floresta** (padrão) | `floresta` | Escuro | Verde profundo refinado. Canvas quase preto esverdeado, acento sálvia. Parece caderno de campo, não painel de vendas. |
| **Grafite** | `grafite` | Escuro | Neutro quente, sem cor dominante. Acento pedra/areia. O CRM some e os dados aparecem. |
| **Petróleo** | `petroleo` | Escuro | Azul-petróleo frio, acento cerúleo. Mais técnico, bom para relatórios e uso noturno. |
| **Vinho** | `vinho` | Escuro | Vinho contido, acento rosé seco. Mantém a memória do vermelho atual sem gritar. |
| **Bronze** | `bronze` | Escuro | Âmbar/bronze fosco, calor de balcão. Sem brilho e sem dourado de luxo. |
| **Oliva** | `oliva` | Escuro | Verde-oliva terroso, acento palha. Alternativa mais quente ao Floresta. |
| **Papel** | `papel` | Claro | Off-white, tinta verde-carvão, acento verde profundo. Luz do dia e sensação de planilha boa. |

### 5.2 Destaques prontos

Cada preset tem 4 destaques. No escuro, todos são claros o bastante para funcionar como texto sobre `--canvas` e `--paper`; o texto sobre eles é `--accent-text` (quase preto). No claro, os destaques são profundos e o texto sobre eles é branco.

| Preset | Destaque 1 (padrão) | Destaque 2 | Destaque 3 | Destaque 4 | `--accent-text` | Menor contraste texto/destaque | Menor contraste texto/hover |
|---|---|---|---|---|---|---|---|
| Floresta | `#7fbf97` | `#8fc7a5` | `#6fb48c` | `#5fa57d` | `#0b1710` | 6.26:1 | 5.37:1 |
| Grafite | `#c9bfaf` | `#d6ccbc` | `#b9ad9b` | `#a99c88` | `#17130e` | 6.86:1 | 5.88:1 |
| Petróleo | `#7fb6c2` | `#8fc4ce` | `#6fa9b7` | `#5e99a8` | `#081416` | 5.88:1 | 5.06:1 |
| Vinho | `#ce8b8b` | `#dc9c9a` | `#be7c7c` | `#b87878` | `#1c0e10` | 5.36:1 | 4.59:1 |
| Bronze | `#d0a566` | `#ddb472` | `#c09554` | `#ae8647` | `#1a1206` | 5.56:1 | 4.77:1 |
| Oliva | `#b3c17c` | `#c2cf8c` | `#a3b16c` | `#94a25e` | `#121408` | 6.72:1 | 5.74:1 |
| Papel | `#356b4d` | `#2c5c42` | `#4a7d5c` | `#26503a` | `#ffffff` | 4.80:1 | 6.21:1 |

"Menor contraste texto/hover" considera o destaque mais escuro de cada preset depois da regra de `--green-dark`.

### 5.3 Tokens por preset

**Superfícies e texto**

| Preset | `--canvas` | `--paper` | `--line` | `--ink` | `--muted` | `--sidebar-bg` | `--surface-2` | `--surface-3` |
|---|---|---|---|---|---|---|---|---|
| Floresta | `#0c1210` | `#151c18` | `#2a342d` | `#edf3ee` | `#a1aea4` | `#0f1612` | `#1a231d` | `#202b24` |
| Grafite | `#121110` | `#1a1917` | `#302e2b` | `#f1eee9` | `#aca69e` | `#151412` | `#22201d` | `#282521` |
| Petróleo | `#0c1214` | `#131b1e` | `#27343a` | `#e9f1f2` | `#9fadb1` | `#0e1618` | `#182226` | `#1e2a2f` |
| Vinho | `#130f11` | `#1b1619` | `#33292d` | `#f2ecee` | `#b0a3a7` | `#171114` | `#241d20` | `#2b2327` |
| Bronze | `#12100c` | `#1a1712` | `#332d24` | `#f3eee4` | `#b1a794` | `#16130e` | `#231f18` | `#2a251c` |
| Oliva | `#10110d` | `#181a14` | `#2f3328` | `#eff2e7` | `#a8ae99` | `#141610` | `#21241a` | `#282c1f` |
| Papel | `#f4f2ec` | `#ffffff` | `#e5e2d9` | `#1e241e` | `#676d63` | `#fbfaf6` | `#f5f4ef` | `#eeede6` |

**Acento e semântica**

| Preset | `--green` | `--green-dark` | `--green-soft` | `--orange` | `--orange-soft` | `--red` | `--accent-text` | `--focus` |
|---|---|---|---|---|---|---|---|---|
| Floresta | `#7fbf97` | `#75b08b` | `#1a2720` | `#d8a273` | `#2b2318` | `#e2928a` | `#0b1710` | `rgba(127,191,151,.62)` |
| Grafite | `#c9bfaf` | `#b9b0a1` | `#282623` | `#d9a273` | `#2b241a` | `#e09a90` | `#17130e` | `rgba(201,191,175,.62)` |
| Petróleo | `#7fb6c2` | `#75a7b2` | `#1a2629` | `#d9a56f` | `#2a2319` | `#e2928b` | `#081416` | `rgba(127,182,194,.62)` |
| Vinho | `#ce8b8b` | `#be8080` | `#291e20` | `#d8a273` | `#2b2218` | `#e59a93` | `#1c0e10` | `rgba(206,139,139,.62)` |
| Bronze | `#d0a566` | `#bf985e` | `#292217` | `#e0a36b` | `#2e2417` | `#e39a8c` | `#1a1206` | `rgba(208,165,102,.62)` |
| Oliva | `#b3c17c` | `#a5b272` | `#24261a` | `#d6a16c` | `#2b2418` | `#df9588` | `#121408` | `rgba(179,193,124,.62)` |
| Papel | `#356b4d` | `#2d5b41` | `#eff3f1` | `#8f4f28` | `#f8eee4` | `#a04434` | `#ffffff` | `rgba(40,86,61,.72)` |

**Controles e chrome**

| Preset | `--topbar-bg` | `--control-bg` | `--control-border` | `--control-ink` | `--hover-bg` | `--row-line` | `--nav-ink` | `--shadow` |
|---|---|---|---|---|---|---|---|---|
| Floresta | `rgba(12,18,16,.86)` | `#121a15` | `#3e4c42` | `#edf3ee` | `#1f2a23` | `#253029` | `#b6c3b8` | `0 12px 32px rgba(0,0,0,.38)` |
| Grafite | `rgba(18,17,16,.87)` | `#161411` | `#46423b` | `#f1eee9` | `#262320` | `#2b2825` | `#c0b9b0` | `0 12px 32px rgba(0,0,0,.36)` |
| Petróleo | `rgba(12,18,20,.87)` | `#10181b` | `#394a51` | `#e9f1f2` | `#1c282d` | `#223036` | `#b2c1c5` | `0 12px 32px rgba(0,0,0,.38)` |
| Vinho | `rgba(19,15,17,.87)` | `#161113` | `#483c40` | `#f2ecee` | `#281f23` | `#2f2529` | `#c3b5b9` | `0 12px 32px rgba(0,0,0,.38)` |
| Bronze | `rgba(18,16,12,.87)` | `#15120d` | `#473e30` | `#f3eee4` | `#27221a` | `#2d271e` | `#c5baa6` | `0 12px 32px rgba(0,0,0,.38)` |
| Oliva | `rgba(16,17,13,.87)` | `#131510` | `#414736` | `#eff2e7` | `#252a1c` | `#2b3021` | `#bcc3a8` | `0 12px 32px rgba(0,0,0,.38)` |
| Papel | `rgba(247,246,242,.88)` | `#ffffff` | `#d6d3c9` | `#1e241e` | `#f1f0ea` | `#ece9e1` | `#4f574e` | `0 8px 26px rgba(30,38,30,.06)` |

### 5.4 Contraste calculado

Razão de contraste WCAG 2.1 sobre sRGB. Meta: `--ink` ≥ 7:1, `--muted` ≥ 4.5:1, texto sobre `--green` ≥ 4.5:1.

| Preset | ink / paper | ink / canvas | muted / paper | muted / canvas | accent-text / green | green / paper | nav-ink / sidebar | control-ink / control-bg |
|---|---|---|---|---|---|---|---|---|
| Floresta | 15.40:1 | 16.81:1 | 7.52:1 | 8.21:1 | 8.57:1 | 8.09:1 | 10.04:1 | 15.75:1 |
| Grafite | 15.18:1 | 16.30:1 | 7.28:1 | 7.82:1 | 10.17:1 | 9.67:1 | 9.47:1 | 15.89:1 |
| Petróleo | 15.23:1 | 16.48:1 | 7.55:1 | 8.17:1 | 8.35:1 | 7.79:1 | 9.88:1 | 15.69:1 |
| Vinho | 15.32:1 | 16.31:1 | 7.35:1 | 7.83:1 | 6.87:1 | 6.54:1 | 9.43:1 | 16.03:1 |
| Bronze | 15.45:1 | 16.43:1 | 7.51:1 | 7.98:1 | 8.17:1 | 7.88:1 | 9.66:1 | 16.15:1 |
| Oliva | 15.48:1 | 16.72:1 | 7.67:1 | 8.28:1 | 9.60:1 | 9.05:1 | 9.99:1 | 16.22:1 |
| Papel | 15.83:1 | 14.14:1 | 5.32:1 | 4.76:1 | 6.25:1 | 6.25:1 | 7.17:1 | 15.83:1 |

Todos os pares principais passam AA para texto normal. `--muted` sobre `--surface-3` fica em 4.54:1 no Papel e acima de 6.2:1 nos escuros. Texto desabilitado é exceção prevista pela WCAG; ainda assim, não usar opacidade abaixo de .45.

O anel de foco composto (`--focus` sobre `--paper` ou `--canvas`) fica entre 3.31:1 e 4.62:1 nos presets escuros e em 3.64:1 no Papel, acima do mínimo de 3:1 para componentes de interface.

### 5.5 Regra para gerar variantes

A partir do destaque escolhido pelo usuário (`--green`):

**Tema escuro**
```css
--green-dark: color-mix(in srgb, var(--green) 92%, #000);
--green-soft: color-mix(in srgb, var(--green) 12%, var(--canvas));
--focus: color-mix(in srgb, var(--green) 62%, transparent);
```

**Tema claro**
```css
--green-dark: color-mix(in srgb, var(--green) 85%, #000);
--green-soft: color-mix(in srgb, var(--green) 8%, #fff);
--focus: color-mix(in srgb, var(--green-dark) 72%, transparent);
```

Regras de segurança:
- `--accent-text` não muda ao trocar o destaque. As 4 opções de cada preset foram escolhidas para manter o mesmo par. Se o usuário escolher um destaque fora da lista, o app deve calcular o contraste com `--accent-text` e recusar (ou avisar) abaixo de 4.5:1.
- `--green-dark` é a variante de hover de botão preenchido. No escuro ela é 8% mais escura; no claro, 15% mais escura.
- `--green-soft` é fundo de seleção, nunca cor de texto.
- `--focus` é rgba para halo. O anel visível é `outline: 2px solid var(--green)`; o rgba complementa.
- `color-mix()` funciona nos navegadores atuais. Se precisar de fallback, o app pode calcular os hex em JS e gravar o valor final; os blocos CSS abaixo já trazem os valores prontos para o destaque padrão.

### 5.6 Semântica fixa

- `--green`: ação principal, seleção, sucesso, links de ação.
- `--orange`: atenção, proposta, aviso, badge de duplicado.
- `--red`: recusa, erro, exclusão, atraso.
- `--muted`: metadado, apoio, placeholder.
- `--line`: divisor decorativo. `--control-border`: contorno de campo. `--row-line`: divisor de linha de lead.
- Nunca usar laranja ou vermelho como cor de marca. Eles são estados.

## 6. Espaçamento

Base 4px. Usar somente a escala.

| Token | Valor |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-7` | 32px |
| `--space-8` | 40px |
| `--space-9` | 56px |

Exceções permitidas: 1px de borda, 2px de foco, 36px de botão de ícone, 44px de alvo de toque.

Layout atual que deve ser mantido: sidebar 244px (recolhida 76px), topbar 56px, barra inferior 64px no celular, página com padding lateral de 40px no desktop e 16px no celular.

## 7. Raios

Escala de 0 a 20. Padrão do usuário: 12. O painel grava `--radius-user` entre 0 e 20.

| Token | Fórmula | Em 0 | Em 12 | Em 20 |
|---|---|---|---|---|
| `--radius-control` | `max(0px, calc(var(--radius-user) - 4px))` | 0 | 8px | 16px |
| `--radius-card` | `var(--radius-user)` | 0 | 12px | 20px |
| `--radius-panel` | `min(20px, calc(var(--radius-user) * 1.15))` | 0 | 13.8px | 20px |
| `--radius-auth` | `min(20px, calc(var(--radius-user) * 1.5))` | 0 | 18px | 20px |
| `--radius-pill` | `999px` | 999px | 999px | 999px |

Regras:
- Campos, botões e chips pequenos usam `--radius-control`.
- Cards, linhas e painéis usam `--radius-card`.
- Modais e gavetas usam `--radius-panel`.
- Status, badges e contadores usam `--radius-pill`, mesmo com raio 0. É forma, não raio.
- Não misturar 10px, 11px, 13px soltos. Usar os tokens.

## 8. Densidades

Três opções: **compacta**, **confortável** (padrão) e **espaçada**. O painel grava `data-density`.

| Token | Compacta | Confortável | Espaçada |
|---|---|---|---|
| `--pad-card-y` / `--pad-card-x` | 12px / 14px | 16px / 18px | 20px / 22px |
| `--pad-row-y` / `--pad-row-x` | 8px / 12px | 12px / 14px | 16px / 16px |
| `--row-min` | 48px | 58px | 68px |
| `--pad-field-y` / `--pad-field-x` | 6px / 9px | 9px / 11px | 11px / 13px |
| `--field-min` | 36px | 40px | 46px |
| `--label-gap` | 4px | 6px | 8px |
| `--pad-nav-y` / `--pad-nav-x` | 8px / 10px | 10px / 11px | 13px / 12px |
| `--nav-min` | 40px | 44px | 50px |
| `--gap-stack` | 8px | 12px | 16px |
| `--gap-page` | 16px | 22px | 30px |
| `--pad-page-y` / `--pad-page-x` | 24px / 28px | 32px / 40px | 40px / 48px |

No celular (`max-width: 820px`):
- Navegação e campos nunca abaixo de 44px de altura.
- Linhas de lead nunca abaixo de 48px.
- Padding lateral da página: 16px.
- A densidade compacta só reduz padding horizontal e gaps; não reduz alvo de toque.

## 9. Sombras

Sombra é para camada, não para card.

| Uso | Escuro | Claro |
|---|---|---|
| Card / linha | nenhuma; usar `--line` ou `--row-line` | nenhuma |
| Popover / menu | `0 12px 32px rgba(0,0,0,.38)` | `0 8px 26px rgba(30,38,30,.08)` |
| Modal / gaveta | `0 24px 64px rgba(0,0,0,.50)` | `0 18px 60px rgba(30,38,30,.12)` |
| Foco | `0 0 0 4px var(--focus)` | `0 0 0 4px var(--focus)` |

Nunca usar sombra colorida, sombra interna, relevo ou borda dupla. O token `--shadow` é a sombra padrão de popover/card elevado.

## 10. Movimento

- Hover e foco: 120ms.
- Modal, gaveta e troca de aba: 180ms.
- Máximo: 240ms.
- Curva: `cubic-bezier(.2,.7,.2,1)`.
- Sem bounce, spring, parallax, gradiente animado ou contador animado.
- Modal entra com opacidade + `translateY(6px)`. Nada além disso.
- Linhas de tabela e números não animam.
- Respeitar `prefers-reduced-motion: reduce`: duração 0ms e sem deslocamento.

## 11. Estados

| Estado | Aparência |
|---|---|
| Padrão | Superfície `--paper` ou `--control-bg`, borda `--line` ou `--control-border`, texto `--ink`. |
| Hover | Fundo `--hover-bg`; borda `--control-border`; texto `--ink`; 120ms. Em botão preenchido: fundo `--green-dark`, texto `--accent-text`. |
| Ativo / pressionado | Fundo `--surface-3`; sem `transform`, sem scale. |
| Selecionado | Fundo `--green-soft`; texto `--green` no escuro e `--green-dark` no claro; barra esquerda de 2px em `--green`. Não mudar o peso da fonte. |
| Foco visível | `outline: 2px solid var(--green); outline-offset: 2px; box-shadow: 0 0 0 4px var(--focus)`. Nunca remover o outline. |
| Desabilitado | `opacity: .45; cursor: not-allowed`; sem hover; texto ainda legível. |
| Perigo | Texto `--red`; fundo `color-mix(in srgb, var(--red) 12%, var(--canvas))`; borda `color-mix(in srgb, var(--red) 28%, var(--line))`. |
| Campo inválido | Borda `--red`; mensagem em `--red`; foco com halo `color-mix(in srgb, var(--red) 35%, transparent)`. |
| Carregando | Texto `--muted`; sem spinner colorido; usar reticências ou barra fina em `--line` com preenchimento `--green`. |

Regras:
- Cor nunca é o único sinal. Status tem texto; perigo tem texto e ícone de interface.
- Hover não pode ser o único jeito de descobrir uma ação.
- Foco sempre visível, inclusive em links, summaries e chips.
- Desabilitado não pode parecer clicável.

## 12. Tela de Leads no preset Floresta

- Fundo `--canvas` `#0c1210`; sidebar `--sidebar-bg` `#0f1612`; topbar `rgba(12,18,16,.86)` com blur de 10px.
- Título "Seus leads" em Georgia 28px, peso 500, `--ink`. Subtítulo 13px `--muted`.
- Quatro cards de estatística em `--paper` `#151c18`, borda 1px `--line`, raio 12px, sem sombra. Número em Georgia 30px; rótulo em 11px caixa alta `--muted`.
- Toolbar: abas de filtro em 11px; ativa com fundo `--green-soft` `#1a2720` e texto `--green` `#7fbf97`. Busca em `--control-bg` `#121a15`, borda 1px `--control-border`, raio 8px, altura 36px.
- Linhas de lead: mínimo 58px, divisória `--row-line` `#253029`, nome 13px peso 600 `--ink`, apoio 12px `--muted`, status em chip 11px, hover `--surface-2` `#1a231d`, sem zebra e sem sombra.
- Botão principal: fundo `--green` `#7fbf97`, texto `--accent-text` `#0b1710`, raio 8px, altura 42px; hover `--green-dark` `#75b08b`.
- Perigo e recusa: somente `--red` `#e2928a` em texto, borda ou chip. Nunca um bloco vermelho grande.
- No celular: linhas em duas colunas, status à direita, alvo mínimo de 44px, barra inferior de 64px. O preset Papel troca as superfícies, mas mantém a mesma hierarquia.

## 13. Tom de voz

Direto, curto, em português do Brasil. Verbo no começo. Nome do objeto específico. Sem jargão e sem entusiasmo artificial.

| Em vez de | Use |
|---|---|
| "Importação concluída com sucesso!" | "12 leads adicionados. 3 ficaram para revisão." |
| "Nenhum registro encontrado." | "Nenhum lead corresponde a esse filtro." |
| "Salvar alterações" | "Salvar lead" |
| "Excluir permanentemente?" | "Excluir este lead? As vendas ligadas a ele também saem dos relatórios." |
| "Potencialize sua prospecção" | "Organize seus leads." |
| "Ocorreu um erro inesperado." | "Não foi possível salvar. Verifique a conexão e tente de novo." |
| "Solução 360º para seu funil" | "Do primeiro contato à venda." |

Regras:
- Título em caixa de frase. Caixa alta só em micro rótulo.
- Botão com verbo e objeto: "Adicionar lead", "Copiar prompt", "Salvar venda".
- Número e data no formato brasileiro: `1.500,00`, `16/11/2026`.
- Sem exclamação, sem emoji, sem "por favor" em excesso.
- Mensagem de erro diz o que aconteceu e o próximo passo.
- Vazio não é fracasso: "Sua lista começa aqui" é melhor que "Nenhum dado".

## 14. Evite

- Roxo, neon, verde-limão, ciano elétrico, magenta.
- Gradiente em botão, fundo, texto ou borda.
- Glow, blur exagerado, vidro, 3D, relevo, sombra colorida.
- Logo, ícone de marca, monograma, flor, mascote, símbolo ao lado do wordmark.
- "art.crm" em caixa alta, com ponto final, bold ou separado.
- Emoji em interface, documentação ou mensagem.
- Frases inteiras em caixa alta.
- Fonte decorativa, script, display ou webfont externa.
- Texto abaixo de 11px; placeholder como único rótulo.
- Contraste abaixo de 4.5:1 em texto normal.
- Mais de um acento competindo na mesma tela.
- Tabela zebrada com cores fortes; usar `--surface-2` ou `--row-line`.
- Animação longa, bounce, parallax, contador animado.
- Ícone decorativo em cada linha de lead.
- Estética "gamer": escuro roxo, brilho, borda neon, tudo em caixa alta.
- Arredondamento aleatório fora da escala.
- Densidade compacta que quebra alvo de toque no celular.

## 15. Compatibilidade com o CSS atual

O CSS existente já usa alguns nomes que mudam de significado neste sistema. A implementação deve tratar estes pontos:

- `--accent-text` hoje colore texto de acento (`.text-button`, `.history-restore`, `.google-quick-link`). No novo sistema, `--accent-text` é **texto sobre o acento**. Esses usos devem passar a `var(--green)`.
- `--accent-text-strong` pode ser aposentado: no claro, usar `var(--green-dark)`; no escuro, `var(--green)`.
- `--focus` deixa de ser cor sólida e passa a ser rgba de halo. O anel visível deve ser `outline: 2px solid var(--green)` mais `box-shadow: 0 0 0 4px var(--focus)`.
- `--green-dark` no escuro é a variante de hover do botão preenchido, não a cor de texto ativo. Texto ativo no escuro usa `--green`; no claro, `--green-dark`.
- `--muted` no Papel é `#676d63`, mais escuro que o `#73776f` atual, para passar AA sobre `--surface-3`.
- `--placeholder` e `--label` podem ser aliases de `--muted`; não criar novos tons sem medir contraste.
- O tema escuro atual usa vermelho `#d84250` como acento. Ele vira o preset Vinho, com acento `#ce8b8b`. O claro atual `#356b4d` vira o preset Papel.

## 16. CSS pronto

Bloco base com tokens estruturais, densidade confortável e o preset padrão. Os blocos de preset cobrem todas as cores, então não há vazamento entre temas.

```css
:root{
  color-scheme: dark;

  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-serif: Georgia, "Times New Roman", serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-9: 56px;

  --radius-user: 12px;
  --radius-control: max(0px, calc(var(--radius-user) - 4px));
  --radius-card: var(--radius-user);
  --radius-panel: min(20px, calc(var(--radius-user) * 1.15));
  --radius-auth: min(20px, calc(var(--radius-user) * 1.5));
  --radius-pill: 999px;

  --duration-fast: 120ms;
  --duration-base: 180ms;
  --ease: cubic-bezier(.2,.7,.2,1);

  --pad-card-y: 16px;
  --pad-card-x: 18px;
  --pad-row-y: 12px;
  --pad-row-x: 14px;
  --row-min: 58px;
  --pad-field-y: 9px;
  --pad-field-x: 11px;
  --field-min: 40px;
  --label-gap: 6px;
  --pad-nav-y: 10px;
  --pad-nav-x: 11px;
  --nav-min: 44px;
  --gap-stack: 12px;
  --gap-page: 22px;
  --pad-page-y: 32px;
  --pad-page-x: 40px;

  --canvas: #0c1210;
  --paper: #151c18;
  --line: #2a342d;
  --ink: #edf3ee;
  --muted: #a1aea4;
  --green: #7fbf97;
  --green-dark: #75b08b;
  --green-soft: #1a2720;
  --orange: #d8a273;
  --orange-soft: #2b2318;
  --red: #e2928a;
  --shadow: 0 12px 32px rgba(0,0,0,.38);
  --sidebar-bg: #0f1612;
  --topbar-bg: rgba(12,18,16,.86);
  --surface-2: #1a231d;
  --surface-3: #202b24;
  --control-bg: #121a15;
  --control-border: #3e4c42;
  --control-ink: #edf3ee;
  --hover-bg: #1f2a23;
  --row-line: #253029;
  --nav-ink: #b6c3b8;
  --focus: rgba(127,191,151,.62);
  --accent-text: #0b1710;
}
```

```css
:root[data-scheme="floresta"]{
  color-scheme: dark;
  --canvas: #0c1210;
  --paper: #151c18;
  --line: #2a342d;
  --ink: #edf3ee;
  --muted: #a1aea4;
  --green: #7fbf97;
  --green-dark: #75b08b;
  --green-soft: #1a2720;
  --orange: #d8a273;
  --orange-soft: #2b2318;
  --red: #e2928a;
  --shadow: 0 12px 32px rgba(0,0,0,.38);
  --sidebar-bg: #0f1612;
  --topbar-bg: rgba(12,18,16,.86);
  --surface-2: #1a231d;
  --surface-3: #202b24;
  --control-bg: #121a15;
  --control-border: #3e4c42;
  --control-ink: #edf3ee;
  --hover-bg: #1f2a23;
  --row-line: #253029;
  --nav-ink: #b6c3b8;
  --focus: rgba(127,191,151,.62);
  --accent-text: #0b1710;
}
```

```css
:root[data-scheme="grafite"]{
  color-scheme: dark;
  --canvas: #121110;
  --paper: #1a1917;
  --line: #302e2b;
  --ink: #f1eee9;
  --muted: #aca69e;
  --green: #c9bfaf;
  --green-dark: #b9b0a1;
  --green-soft: #282623;
  --orange: #d9a273;
  --orange-soft: #2b241a;
  --red: #e09a90;
  --shadow: 0 12px 32px rgba(0,0,0,.36);
  --sidebar-bg: #151412;
  --topbar-bg: rgba(18,17,16,.87);
  --surface-2: #22201d;
  --surface-3: #282521;
  --control-bg: #161411;
  --control-border: #46423b;
  --control-ink: #f1eee9;
  --hover-bg: #262320;
  --row-line: #2b2825;
  --nav-ink: #c0b9b0;
  --focus: rgba(201,191,175,.62);
  --accent-text: #17130e;
}
```

```css
:root[data-scheme="petroleo"]{
  color-scheme: dark;
  --canvas: #0c1214;
  --paper: #131b1e;
  --line: #27343a;
  --ink: #e9f1f2;
  --muted: #9fadb1;
  --green: #7fb6c2;
  --green-dark: #75a7b2;
  --green-soft: #1a2629;
  --orange: #d9a56f;
  --orange-soft: #2a2319;
  --red: #e2928b;
  --shadow: 0 12px 32px rgba(0,0,0,.38);
  --sidebar-bg: #0e1618;
  --topbar-bg: rgba(12,18,20,.87);
  --surface-2: #182226;
  --surface-3: #1e2a2f;
  --control-bg: #10181b;
  --control-border: #394a51;
  --control-ink: #e9f1f2;
  --hover-bg: #1c282d;
  --row-line: #223036;
  --nav-ink: #b2c1c5;
  --focus: rgba(127,182,194,.62);
  --accent-text: #081416;
}
```

```css
:root[data-scheme="vinho"]{
  color-scheme: dark;
  --canvas: #130f11;
  --paper: #1b1619;
  --line: #33292d;
  --ink: #f2ecee;
  --muted: #b0a3a7;
  --green: #ce8b8b;
  --green-dark: #be8080;
  --green-soft: #291e20;
  --orange: #d8a273;
  --orange-soft: #2b2218;
  --red: #e59a93;
  --shadow: 0 12px 32px rgba(0,0,0,.38);
  --sidebar-bg: #171114;
  --topbar-bg: rgba(19,15,17,.87);
  --surface-2: #241d20;
  --surface-3: #2b2327;
  --control-bg: #161113;
  --control-border: #483c40;
  --control-ink: #f2ecee;
  --hover-bg: #281f23;
  --row-line: #2f2529;
  --nav-ink: #c3b5b9;
  --focus: rgba(206,139,139,.62);
  --accent-text: #1c0e10;
}
```

```css
:root[data-scheme="bronze"]{
  color-scheme: dark;
  --canvas: #12100c;
  --paper: #1a1712;
  --line: #332d24;
  --ink: #f3eee4;
  --muted: #b1a794;
  --green: #d0a566;
  --green-dark: #bf985e;
  --green-soft: #292217;
  --orange: #e0a36b;
  --orange-soft: #2e2417;
  --red: #e39a8c;
  --shadow: 0 12px 32px rgba(0,0,0,.38);
  --sidebar-bg: #16130e;
  --topbar-bg: rgba(18,16,12,.87);
  --surface-2: #231f18;
  --surface-3: #2a251c;
  --control-bg: #15120d;
  --control-border: #473e30;
  --control-ink: #f3eee4;
  --hover-bg: #27221a;
  --row-line: #2d271e;
  --nav-ink: #c5baa6;
  --focus: rgba(208,165,102,.62);
  --accent-text: #1a1206;
}
```

```css
:root[data-scheme="oliva"]{
  color-scheme: dark;
  --canvas: #10110d;
  --paper: #181a14;
  --line: #2f3328;
  --ink: #eff2e7;
  --muted: #a8ae99;
  --green: #b3c17c;
  --green-dark: #a5b272;
  --green-soft: #24261a;
  --orange: #d6a16c;
  --orange-soft: #2b2418;
  --red: #df9588;
  --shadow: 0 12px 32px rgba(0,0,0,.38);
  --sidebar-bg: #141610;
  --topbar-bg: rgba(16,17,13,.87);
  --surface-2: #21241a;
  --surface-3: #282c1f;
  --control-bg: #131510;
  --control-border: #414736;
  --control-ink: #eff2e7;
  --hover-bg: #252a1c;
  --row-line: #2b3021;
  --nav-ink: #bcc3a8;
  --focus: rgba(179,193,124,.62);
  --accent-text: #121408;
}
```

```css
:root[data-scheme="papel"]{
  color-scheme: light;
  --canvas: #f4f2ec;
  --paper: #ffffff;
  --line: #e5e2d9;
  --ink: #1e241e;
  --muted: #676d63;
  --green: #356b4d;
  --green-dark: #2d5b41;
  --green-soft: #eff3f1;
  --orange: #8f4f28;
  --orange-soft: #f8eee4;
  --red: #a04434;
  --shadow: 0 8px 26px rgba(30,38,30,.06);
  --sidebar-bg: #fbfaf6;
  --topbar-bg: rgba(247,246,242,.88);
  --surface-2: #f5f4ef;
  --surface-3: #eeede6;
  --control-bg: #ffffff;
  --control-border: #d6d3c9;
  --control-ink: #1e241e;
  --hover-bg: #f1f0ea;
  --row-line: #ece9e1;
  --nav-ink: #4f574e;
  --focus: rgba(40,86,61,.72);
  --accent-text: #ffffff;
}
```

```css
:root[data-density="compacta"]{
  --pad-card-y: 12px;
  --pad-card-x: 14px;
  --pad-row-y: 8px;
  --pad-row-x: 12px;
  --row-min: 48px;
  --pad-field-y: 6px;
  --pad-field-x: 9px;
  --field-min: 36px;
  --label-gap: 4px;
  --pad-nav-y: 8px;
  --pad-nav-x: 10px;
  --nav-min: 40px;
  --gap-stack: 8px;
  --gap-page: 16px;
  --pad-page-y: 24px;
  --pad-page-x: 28px;
}
```

```css
:root[data-density="espacada"]{
  --pad-card-y: 20px;
  --pad-card-x: 22px;
  --pad-row-y: 16px;
  --pad-row-x: 16px;
  --row-min: 68px;
  --pad-field-y: 11px;
  --pad-field-x: 13px;
  --field-min: 46px;
  --label-gap: 8px;
  --pad-nav-y: 13px;
  --pad-nav-x: 12px;
  --nav-min: 50px;
  --gap-stack: 16px;
  --gap-page: 30px;
  --pad-page-y: 40px;
  --pad-page-x: 48px;
}
```
