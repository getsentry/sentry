export const COL_WIDTH_UNDEFINED = -1;
export const COL_WIDTH_MIN = 100;

// Default width if it wasn't specified
export const COL_WIDTH_DEFAULT = 300;

// Starting defaults if column values are known
export const COL_WIDTH_BOOLEAN = COL_WIDTH_MIN;
export const COL_WIDTH_DATETIME = 200;
export const COL_WIDTH_NUMBER = COL_WIDTH_MIN;
export const COL_WIDTH_STRING = COL_WIDTH_DEFAULT;
export const COL_WIDTH_STRING_SHORT = 200;

// Store state at the start of "resize" action
export type ColResizeMetadata = {
  columnIndex: number; // Column being resized
  columnWidth: number; // Column width at start of resizing
  cursorX: number; // X-coordinate of cursor on window
};
