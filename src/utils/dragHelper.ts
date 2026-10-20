import React from 'react';

let isPointerActive = false;

/**
 * Handles pointer/mouse down on draggable modal headers.
 * Uses delta-based screen movement for buttery-smooth 60fps dragging without freezing or jumping.
 */
export function handleHeaderMouseDown(e: React.PointerEvent | React.MouseEvent) {
  const target = e.target as HTMLElement | null;

  // Never initiate drag if clicked on interactive controls, menus, dialogs, or elements marked with data-no-drag
  if (
    !target ||
    target.closest(
      'button, input, select, textarea, a, [role="button"], [role="menu"], [role="menuitem"], [role="dialog"], [data-no-drag], .no-drag'
    )
  ) {
    return;
  }

  // Only respond to primary (left) mouse button
  if (e.button !== 0) return;

  if (isPointerActive) return;
  isPointerActive = true;

  const currentTarget = e.currentTarget as HTMLElement;
  const pointerId = (e as any).pointerId;

  if (typeof pointerId === 'number' && currentTarget.setPointerCapture) {
    try {
      currentTarget.setPointerCapture(pointerId);
    } catch {}
  }

  let lastScreenX = e.screenX;
  let lastScreenY = e.screenY;
  let isMoving = false;

  const onMove = (moveEvent: PointerEvent | MouseEvent) => {
    const dx = moveEvent.screenX - lastScreenX;
    const dy = moveEvent.screenY - lastScreenY;

    lastScreenX = moveEvent.screenX;
    lastScreenY = moveEvent.screenY;

    if (!isMoving) {
      if (Math.hypot(dx, dy) >= 1) {
        isMoving = true;
      }
    }

    if (isMoving && (dx !== 0 || dy !== 0)) {
      moveEvent.preventDefault();
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            action: 'NOTION_SAVE_DRAG_DELTA',
            dx,
            dy,
          },
          '*'
        );
      }
    }
  };

  const onEnd = (endEvent: PointerEvent | MouseEvent) => {
    isPointerActive = false;

    if (typeof pointerId === 'number' && currentTarget.releasePointerCapture) {
      try {
        currentTarget.releasePointerCapture(pointerId);
      } catch {}
    }

    window.removeEventListener('pointermove', onMove as any, true);
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('pointerup', onEnd as any, true);
    window.removeEventListener('mouseup', onEnd, true);
    window.removeEventListener('pointercancel', onEnd as any, true);
  };

  window.addEventListener('pointermove', onMove as any, true);
  window.addEventListener('mousemove', onMove, true);
  window.addEventListener('pointerup', onEnd as any, true);
  window.addEventListener('mouseup', onEnd, true);
  window.addEventListener('pointercancel', onEnd as any, true);
}
