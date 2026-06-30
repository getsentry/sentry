export interface BoxZoomRange {
  /**
   * The selected range on the X-axis, in the X-axis's own units (for a `time`
   * axis, milliseconds since epoch).
   */
  xRange: [number, number];
  /**
   * The selected range on the Y-axis, in the Y-axis's own units.
   */
  yRange: [number, number];
}

/**
 * A brush area over a grid with multiple coordinate systems exposes a
 * `coordRange` per axis-pair combination. ECharts only types the singular
 * `coordRange`, so reach for the plural one here.
 */
export interface BrushArea {
  coordRange?: number[] | number[][];
  coordRanges?: number[][][];
}

/**
 * Pick the brush selection expressed on the *target* (overlay) axes.
 *
 * A brush over a grid with several coordinate systems reports one coordinate
 * range per axis-pair it touches, in ascending axis-index order. For a heat map
 * those are `(category, value)`, `(time, category)`, `(time, value)` — so the
 * all-overlay pair, on the highest-index axes, is the *last* entry. ECharts
 * doesn't label entries by axis, so we rely on that ordering; if it ever shifts,
 * a wrong zoom is immediately visible.
 *
 * Falls back to the singular `coordRange` for charts with one coordinate system.
 */
export function pickBoxZoomRange(area: BrushArea | undefined): BoxZoomRange | null {
  if (!area) {
    return null;
  }

  const {coordRanges} = area;
  if (Array.isArray(coordRanges) && coordRanges.length > 0) {
    const overlay = toBoxZoomRange(coordRanges[coordRanges.length - 1]);
    if (overlay) {
      return overlay;
    }
  }

  return toBoxZoomRange(area.coordRange);
}

/**
 * Turn an ECharts `rect` brush coordinate range (`[[xMin, xMax], [yMin, yMax]]`,
 * in axis units) into sorted x/y ranges, or `null` if it isn't that shape.
 */
function toBoxZoomRange(
  coordRange: number[] | number[][] | undefined
): BoxZoomRange | null {
  if (
    !Array.isArray(coordRange) ||
    !Array.isArray(coordRange[0]) ||
    !Array.isArray(coordRange[1]) ||
    coordRange[0].length !== 2 ||
    coordRange[1].length !== 2
  ) {
    return null;
  }
  const [xPair, yPair] = coordRange;
  if (
    typeof xPair[0] !== 'number' ||
    typeof xPair[1] !== 'number' ||
    typeof yPair[0] !== 'number' ||
    typeof yPair[1] !== 'number'
  ) {
    return null;
  }
  return {
    xRange: [Math.min(xPair[0], xPair[1]), Math.max(xPair[0], xPair[1])],
    yRange: [Math.min(yPair[0], yPair[1]), Math.max(yPair[0], yPair[1])],
  };
}
