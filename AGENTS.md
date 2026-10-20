# Notion Save — Guia para Agentes de IA (AGENTS.md)

Este documento fornece orientações essenciais, convenções de código e contexto operacional para qualquer agente autônomo ou assistente de IA trabalhando no repositório **Notion Save**.

---

## 🎯 Visão Geral do Projeto

**Notion Save** é uma extensão de navegador (Chrome MV3) moderna, local-first e sem intermediários (servidores proxy), inspirada na interface e na experiência do *Save to Notion (Save.to)*.

- **Stack Tecnológica**:
  - Framework: [WXT (Next-gen Web Extension Framework)](https://wxt.dev/) com Vite
  - UI: React 19 + TypeScript + Tailwind CSS v4 + Lucide React
  - Parsing de Artigos: `@mozilla/readability`
  - Armazenamento: `chrome.storage.local` (tokens, configurações e formulários) e `localStorage` (rascunhos efêmeros)
  - Backend/API: Conexão direta com a [Notion REST API v1](https://developers.notion.com/) usando *Internal Integration Secret*

---

## 📁 Estrutura de Diretórios Chave

- [`entrypoints/`](file:///C:/Users/Eli/Documents/projects/notion-save/entrypoints/):
  - [`background.ts`](file:///C:/Users/Eli/Documents/projects/notion-save/entrypoints/background.ts): Service worker MV3 (captura de screenshots de abas ativas e rotas de background).
  - [`content.ts`](file:///C:/Users/Eli/Documents/projects/notion-save/entrypoints/content.ts): Injetado nas páginas para gerenciar o overlay modal (iframe), captura visual de elementos da página e injeção de badges de redes sociais.
  - [`popup/`](file:///C:/Users/Eli/Documents/projects/notion-save/entrypoints/popup/): Interface de usuário do popup/modal da extensão.
- [`src/services/`](file:///C:/Users/Eli/Documents/projects/notion-save/src/services/):
  - [`notion.ts`](file:///C:/Users/Eli/Documents/projects/notion-save/src/services/notion.ts): Cliente direto para a Notion API (busca paginada de databases, criação de páginas com propriedades dinâmicas e blocos no canvas, anti-duplicação).
  - [`storage.ts`](file:///C:/Users/Eli/Documents/projects/notion-save/src/services/storage.ts): CRUD de formulários/workflows e credenciais em `chrome.storage.local`.
  - [`extractor.ts`](file:///C:/Users/Eli/Documents/projects/notion-save/src/services/extractor.ts): Scripts de extração de metadados da aba ativa (OpenGraph, Twitter Cards, favicons, imagens).
  - [`reader.ts`](file:///C:/Users/Eli/Documents/projects/notion-save/src/services/reader.ts): Conversão de artigos limpos para blocos nativos do Notion via Readability.
  - [`socialMedia.ts`](file:///C:/Users/Eli/Documents/projects/notion-save/src/services/socialMedia.ts): Observadores e extratores de posts para redes sociais (Twitter/X e Instagram).
- [`src/components/`](file:///C:/Users/Eli/Documents/projects/notion-save/src/components/): Componentes React modulares (views, fields, modais de capa).
- [`docs/`](file:///C:/Users/Eli/Documents/projects/notion-save/docs/): Documentação arquitetural aprofundada ([`docs/architecture.md`](file:///C:/Users/Eli/Documents/projects/notion-save/docs/architecture.md)).

---

## ⚙️ Comandos de Desenvolvimento e Validação

Sempre valide suas alterações executando os scripts oficiais via `pnpm`:

```bash
# Verificação estrita de tipagem TypeScript (sem emitir arquivos)
pnpm compile

# Build de produção do WXT para Chrome MV3
pnpm build

# Empacotamento completo em arquivo .zip para distribuição (.output/*.zip)
pnpm zip
```

> [!IMPORTANT]
> Nunca considere uma tarefa concluída sem antes executar `pnpm compile` com sucesso (código de saída 0).

---

## 🔒 Regras e Cuidados Críticos

### 1. Limites Estritos da Notion API
- **Limite de 2.000 caracteres por `rich_text`**: O Notion rejeita com erro `400 Bad Request` qualquer objeto de texto cujo conteúdo ultrapasse 2.000 caracteres. Sempre fatie textos longos (ex: chunks de 1.800 a 1.900 caracteres) ao criar blocos `quote`, `paragraph` ou propriedades de texto.
- **Imagens temporárias de CDN**: Imagens de CDN do Instagram, Threads ou Twitter expiram em poucas horas ou bloqueiam hotlinking. Sempre prefira blocos `embed` com a URL canônica do post no canvas do Notion, permitindo visualização rica e interativa sem dependência de URLs temporárias.
- **Propriedades da Database vs. Canvas**:
  - Propriedades de tabela são ideais para filtros e organização (Title, URL, Data, Tags).
  - Conteúdo extenso, legendas de posts e transcrições devem sempre ir para o **Canvas** (`contentBlocks`) como blocos nativos.

### 2. Comunicação entre Content Script e Popup (Iframe / Overlay)
- O popup pode ser aberto tanto como janela pop-up tradicional do navegador quanto como um iframe overlay injetado na página pelo `content.ts`.
- Toda comunicação bidirecional ocorre por meio de `window.postMessage`:
  - `NOTION_SAVE_START_ELEMENT_PICKER`: Solicita ao content script ativar o apontador visual de áreas da página.
  - `NOTION_SAVE_STOP_ELEMENT_PICKER`: Cancela a seleção visual (ex: ao pressionar `ESC`).
  - `NOTION_SAVE_SET_CUSTOM_AREA` / `NOTION_SAVE_SET_SELECTION`: Envia o texto capturado para preenchimento no formulário.
  - `NOTION_SAVE_SET_SOCIAL_POST`: Transmite dados do post social clicado no feed/modal para o popup.
  - `NOTION_SAVE_CLOSE`: Fecha o overlay na página hospedeira.

### 3. Preservação de Rascunhos (Auto-save)
- Para evitar que o usuário perca o que digitou ao clicar fora do popup ou ao navegar, o componente [`SavePageView`](file:///C:/Users/Eli/Documents/projects/notion-save/src/components/SavePageView.tsx) sincroniza o estado corrente com `localStorage` sob uma chave indexada por formulário e URL (`notion_save_draft_${formId}_${url}`). O rascunho é limpo automaticamente após um salvamento bem-sucedido.

---

## 📝 Convenções de Código

1. **Tipagem Forte**: Sempre defina e exporte interfaces no [`src/types/index.ts`](file:///C:/Users/Eli/Documents/projects/notion-save/src/types/index.ts). Evite `any` arbitrário a menos que esteja lidando com payloads polimórficos da Notion API.
2. **Estilização**: Use classes utilitárias do Tailwind CSS. Mantenha os seletores de UI compactos e alinhados com a identidade visual sóbria estilo *Save.to*.
3. **Links em Markdown**: Sempre forneça links absolutos com protocolo `file:///` para facilitar a navegação nos arquivos do projeto.
4. **Isolamento de Erros**: Chamadas de rede da Notion API devem fornecer mensagens de erro legíveis e orientadas à ação para o usuário (ex: token inválido, permissão ausente na database).
