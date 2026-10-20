# Notion Save — Web Clipper (Save.to Style)

A modern, fast, and local-first browser extension for saving web pages, articles, and structured metadata directly into Notion, inspired by the experience of [Save to Notion (Save.to)](https://www.save.to).

---

## 🚀 Key Features

- **Direct Notion API Connection**: Connects using your own *Internal Integration Secret* directly from the browser — zero third-party proxy servers, 100% free and private.
- **Save to Databases or Pages**: Save records as structured entries in databases or as subpages/appended blocks in standard pages.
- **Workflow & Form System**: Create unlimited forms for different clipping workflows (e.g., *Articles to Read*, *Recipes*, *Design Resources*, *Quick Notes*).
- **Automatic Metadata Extraction**:
  - Page title and canonical URL
  - Description and OpenGraph excerpts
  - Favicon and smart cover image selection
  - Estimated reading time and word count
- **Full Article Extraction (Reader Mode)**: Powered by `@mozilla/readability` to clean out ads, sidebars, and popups, converting web articles into native Notion blocks (`headings`, `paragraphs`, `quotes`, `lists`, `code blocks`, `images`).
- **Social Media Clipper (Twitter/X & Instagram)**:
  - In-feed and dialog "Save to Notion" action badges.
  - Interactive embeds on the Notion canvas that never expire due to temporary CDN URLs.
  - Automatic post caption extraction and metadata callouts.
- **Interactive Element & Area Picker**: Visually inspect and click on any section of a web page to extract custom content.
- **Anti-Duplicate Detection**: Real-time notification if the active URL was already clipped to the selected database, with a direct link to the existing page.
- **Screenshot Tool**: 1-click visible viewport capture (`chrome.tabs.captureVisibleTab`) to use as page cover.
- **Dynamic Property Mapping**: Native field inputs with official Notion badge colors, datepicker, interactive checkboxes, numeric fields, and inline tag creation.

---

## 🛠️ Installation & Testing (Chrome / Edge / Brave)

1. **Build the extension**:
   ```bash
   pnpm build
   ```
2. **Open browser extension manager**:
   - In Chrome: navigate to `chrome://extensions`
   - In Edge: navigate to `edge://extensions`
   - In Brave: navigate to `brave://extensions`
3. **Enable "Developer mode"** (toggle in the top-right corner).
4. Click **"Load unpacked"**.
5. Select the build output directory:
   ```
   .output/chrome-mv3
   ```
6. Pin the **Notion Save** icon to your browser toolbar!

---

## 🔑 Connecting to Your Notion Workspace (100% Free)

1. Go to **[notion.so/my-integrations](https://www.notion.so/my-integrations)**.
2. Click **"New connection"**.
3. Enter a **Connection name** (e.g., `Save to Notion`).
4. Under **Authentication method**, choose **"API token"** and click **"Create connection"**.
5. Copy the generated **"Internal Integration Secret"** (starts with `secret_...`).
6. Open the extension popup, paste the token in Settings, and click **"Save & Validate Connection"**.
7. **In Notion**: Open any Database or Page where you want to save items > click the three dots `(...)` in the top-right corner > **Connections** > add your newly created connection (`Save to Notion`).
8. Return to the extension and select or create your desired form!

---

## 💻 Development Commands

- `pnpm dev`: Start the development server with Hot Module Reloading (HMR).
- `pnpm compile`: Run strict TypeScript validation without emitting files.
- `pnpm build`: Generate production build in `.output/chrome-mv3`.
- `pnpm zip`: Package the extension into a distribution `.zip` file under `.output/`.

---

## 📚 Documentation

- [`AGENTS.md`](AGENTS.md): Developer and AI agent guidelines, constraints, and Notion API rules.
- [`PRD.md`](PRD.md): Complete Product Requirements Document, persona use cases, and feature roadmap.
- [`docs/architecture.md`](docs/architecture.md): Technical architecture, data flow, component lifecycles, and messaging diagrams.
