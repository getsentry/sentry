/**
 * Width (px) reserved on the right edge for the overflow menu trigger button.
 * Kept slightly larger than the actual button so the trigger never overlaps
 * the last visible tab.
 */
const RESERVED_OVERFLOW_TRIGGER_WIDTH = 48;

/**
 * Width (px) the tabs may exceed the container by and still count as fitting.
 * When the page is zoomed, the tab widths can add up to a fraction of a pixel
 * more than a container that is exactly as wide as them.
 */
const SUBPIXEL_TOLERANCE = 0.5;

export interface TabFit {
  /**
   * Distance (px) from the start of the list to where the overflow trigger
   * goes: right after the last visible tab.
   */
  triggerOffset: number;
  /**
   * Number of leading tabs that fit. The rest overflow.
   */
  visibleCount: number;
}

/**
 * Fits tabs of the given widths into the available space, reserving room for
 * the overflow trigger only when some tabs don't fit. The first tab is always
 * kept so the tab bar never collapses to only the overflow trigger.
 */
export function fitTabs(widths: number[], gap: number, available: number): TabFit {
  const fullWidth =
    widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1);
  if (fullWidth <= available + SUBPIXEL_TOLERANCE) {
    return {visibleCount: widths.length, triggerOffset: 0};
  }

  const [firstWidth = 0, ...restWidths] = widths;
  const budget = available - RESERVED_OVERFLOW_TRIGGER_WIDTH;
  let used = firstWidth;
  let visibleCount = 1;
  for (const width of restWidths) {
    if (used + gap + width > budget) {
      break;
    }
    used += gap + width;
    visibleCount++;
  }

  // The first tab can exceed the budget on its own. Never place the trigger
  // past the right edge of the available space.
  return {visibleCount, triggerOffset: Math.max(0, Math.min(used + gap, budget))};
}
