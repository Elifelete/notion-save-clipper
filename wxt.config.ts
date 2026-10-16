import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Notion Save - Web Clipper',
    description: 'Salve páginas, artigos e metadados diretamente no Notion no estilo Save.to',
    version: '1.0.0',
    permissions: ['storage', 'activeTab', 'tabs', 'scripting'],
    host_permissions: ['https://api.notion.com/*', '<all_urls>'],
    action: {
      default_title: 'Notion Save',
    },
    web_accessible_resources: [
      {
        resources: ['popup.html', '*.js', '*.css', '*.svg', '*.png', 'assets/*', 'chunks/*'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
