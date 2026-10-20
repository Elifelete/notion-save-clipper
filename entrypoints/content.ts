// Content Script for Notion Save
// Injects extension iframe overlay, element picker, and social media badges
import { initSocialMediaBadges, markBadgeSaved, type SocialPostData } from '../src/services/socialMedia';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // Prevent multiple injections
    if ((window as any).__notion_save_injected) return;
    (window as any).__notion_save_injected = true;

    let overlayContainer: HTMLDivElement | null = null;
    let iframeElement: HTMLIFrameElement | null = null;
    let cleanupBadges: (() => void) | null = null;

    // Interactive Element / Area Picker State
    let isElementPickerActive = false;
    let highlightedElement: HTMLElement | null = null;
    let pickerOverlay: HTMLDivElement | null = null;
    let pickerBadge: HTMLDivElement | null = null;

    // Creates or displays the visual element picker on the page
    function startElementPicker() {
      if (isElementPickerActive) return;
      isElementPickerActive = true;

      // Dim the Notion Save modal so it doesn't obstruct page selection
      if (overlayContainer) {
        overlayContainer.style.opacity = '0.15';
        overlayContainer.style.pointerEvents = 'none';
        overlayContainer.style.transition = 'opacity 0.2s ease';
      }

      // Create bounding box highlight
      if (!pickerOverlay) {
        pickerOverlay = document.createElement('div');
        pickerOverlay.id = 'notion-save-picker-highlight';
        pickerOverlay.style.cssText = `
          position: fixed !important;
          pointer-events: none !important;
          z-index: 2147483646 !important;
          border: 2px solid #2563eb !important;
          background: rgba(37, 99, 235, 0.12) !important;
          border-radius: 6px !important;
          transition: all 0.08s ease-out !important;
          display: none !important;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.15) !important;
        `;
        document.body.appendChild(pickerOverlay);
      }

      // Top instruction badge with clickable Cancel button
      if (!pickerBadge) {
        pickerBadge = document.createElement('div');
        pickerBadge.id = 'notion-save-picker-badge';
        pickerBadge.style.cssText = `
          position: fixed !important;
          top: 20px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          z-index: 2147483647 !important;
          background: #111827 !important;
          color: #ffffff !important;
          padding: 8px 16px !important;
          border-radius: 9999px !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3) !important;
          border: 1px solid rgba(255,255,255,0.15) !important;
          cursor: default !important;
          user-select: none !important;
        `;

        pickerBadge.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="6" cy="6" r="3"></circle>
              <circle cx="6" cy="18" r="3"></circle>
              <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
              <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
              <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
            </svg>
            <span>Click the element you want to clip</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; background: rgba(255,255,255,0.18); padding: 2px 7px; border-radius: 4px; font-family: monospace;">ESC</span>
            <button id="notion-save-picker-cancel-btn" type="button" style="
              background: rgba(239, 68, 68, 0.25);
              color: #fca5a5;
              border: 1px solid rgba(239, 68, 68, 0.4);
              border-radius: 9999px;
              padding: 3px 10px;
              font-size: 11px;
              font-weight: 600;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 4px;
              transition: all 0.15s ease;
            ">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <span>Cancel</span>
            </button>
          </div>
        `;

        document.body.appendChild(pickerBadge);

        // Cancel button inside badge
        const cancelBtn = pickerBadge.querySelector('#notion-save-picker-cancel-btn');
        if (cancelBtn) {
          cancelBtn.addEventListener('mouseenter', () => {
            (cancelBtn as HTMLElement).style.background = '#ef4444';
            (cancelBtn as HTMLElement).style.color = '#ffffff';
          });
          cancelBtn.addEventListener('mouseleave', () => {
            (cancelBtn as HTMLElement).style.background = 'rgba(239, 68, 68, 0.25)';
            (cancelBtn as HTMLElement).style.color = '#fca5a5';
          });
          cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            stopElementPicker();
          });
        }
      }

      pickerBadge.style.display = 'flex';
      document.addEventListener('mousemove', onPickerMouseMove, true);
      document.addEventListener('click', onPickerClick, true);
      window.addEventListener('keydown', onPickerKeyDown, true);
    }

    function stopElementPicker() {
      isElementPickerActive = false;
      highlightedElement = null;

      if (pickerOverlay) {
        pickerOverlay.style.display = 'none';
      }
      if (pickerBadge) {
        pickerBadge.style.display = 'none';
      }

      // Restore modal opacity
      if (overlayContainer) {
        overlayContainer.style.opacity = '1';
        overlayContainer.style.pointerEvents = 'auto';
      }

      document.removeEventListener('mousemove', onPickerMouseMove, true);
      document.removeEventListener('click', onPickerClick, true);
      window.removeEventListener('keydown', onPickerKeyDown, true);
    }

    function onPickerMouseMove(e: MouseEvent) {
      if (!isElementPickerActive) return;

      const target = e.target as HTMLElement;
      if (!target) return;

      // Ignore extension UI elements
      if (
        target.closest('#notion-save-picker-highlight') ||
        target.closest('#notion-save-picker-badge') ||
        target.closest('#notion-save-overlay-container')
      ) {
        return;
      }

      highlightedElement = target;
      const rect = target.getBoundingClientRect();

      if (pickerOverlay) {
        pickerOverlay.style.display = 'block';
        pickerOverlay.style.top = `${rect.top}px`;
        pickerOverlay.style.left = `${rect.left}px`;
        pickerOverlay.style.width = `${rect.width}px`;
        pickerOverlay.style.height = `${rect.height}px`;
      }
    }

    function onPickerClick(e: MouseEvent) {
      if (!isElementPickerActive) return;

      const target = e.target as HTMLElement;
      // Don't intercept clicks inside extension badge or overlay
      if (
        target.closest('#notion-save-picker-badge') ||
        target.closest('#notion-save-overlay-container')
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (highlightedElement) {
        const selectedText = (highlightedElement.innerText || highlightedElement.textContent || '').trim();

        // Send selected text to popup iframe
        if (iframeElement && iframeElement.contentWindow) {
          iframeElement.contentWindow.postMessage(
            {
              action: 'NOTION_SAVE_SET_CUSTOM_AREA',
              text: selectedText,
            },
            '*'
          );
        }
      }

      stopElementPicker();
    }

    function onPickerKeyDown(e: KeyboardEvent) {
      if (!isElementPickerActive) return;

      if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        stopElementPicker();
      }
    }

    // Creates and attaches iframe overlay
    function createOverlay(): { container: HTMLDivElement; iframe: HTMLIFrameElement } {
      if (overlayContainer && iframeElement) {
        return { container: overlayContainer, iframe: iframeElement };
      }

      const container = document.createElement('div');
      container.id = 'notion-save-overlay-container';
      container.style.cssText = `
        position: fixed !important;
        top: 16px !important;
        right: 16px !important;
        width: 410px !important;
        height: 610px !important;
        max-height: calc(100vh - 32px) !important;
        z-index: 2147483647 !important;
        box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.08) !important;
        border-radius: 16px !important;
        overflow: hidden !important;
        background: transparent !important;
        transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
        display: none !important;
      `;

      const iframe = document.createElement('iframe');
      iframe.id = 'notion-save-iframe';
      iframe.src = chrome.runtime.getURL('popup.html');
      iframe.style.cssText = `
        width: 100% !important;
        height: 100% !important;
        border: none !important;
        border-radius: 16px !important;
        background: #ffffff !important;
        color-scheme: light !important;
      `;

      container.appendChild(iframe);
      document.documentElement.appendChild(container);

      overlayContainer = container;
      iframeElement = iframe;

      // Listen to messages from popup iframe
      window.addEventListener('message', (event) => {
        if (event.data?.action === 'NOTION_SAVE_CLOSE') {
          hideOverlay();
        }
        if (event.data?.action === 'NOTION_SAVE_START_ELEMENT_PICKER') {
          startElementPicker();
        }
        if (event.data?.action === 'NOTION_SAVE_STOP_ELEMENT_PICKER') {
          stopElementPicker();
        }
      });

      return { container, iframe };
    }

    function showOverlay(initialSocialPost?: SocialPostData) {
      const { container, iframe } = createOverlay();
      container.style.display = 'block';

      const sendPostData = () => {
        if (initialSocialPost && iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            {
              action: 'NOTION_SAVE_SET_SOCIAL_POST',
              socialPost: initialSocialPost,
            },
            '*'
          );
        }
      };

      iframe.onload = () => {
        sendPostData();
      };

      sendPostData();
    }

    function hideOverlay() {
      if (overlayContainer) {
        overlayContainer.style.display = 'none';
      }
    }

    function toggleOverlay() {
      if (overlayContainer && overlayContainer.style.display === 'block') {
        hideOverlay();
      } else {
        showOverlay();
      }
    }

    // 1. Initialize Social Media Badges (Twitter/X & Instagram)
    cleanupBadges = initSocialMediaBadges((postData: SocialPostData, buttonEl: HTMLElement) => {
      // Open overlay prefilled with post data
      showOverlay(postData);

      // Listen to save confirmation to update badge with checkmark
      const onSaved = (event: MessageEvent) => {
        if (event.data?.action === 'NOTION_SAVE_POST_SAVED') {
          markBadgeSaved(buttonEl);
          window.removeEventListener('message', onSaved);
        }
      };
      window.addEventListener('message', onSaved);
    });

    // 2. Text highlighting: save selected text
    document.addEventListener('mouseup', () => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : '';
      if (text.length > 5) {
        if (iframeElement && iframeElement.contentWindow) {
          iframeElement.contentWindow.postMessage(
            {
              action: 'NOTION_SAVE_SET_SELECTION',
              selectedText: text,
            },
            '*'
          );
        }
      }
    });

    // 3. Listener for background script messages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'TOGGLE_OVERLAY') {
        toggleOverlay();
        sendResponse({ status: 'ok' });
      }
    });
  },
});
