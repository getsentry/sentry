import type {Translate} from '@dnd-kit/core';

import {space} from 'sentry/styles/space';

export type WidgetDragPositioning = {
  initialTranslate: Translate;
  translate: Translate;
  left?: number;
  top?: number;
};

export const WIDGET_PREVIEW_DRAG_ID = 'widget-preview-draggable';

export const SIDEBAR_HEIGHT = 54;

export const DEFAULT_TRANSLATE_COORDINATES = {x: 0, y: 0};
const DEFAULT_SPACING = parseInt(space(2).replace('px', ''), 10);
export const DEFAULT_LEFT = DEFAULT_SPACING;
export const DEFAULT_TOP = SIDEBAR_HEIGHT + DEFAULT_SPACING; // 54px sidebar + 16px space

export const DEFAULT_WIDGET_DRAG_POSITIONING: WidgetDragPositioning = {
  initialTranslate: DEFAULT_TRANSLATE_COORDINATES,
  translate: DEFAULT_TRANSLATE_COORDINATES,
  left: DEFAULT_LEFT,
  top: DEFAULT_TOP,
};

export const DRAGGABLE_PREVIEW_HEIGHT = 200;
export const DRAGGABLE_PREVIEW_WIDTH = 300;
export const PREVIEW_HEIGHT = 400;

export const DRAGGABLE_PREVIEW_HEIGHT_PX = `${DRAGGABLE_PREVIEW_HEIGHT}px`;
export const DRAGGABLE_PREVIEW_WIDTH_PX = `${DRAGGABLE_PREVIEW_WIDTH}px`;
export const PREVIEW_HEIGHT_PX = `${PREVIEW_HEIGHT}px`;

/**
 * Snaps the preview to the visible corners of the slideout
 * @param over - The droppable area object from the drag end event
 * @returns The new position of the preview
 */
export function snapPreviewToCorners(over: any | null): WidgetDragPositioning {
  const selectedCorner = over?.id?.toString().split('-');
  return {
    translate: DEFAULT_TRANSLATE_COORDINATES,
    initialTranslate: DEFAULT_TRANSLATE_COORDINATES,
    left: over?.rect
      ? selectedCorner?.[1] === 'left'
        ? over?.rect.left
        : over?.rect.right - DRAGGABLE_PREVIEW_WIDTH
      : undefined,
    top: over?.rect
      ? selectedCorner?.[0] === 'top'
        ? over?.rect.top
        : over?.rect.bottom - DRAGGABLE_PREVIEW_HEIGHT
      : undefined,
  };
}
