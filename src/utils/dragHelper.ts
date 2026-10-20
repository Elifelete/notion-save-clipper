import React from 'react';

/**
 * Handles mousedown on draggable modal headers.
 * Sends coordinates to the parent host window so the injected iframe overlay can be dragged.
 */
export function handleHeaderMouseDown(e: React.MouseEvent) {
  // If clicked inside any interactive element (buttons, links, inputs, selects), don't drag
  const target = e.target as HTMLElement | null;
  if (!target || target.closest('button, input, select, textarea, a, [role="button"]')) {
    return;
  }

  // Prevent default text selection during drag
  e.preventDefault();

  if (window.parent && window.parent !== window) {
    window.parent.postMessage(
      {
        action: 'NOTION_SAVE_START_DRAG',
        clientX: e.clientX,
        clientY: e.clientY,
      },
      '*'
    );
  }
}
