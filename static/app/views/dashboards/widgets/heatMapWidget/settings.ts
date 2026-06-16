// Color scale interpolated across three design stops: #EEEFFF (low) → #7553FF
// (mid) → #990056 (high) Steps 1–5: segment 1, steps 6–10: segment 2 N.B.
// Missing values are not part of the palette here, they are filled in by the
// `HeatMapWidgetVisualization` component.
export const HEATMAP_COLORS = [
  '#eeefff',
  '#d0c8ff',
  '#b2a1ff',
  '#937aff',
  '#7553ff',
  '#7c42dd',
  '#8332bb',
  '#8b219a',
  '#921178',
  '#990056',
] as const;

/**
 * Target width, in pixels, of a single heat map X-axis (time) bucket. The
 * interval is chosen so that columns are roughly this wide for the rendered
 * container width.
 */
export const PIXELS_PER_X_BUCKET = 15;

/**
 * Scale used for the heat map's Z axis (the cell color). A logarithmic scale
 * handles the wide range of counts better than a linear one.
 */
export const HEATMAP_Z_AXIS_SCALE = 'log' as const;
