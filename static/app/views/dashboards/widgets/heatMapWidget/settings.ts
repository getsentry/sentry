// Heat map color ramp (low → high): magma, sampled at 10 stops. ECharts'
// continuous `visualMap` interpolates between whatever stops it's given, so a
// ramp is just an ordered list of hex stops.
//
// Magma is chosen for two properties that keep cells of different magnitude
// distinguishable:
//   1. Lightness climbs steadily from one end to the other, giving a "brighter =
//      more" cue that's readable on its own (and survives greyscale).
//   2. The high end is bright and high-contrast. Human brightness perception
//      follows a power law — we resolve bright shades far better than dark ones
//      — so a ramp that ends bright keeps the busiest cells legible instead of
//      letting them blur together at a murky top end.
// It also wanders through several hues (rather than a single hue getting
// lighter), packing in more perceptually-distinct steps for the same lightness
// range.
//
// Empty/zero buckets are NOT part of the palette — they're rendered transparent
// by a piecewise `visualMap` in `HeatMapWidgetVisualization`.
export const HEATMAP_COLORS = [
  '#0a0a23',
  '#231151',
  '#410f75',
  '#5f187f',
  '#812581',
  '#a3307e',
  '#c83e73',
  '#e95462',
  '#f97a5d',
  '#fea772',
] as const;

/**
 * Target size, in pixels, of a single heat map bucket along each axis. Both the
 * X-axis (time) interval and the Y-axis bucket count are chosen so that cells
 * are roughly this size, keeping them approximately square.
 */
export const PIXELS_PER_BUCKET = 15;

/**
 * How long, in milliseconds, to debounce the measured chart dimensions before
 * refetching. Resizing a widget changes its size every frame, so without this
 * the heat map would fire a request per pixel.
 */
export const HEATMAP_RESIZE_DEBOUNCE_MS = 500;
