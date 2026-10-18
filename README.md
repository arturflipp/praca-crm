# Praça CRM

CRM de prospecção para preparar prompts, importar leads, acompanhar contatos e registrar lembretes. A conta Supabase sincroniza os dados entre dispositivos; o modo local continua disponível neste navegador.

## Abrir

Na pasta do projeto, inicie um servidor local simples:

    python3 -m http.server 4173

Depois abra no navegador:

    http://localhost:4173

Para encerrar, volte ao terminal e pressione Ctrl+C.

## O que já está incluído

- Prompt de pesquisa editável, com campos de categoria e região e cópia do texto pronto.
- Importação de tabelas Markdown com link direto da ficha no Google Maps, além de telefone, avaliações, nota, concorrente e mensagem.
- CRM com cadastro manual, edição, status, pesquisa, origem da prospecção, observações e diferença calculada de avaliações.
- Atalho para abrir o WhatsApp com a mensagem sugerida preenchida. O envio continua sendo feito manualmente no WhatsApp.
- Link para abrir a ficha pública do comércio no Google Maps, importado pela tabela ou inserido manualmente.
- Agenda simples para registrar visitas, retornos e outros lembretes relacionados a um lead, concluir ou reabrir.
- Login por e-mail e senha e sincronização dos prompts, leads e lembretes pelo Supabase.
- Cache local por conta e reenvio das alterações depois de uma interrupção de conexão.
- Modo opcional somente neste navegador.

Os lembretes aparecem na agenda do aplicativo; esta versão ainda não envia notificações do sistema.

Os leads permanecem na ordem em que foram adicionados. O gap é exibido, sem ordenar a lista automaticamente.

## Configuração do Supabase

O esquema está em `supabase/schema.sql`. Ele cria uma linha JSON por usuário e habilita RLS com políticas que limitam leitura e gravação ao `auth.uid()` autenticado. A chave em `supabase-config.js` é uma chave **publishable**, feita para ser usada no navegador; nunca coloque uma chave `service_role` neste app.

No Supabase, configure em **Authentication → URL Configuration** o endereço local `http://localhost:4173/` e permita `http://localhost:4173/**` nos redirecionamentos. Ao publicar, adicione também o endereço do GitHub Pages do repositório. A confirmação de e-mail pode estar ativada: nesse caso, confirme o cadastro pelo e-mail antes de entrar.

O app mantém um cache local por conta e sincroniza uma cópia dos prompts, leads e lembretes. O primeiro acesso importa os dados locais antigos para a primeira conta. Em caso de uso offline, as alterações ficam no navegador e são reenviadas quando a conexão retorna. Use **Somente neste navegador** para manter o funcionamento local sem login.

O prompt é copiado para uso numa IA externa; o CRM não chama ChatGPT ou Claude por conta própria. O modo de sincronização evita sobrescrever alterações remotas quando a aba volta a ficar ativa e mescla leads e lembretes por ID durante conflitos; exclusões feitas simultaneamente em dispositivos diferentes podem reaparecer.

## Publicar no GitHub Pages

O workflow em `.github/workflows/pages.yml` publica `index.html`, `app.js`, `styles.css` e `supabase-config.js` quando há um push para `main`. No repositório, configure **Settings → Pages → Build and deployment → Source: GitHub Actions**. Também é possível iniciar a publicação manualmente pela aba **Actions**.

A página publicada e o código são públicos. Os dados do CRM não são enviados ao GitHub; ficam na tabela Supabase protegida pelas políticas RLS. A chave publishable do projeto aparece no código público por definição e não permite ler dados sem autenticação e políticas corretas.

Caixa, vendas, estoque e despesas não fazem parte desta primeira versão.

