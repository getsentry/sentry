import type {EChartBrushArea} from 'sentry/types/echarts';

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
 *
 * Returns `null` for a selection that collapses on either axis (a click, or a
 * purely vertical/horizontal drag): a zero-width span isn't a zoom, and would
 * resolve to an empty range (e.g., `value:>=x value:<x`, matching nothing).
 * Any selection with positive extent on both axes is allowed.
 */
export function pickBoxZoomRange(area: EChartBrushArea | undefined): BoxZoomRange | null {
  if (!area) {
    return null;
  }

  const {coordRanges} = area;
  const range =
    (Array.isArray(coordRanges) && coordRanges.length > 0
      ? coordRangeToBoxZoomRange(coordRanges[coordRanges.length - 1])
      : null) ?? coordRangeToBoxZoomRange(area.coordRange);

  if (
    !range ||
    range.xRange[0] === range.xRange[1] ||
    range.yRange[0] === range.yRange[1]
  ) {
    return null;
  }
  return range;
}

/**
 * Turn an ECharts `rect` brush coordinate range (`[[xMin, xMax], [yMin, yMax]]`,
 * in axis units) into sorted x/y ranges, or `null` if it isn't that shape.
 */
function coordRangeToBoxZoomRange(
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
