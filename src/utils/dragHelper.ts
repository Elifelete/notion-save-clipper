import React from 'react';

/**
 * Handles mousedown on draggable modal headers.
 * Waits for a 4px movement threshold before starting drag to avoid capturing simple clicks.
 */
export function handleHeaderMouseDown(e: React.MouseEvent) {
  // If clicked inside an interactive element, do not initiate drag
  const target = e.target as HTMLElement | null;
  if (!target || target.closest('button, input, select, textarea, a, [role="button"]')) {
    return;
  }

  // Only respond to primary (left) mouse button
  if (e.button !== 0) return;

  const startX = e.screenX;
  const startY = e.screenY;
  const clientX = e.clientX;
  const clientY = e.clientY;
  let dragStarted = false;

  const onMouseMove = (moveEvent: MouseEvent) => {
    const dx = moveEvent.screenX - startX;
    const dy = moveEvent.screenY - startY;

    if (!dragStarted) {
      // Require at least 4 pixels of intentional movement before triggering drag
      if (Math.hypot(dx, dy) >= 4) {
        dragStarted = true;
        moveEvent.preventDefault();
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            {
              action: 'NOTION_SAVE_START_DRAG',
              clientX,
              clientY,
            },
            '*'
          );
        }
      }
    }
  };

  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('mouseup', onMouseUp, true);

    if (dragStarted) {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            action: 'NOTION_SAVE_STOP_DRAG',
          },
          '*'
        );
      }
    }
  };

  window.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('mouseup', onMouseUp, true);
}
