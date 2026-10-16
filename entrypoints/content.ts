import { extractPageMetadataScript } from '@/src/services/extractor';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // Escuta mensagens do popup ou background
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
        if (request?.action === 'GET_PAGE_METADATA') {
          try {
            const metadata = extractPageMetadataScript();
            sendResponse({ success: true, data: metadata });
          } catch (e: any) {
            sendResponse({ success: false, error: e.message });
          }
          return true;
        }
      });
    }
  },
});
