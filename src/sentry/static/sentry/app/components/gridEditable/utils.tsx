export const COL_WIDTH_MIN = 100;

// Default width if it wasn't specified
export const COL_WIDTH_DEFAULT = 300;
export const COL_WIDTH_NUMBER = COL_WIDTH_MIN;
export const COL_WIDTH_STRING = 250;
export const COL_WIDTH_STRING_LONG = 400;

// Store state at the start of "resize" action
export type ColResizeMetadata = {
  columnIndex: number; // Column being resized
  columnWidth: number; // Column width at start of resizing
  cursorX: number; // X-coordinate of cursor on window
};
