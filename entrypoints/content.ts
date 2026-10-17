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

    // --- ELEMENT SELECTOR (SAVE CUSTOM AREA) ---
    let isElementSelectorActive = false;
    let hoveredElement: HTMLElement | null = null;
    let selectorOverlay: HTMLDivElement | null = null;
    let selectorBadge: HTMLDivElement | null = null;

    function startElementSelector() {
      if (isElementSelectorActive) return;
      isElementSelectorActive = true;

      // Minimiza temporariamente o modal da extensão para dar foco na seleção
      const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
      if (iframe) {
        iframe.style.opacity = '0.25';
        iframe.style.pointerEvents = 'none';
      }

      // Cria a caixa de destaque (highlight box)
      selectorOverlay = document.createElement('div');
      selectorOverlay.id = 'notion-save-selector-box';
      selectorOverlay.style.cssText = `
        position: absolute !important;
        z-index: 2147483640 !important;
        pointer-events: none !important;
        border: 2px solid #2563eb !important;
        background: rgba(37, 99, 235, 0.12) !important;
        border-radius: 6px !important;
        transition: all 0.08s ease !important;
        display: none !important;
      `;

      // Badge superior com instrução e BOTÃO DE CANCELAR CLICÁVEL
      selectorBadge = document.createElement('div');
      selectorBadge.id = 'notion-save-selector-badge';
      selectorBadge.style.cssText = `
        position: fixed !important;
        top: 18px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 2147483646 !important;
        user-select: none !important;
        pointer-events: auto !important;
      `;
      selectorBadge.innerHTML = `
        <div style="
          background: #111827;
          color: white;
          padding: 8px 14px 8px 16px;
          border-radius: 9999px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          font-weight: 500;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          gap: 12px;
        ">
          <span style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 14px;">🎯</span>
            <span>Clique no elemento que deseja salvar</span>
          </span>
          <button id="notion-save-cancel-picker-btn" type="button" style="
            background: #374151;
            color: #f3f4f6;
            border: 1px solid rgba(255, 255, 255, 0.15);
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            transition: all 0.12s ease;
          ">
            <span>Cancelar</span>
            <span style="opacity: 0.6; font-size: 10px;">(ESC)</span>
          </button>
        </div>
      `;

      document.body.appendChild(selectorOverlay);
      document.body.appendChild(selectorBadge);

      // Botão Cancelar direto no Badge
      const cancelBtn = selectorBadge.querySelector('#notion-save-cancel-picker-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          stopElementSelector();
        });
      }

      window.addEventListener('mousemove', handleSelectorMouseMove, true);
      window.addEventListener('click', handleSelectorClick, true);
      window.addEventListener('keydown', handleSelectorKeyDown, true);
      document.addEventListener('keydown', handleSelectorKeyDown, true);
    }

    function stopElementSelector() {
      isElementSelectorActive = false;
      const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
      if (iframe) {
        iframe.style.opacity = '1';
        iframe.style.pointerEvents = 'auto';
      }

      if (selectorOverlay && selectorOverlay.parentNode) {
        selectorOverlay.parentNode.removeChild(selectorOverlay);
      }
      if (selectorBadge && selectorBadge.parentNode) {
        selectorBadge.parentNode.removeChild(selectorBadge);
      }
      selectorOverlay = null;
      selectorBadge = null;
      hoveredElement = null;

      window.removeEventListener('mousemove', handleSelectorMouseMove, true);
      window.removeEventListener('click', handleSelectorClick, true);
      window.removeEventListener('keydown', handleSelectorKeyDown, true);
      document.removeEventListener('keydown', handleSelectorKeyDown, true);
    }

    function handleSelectorMouseMove(e: MouseEvent) {
      if (!isElementSelectorActive) return;
      const target = e.target as HTMLElement | null;
      if (
        !target ||
        target === selectorOverlay ||
        target === selectorBadge ||
        target.closest('#notion-save-selector-badge') ||
        target.closest(`#${IFRAME_ID}`)
      ) {
        return;
      }

      hoveredElement = target;
      const rect = target.getBoundingClientRect();
      if (selectorOverlay) {
        selectorOverlay.style.top = `${window.scrollY + rect.top}px`;
        selectorOverlay.style.left = `${window.scrollX + rect.left}px`;
        selectorOverlay.style.width = `${rect.width}px`;
        selectorOverlay.style.height = `${rect.height}px`;
        selectorOverlay.style.display = 'block';
      }
    }

    function handleSelectorClick(e: MouseEvent) {
      if (!isElementSelectorActive) return;
      const target = e.target as HTMLElement | null;

      // Se clicou no badge de cancelar ou dentro do modal, não intercepta como elemento da página
      if (target?.closest('#notion-save-selector-badge') || target?.closest(`#${IFRAME_ID}`)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const el = hoveredElement || target;
      if (el) {
        const text = (el.innerText || el.textContent || '').trim();
        const html = el.innerHTML;

        const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            {
              action: 'NOTION_SAVE_SET_CUSTOM_AREA',
              text: text.slice(0, 3000),
              html: html.slice(0, 8000),
            },
            '*'
          );
        }
      }

      stopElementSelector();
    }

    function handleSelectorKeyDown(e: KeyboardEvent) {
      if (!isElementSelectorActive) return;
      if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        stopElementSelector();
      }
    }

    // Escuta comandos disparados de dentro do iframe
    window.addEventListener('message', (event) => {
      const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
      if (!iframe) return;

      if (event.data?.action === 'NOTION_SAVE_CLOSE') {
        iframe.style.display = 'none';
        stopElementSelector();
      }

      if (event.data?.action === 'NOTION_SAVE_RESIZE' && typeof event.data.height === 'number') {
        const targetHeight = Math.min(Math.max(event.data.height, 220), window.innerHeight - 32);
        iframe.style.height = `${targetHeight}px`;
      }

      if (event.data?.action === 'NOTION_SAVE_START_ELEMENT_PICKER') {
        startElementSelector();
      }

      if (event.data?.action === 'NOTION_SAVE_STOP_ELEMENT_PICKER') {
        stopElementSelector();
      }
    });

    // --- HIGHLIGHTER & FLOATING TOOLBAR ---
    const HIGHLIGHT_BUTTON_ID = 'notion-save-highlight-btn';
    let activeHighlightBtn: HTMLDivElement | null = null;

    function removeHighlightButton() {
      if (activeHighlightBtn && activeHighlightBtn.parentNode) {
        activeHighlightBtn.parentNode.removeChild(activeHighlightBtn);
      }
      activeHighlightBtn = null;
    }

    document.addEventListener('mouseup', (e) => {
      if (isElementSelectorActive) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest && (target.closest(`#${IFRAME_ID}`) || target.closest(`#${HIGHLIGHT_BUTTON_ID}`))) {
        return;
      }

      setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection ? selection.toString().trim() : '';

        if (!selectedText || selectedText.length < 2) {
          removeHighlightButton();
          return;
        }

        const range = selection!.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) {
          removeHighlightButton();
          return;
        }

        if (!activeHighlightBtn) {
          activeHighlightBtn = document.createElement('div');
          activeHighlightBtn.id = HIGHLIGHT_BUTTON_ID;
          activeHighlightBtn.innerHTML = `
            <button type="button" style="
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 6px 12px;
              background: #111827;
              color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 12px;
              font-weight: 600;
              border-radius: 9999px;
              border: 1px solid rgba(255, 255, 255, 0.15);
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
              cursor: pointer;
              transition: transform 0.12s ease, background 0.12s ease;
            ">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <span>Salvar no Notion</span>
            </button>
          `;

          activeHighlightBtn.style.cssText = `
            position: absolute !important;
            z-index: 2147483646 !important;
            user-select: none !important;
            pointer-events: auto !important;
          `;

          activeHighlightBtn.addEventListener('click', (evt) => {
            evt.stopPropagation();
            evt.preventDefault();

            // Abre ou exibe o modal da extensão
            toggleOverlay();

            // Envia o texto destacado para o iframe preencher
            const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage(
                {
                  action: 'NOTION_SAVE_SET_SELECTION',
                  selectedText,
                },
                '*'
              );
            }

            removeHighlightButton();
          });

          document.body.appendChild(activeHighlightBtn);
        }

        const top = window.scrollY + rect.top - 42;
        const left = Math.max(10, window.scrollX + rect.left + rect.width / 2 - 60);

        activeHighlightBtn.style.top = `${Math.max(10, top)}px`;
        activeHighlightBtn.style.left = `${left}px`;
        activeHighlightBtn.style.display = 'block';
      }, 20);
    });

    document.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest && (target.closest(`#${IFRAME_ID}`) || target.closest(`#${HIGHLIGHT_BUTTON_ID}`))) {
        return;
      }
      removeHighlightButton();
    });
  },
});
