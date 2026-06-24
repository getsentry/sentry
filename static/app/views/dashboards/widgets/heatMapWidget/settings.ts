// Heat map color ramps (low → high). ECharts' continuous `visualMap`
// interpolates between whatever stops it's given, so a ramp is just an ordered
// list of ~10 hex stops — swapping schemes is a one-line change here.
//
// These are perceptually-uniform colormaps (viridis for light, magma for dark):
// each step is roughly equal in perceived lightness, and — crucially — the high
// end is bright and distinct. The previous purple→magenta ramp packed its top
// half into similarly-dark stops, so high-magnitude cells (e.g. 1M vs 18M) were
// indistinguishable. Per the Datadog heatmap write-up, human brightness
// perception follows a power law (we discriminate poorly among dark shades), so
// ending bright keeps the hottest cells legible.
//
// The ramp variant is chosen per theme so the low end stays visible against the
// chart background. Empty/zero buckets are NOT part of the palette — they're
// rendered transparent by a piecewise `visualMap` in `HeatMapWidgetVisualization`.

/** Viridis, sampled at 10 stops. Used on light backgrounds. */
export const HEATMAP_COLORS_LIGHT = [
  '#440154',
  '#482878',
  '#3e4a89',
  '#31688e',
  '#26828e',
  '#1f9e89',
  '#35b779',
  '#6ece58',
  '#b5de2b',
  '#fde725',
] as const;

/** Magma, sampled at 10 stops. Used on dark backgrounds. */
export const HEATMAP_COLORS_DARK = [
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
