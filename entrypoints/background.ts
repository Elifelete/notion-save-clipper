export default defineBackground(() => {
  // Desativa o popup nativo do navegador para permitir o modal fixo injetado na página (estilo Save.to)
  const disableNativePopup = () => {
    try {
      chrome.action.setPopup({ popup: '' });
    } catch (e) {
      console.warn('Erro ao configurar popup da extensão:', e);
    }
  };

  chrome.runtime.onInstalled.addListener(disableNativePopup);
  chrome.runtime.onStartup.addListener(disableNativePopup);
  disableNativePopup();

  // Ao clicar no ícone da extensão na barra do Chrome:
  chrome.action.onClicked.addListener(async (tab) => {
    const tabId = tab.id;
    if (!tabId || !tab.url) return;

    // Páginas restritas pelo Chrome (ex: chrome://extensions)
    if (
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('about:')
    ) {
      alert('O Notion Save precisa ser aberto em uma página web (não em páginas internas do Chrome).');
      return;
    }

    try {
      // Tenta enviar mensagem para o content script existente
      await chrome.tabs.sendMessage(tabId, { action: 'TOGGLE_OVERLAY' });
    } catch {
      // Se o content script ainda não foi injetado (ex: aba aberta antes de carregar a extensão)
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-scripts/content.js'],
        });
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tabId, { action: 'TOGGLE_OVERLAY' });
          } catch (e) {
            console.error('Falha ao acionar modal do Notion Save:', e);
          }
        }, 100);
      } catch (err) {
        console.error('Erro ao injetar script do Notion Save:', err);
      }
    }
  });
});
