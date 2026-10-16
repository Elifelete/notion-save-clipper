# Notion Save — Web Clipper (Estilo Save.to)

Extensão de navegador moderna, rápida e local-first para salvar páginas, artigos e metadados diretamente no Notion, inspirada na experiência do [Save to Notion (Save.to)](https://www.save.to).

---

## 🚀 Funcionalidades da Fase 1 (MVP)

- **Conexão Direta com a API do Notion**: Utiliza seu próprio *Internal Integration Token* com segurança e sem custos de intermediários.
- **Detecção e Busca Automática de Databases**: Lista automaticamente todas as databases autorizadas no seu workspace.
- **Sistema de Formulários (Workflows)**: Crie formulários para diferentes finalidades (ex: *Artigos a Ler*, *Receitas*, *Ideias*).
- **Extração Automática de Metadados**:
  - Título da página
  - URL canônica
  - Descrição / Resumo OpenGraph
  - Imagem de capa (com suporte a adicionar/remover/substituir)
  - Favicon
- **Mapeamento de Propriedades do Notion**: Suporte a preenchimento de campos nativos no popup antes de salvar.
- **Feedback Instantâneo**: Confirmação visual e botão direto para abrir a página criada no Notion.

---

## 🛠️ Como Instalar e Testar no Navegador (Chrome / Edge / Brave)

1. **Compilar a extensão**:
   ```bash
   pnpm build
   ```
2. **Abrir a página de extensões**:
   - No Chrome: acesse `chrome://extensions`
   - No Edge: acesse `edge://extensions`
   - No Brave: acesse `brave://extensions`
3. **Ativar o "Modo do desenvolvedor"** (canto superior direito).
4. Clicar no botão **"Carregar sem compactação"** (Load unpacked).
5. Selecionar a pasta gerada:
   ```
   notion-save/.output/chrome-mv3
   ```
6. Fixe o ícone do **Notion Save** na barra de ferramentas do seu navegador!

---

## 🔑 Como Conectar ao seu Notion (100% Gratuito)

1. Acesse **[notion.so/my-integrations](https://www.notion.so/my-integrations)**.
2. Clique em **"Nova Integração"** (New Integration), dê o nome de `Save to Notion` e confirme.
3. Copie o **"Internal Integration Secret"** (`secret_...`).
4. Abra a extensão no navegador, cole o token nas configurações e clique em **Salvar & Validar**.
5. **No Notion:** Abra a Database onde deseja salvar itens, clique nos três pontinhos `(...)` no canto superior direito > **Conexões** > Adicione a sua integração.
6. Volte à extensão e crie o seu primeiro formulário!

---

## 💻 Comandos de Desenvolvimento

- `pnpm dev`: Inicia o servidor de desenvolvimento com Hot Module Reloading (HMR).
- `pnpm build`: Gera a build de produção em `.output/chrome-mv3`.
- `pnpm zip`: Gera o arquivo `.zip` pronto para distribuição em `.output/`.
