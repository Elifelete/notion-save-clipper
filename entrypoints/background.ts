export default defineBackground(() => {
  // Listen for messages to capture visible screen (screenshot)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.action === 'CAPTURE_VISIBLE_TAB') {
      chrome.tabs.captureVisibleTab(
        sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT,
        { format: 'png' },
        (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) {
            sendResponse({ success: false, error: chrome.runtime.lastError?.message || 'Failed to capture screen' });
          } else {
            sendResponse({ success: true, dataUrl });
          }
        }
      );
      return true;
    }
  });

  // Disables native popup to enable page-injected overlay (Save.to style)
  const disableNativePopup = () => {
    try {
      chrome.action.setPopup({ popup: '' });
    } catch (e) {
      console.warn('Error configuring extension popup:', e);
    }
  };

  chrome.runtime.onInstalled.addListener(disableNativePopup);
  chrome.runtime.onStartup.addListener(disableNativePopup);
  disableNativePopup();

  // On clicking extension icon in toolbar:
  chrome.action.onClicked.addListener(async (tab) => {
    const tabId = tab.id;
    if (!tabId || !tab.url) return;

    // Restricted browser internal pages (e.g. chrome://extensions)
    if (
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('about:')
    ) {
      alert('Notion Save must be opened on a standard web page (not browser internal pages).');
      return;
    }

    try {
      // Send toggle message to existing content script
      await chrome.tabs.sendMessage(tabId, { action: 'TOGGLE_OVERLAY' });
    } catch {
      // Inject content script if not already present
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-scripts/content.js'],
        });
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tabId, { action: 'TOGGLE_OVERLAY' });
          } catch (e) {
            console.error('Failed to trigger Notion Save overlay:', e);
          }
        }, 100);
      } catch (err) {
        console.error('Error injecting Notion Save script:', err);
      }
    }
  });
});
