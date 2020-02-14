// Auto layout width.
export const COL_WIDTH_UNDEFINED = -1;
// Set to 90 as the edit/trash icons need this much space.
export const COL_WIDTH_MINIMUM = 90;

// Store state at the start of "resize" action
export type ColResizeMetadata = {
  columnIndex: number; // Column being resized
  columnWidth: number; // Column width at start of resizing
  cursorX: number; // X-coordinate of cursor on window
};
