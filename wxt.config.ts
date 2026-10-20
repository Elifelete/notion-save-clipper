import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()]
  }),
  manifest: {
    name: 'Notion Save - Web Clipper',
    description:
      'Web clipper extension for saving pages, articles, and metadata to Notion. (Save.to style)',
    version: '1.0.0',
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '96': 'icon/96.png',
      '128': 'icon/128.png',
      '512': 'icon/512.png'
    },
    permissions: ['storage', 'activeTab', 'tabs', 'scripting'],
    host_permissions: ['https://api.notion.com/*', '<all_urls>'],
    action: {
      default_title: 'Notion Save',
      default_icon: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
        '128': 'icon/128.png'
      }
    },
    web_accessible_resources: [
      {
        resources: [
          'popup.html',
          '*.js',
          '*.css',
          '*.svg',
          '*.png',
          'assets/*',
          'chunks/*'
        ],
        matches: ['<all_urls>']
      }
    ]
  }
})
