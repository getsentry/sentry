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
