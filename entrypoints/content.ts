import { extractPageMetadataScript, extractPageImagesScript } from '@/src/services/extractor';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const IFRAME_ID = 'notion-save-overlay-iframe';

    function toggleOverlay() {
      let iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;

      if (iframe) {
        if (iframe.style.display === 'none') {
          iframe.style.display = 'block';
        } else {
          iframe.style.display = 'none';
        }
        return;
      }

      // Cria o iframe flutuante que permanece fixo na página
      iframe = document.createElement('iframe');
      iframe.id = IFRAME_ID;
      iframe.src = chrome.runtime.getURL('popup.html');
      iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
      iframe.style.cssText = `
        position: fixed !important;
        top: 16px !important;
        right: 16px !important;
        width: 380px !important;
        height: 520px !important;
        max-height: calc(100vh - 32px) !important;
        z-index: 2147483647 !important;
        border: none !important;
        border-radius: 16px !important;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.08) !important;
        background: #ffffff !important;
        color-scheme: light !important;
        overflow: hidden !important;
        transition: height 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease !important;
      `;

      document.documentElement.appendChild(iframe);
    }

    // Ouve mensagens enviadas pelo background ou iframe
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(
        (request: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
          if (request?.action === 'TOGGLE_OVERLAY') {
            toggleOverlay();
            sendResponse({ success: true });
            return true;
          }

          if (request?.action === 'GET_PAGE_METADATA') {
            try {
              const metadata = extractPageMetadataScript();
              sendResponse({ success: true, data: metadata });
            } catch (e: any) {
              sendResponse({ success: false, error: e.message });
            }
            return true;
          }

          if (request?.action === 'GET_PAGE_IMAGES') {
            try {
              const images = extractPageImagesScript();
              sendResponse({ success: true, data: images });
            } catch (e: any) {
              sendResponse({ success: false, error: e.message });
            }
            return true;
          }
        }
      );
    }

    // Escuta comandos de fechar ou redimensionar disparados de dentro do iframe
    window.addEventListener('message', (event) => {
      const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
      if (!iframe) return;

      if (event.data?.action === 'NOTION_SAVE_CLOSE') {
        iframe.style.display = 'none';
      }

      if (event.data?.action === 'NOTION_SAVE_RESIZE' && typeof event.data.height === 'number') {
        const targetHeight = Math.min(Math.max(event.data.height, 220), window.innerHeight - 32);
        iframe.style.height = `${targetHeight}px`;
      }
    });
  },
});
