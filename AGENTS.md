# Notion Save — AI Agent & Developer Guidelines (AGENTS.md)

This document provides essential instructions, architecture conventions, and operational context for autonomous AI agents and developers working on the **Notion Save** repository.

---

## 🎯 Project Overview

**Notion Save** is a modern, local-first browser extension (Chrome Manifest V3) inspired by the workflow and UI of *Save to Notion (Save.to)*. It connects directly to the official Notion API without any third-party intermediary servers.

- **Technology Stack**:
  - **Framework**: [WXT (Next-gen Web Extension Framework)](https://wxt.dev/) with Vite
  - **UI**: React 19, TypeScript, Tailwind CSS v4, Lucide React
  - **Article Parsing**: `@mozilla/readability`
  - **Storage**: `chrome.storage.local` (persisted tokens, workflows, database caches) and `localStorage` (ephemeral draft recovery)
  - **API**: Direct REST calls to [Notion API v1](https://developers.notion.com/) using the user's *Internal Integration Secret*

---

## 📁 Key Directory Structure

All paths below are relative to the repository root:

- [`entrypoints/`](entrypoints/):
  - [`background.ts`](entrypoints/background.ts): MV3 Background service worker (privileged operations such as capturing tab screenshots).
  - [`content.ts`](entrypoints/content.ts): Injected into web pages to manage the popup overlay modal iframe, interactive element picker, and social media badge injection.
  - [`popup/`](entrypoints/popup/): Extension popup UI (React application rendered in browser toolbar or page overlay).
- [`src/services/`](src/services/):
  - [`notion.ts`](src/services/notion.ts): Direct Notion REST API client (paginated database search, page creation with blocks and properties, anti-duplication, tag creation).
  - [`storage.ts`](src/services/storage.ts): CRUD operations for workflows and credentials via `chrome.storage.local`.
  - [`extractor.ts`](src/services/extractor.ts): Webpage metadata extraction (OpenGraph, Twitter Cards, favicons, DOM images).
  - [`reader.ts`](src/services/reader.ts): Readability-based article cleaner and HTML-to-Notion block converter.
  - [`socialMedia.ts`](src/services/socialMedia.ts): Continuous badge injection and robust post data extraction for Twitter/X and Instagram (feeds and dialogs).
- [`src/components/`](src/components/): Modular UI views (`SavePageView`, `SelectFormView`, `CreateFormView`, `SettingsView`, `CoverImagePicker`, `PropertyField`).
- [`docs/`](docs/): Deep architectural documentation ([`docs/architecture.md`](docs/architecture.md)).

---

## ⚙️ Development, Validation, and Build Commands

Always validate modifications using the official repository scripts via `pnpm`:

```bash
# Strict TypeScript type check (no file emission)
pnpm compile

# Production build for Chrome MV3
pnpm build

# Full distribution packaging to .zip (.output/*.zip)
pnpm zip
```

> [!IMPORTANT]
> Never complete a task without ensuring `pnpm compile` exits with status code 0.

---

## 🔒 Critical Rules & Constraints

### 1. Strict Notion API Limits
- **2,000 character limit per `rich_text` object**: Notion returns `400 Bad Request` if a single text chunk exceeds 2,000 characters. Always split long strings into chunks of 1,800–1,900 characters when constructing `quote`, `paragraph`, or property blocks.
- **Expiring CDN URLs**: Direct media URLs from platforms like Instagram or Twitter expire within hours or block hotlinking. Use native Notion `embed` blocks with canonical post URLs on the page canvas instead of storing expiring CDN links.
- **Canvas vs. Database Properties**:
  - Database properties are best suited for structured metadata (Title, Canonical URL, Date, Select tags).
  - Unbounded text, post captions, and article content must always be placed on the **Canvas** (`contentBlocks`) as native blocks.

### 2. Communication Between Content Script and Popup Overlay
- The popup can open as a standard browser action popup or as an injected modal overlay iframe on the page.
- Bidirectional messaging between the content script and iframe uses `window.postMessage`:
  - `NOTION_SAVE_START_ELEMENT_PICKER`: Activates visual area picker on the target page.
  - `NOTION_SAVE_STOP_ELEMENT_PICKER`: Cancels selection (e.g., user presses `ESC`).
  - `NOTION_SAVE_SET_CUSTOM_AREA` / `NOTION_SAVE_SET_SELECTION`: Transmits highlighted or picked text back into the form.
  - `NOTION_SAVE_SET_SOCIAL_POST`: Sends scraped post data (author, ID, caption, URL) into the popup form.
  - `NOTION_SAVE_CLOSE`: Closes the overlay iframe on the host page.

### 3. Draft Auto-save Persistence
- To prevent data loss when clicking outside the popup, [`SavePageView`](src/components/SavePageView.tsx) syncs changes to `localStorage` under keys scoped by form ID and URL (`notion_save_draft_${formId}_${url}`). Rascunhos/drafts are automatically cleared upon a successful save.

---

## 📝 Code Conventions

1. **Strict Typing**: All data structures must be defined in [`src/types/index.ts`](src/types/index.ts). Avoid loose `any` typing outside Notion API polymorphic responses.
2. **Relative Paths**: Documentation, imports, and cross-references must always use relative repository paths, never local machine absolute paths.
3. **Clean Error Handling**: Present actionable, friendly error messages to the user for common issues (expired Notion tokens, unauthorized databases, rate limits).
