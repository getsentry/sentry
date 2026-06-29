interface OffsetRect {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

/**
 * Calculates the bounding rectangle of an element expressed relative to another
 * element's top-left corner, rather than relative to the viewport.
 */
export function getOffsetRect(el: HTMLElement, relativeTo: HTMLElement): OffsetRect {
  const rect = el.getBoundingClientRect();
  const relativeRect = relativeTo.getBoundingClientRect();
  return {
    left: rect.left - relativeRect.left,
    top: rect.top - relativeRect.top,
    right: rect.right - relativeRect.left,
    bottom: rect.bottom - relativeRect.top,
    width: rect.width,
    height: rect.height,
  };
}
