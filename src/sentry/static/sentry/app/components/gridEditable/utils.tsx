// Auto layout width.
export const COL_WIDTH_UNDEFINED = -1;

// Store state at the start of "resize" action
export type ColResizeMetadata = {
  columnIndex: number; // Column being resized
  columnWidth: number; // Column width at start of resizing
  cursorX: number; // X-coordinate of cursor on window
};
