// Heat map color ramps (low → high). ECharts' continuous `visualMap`
// interpolates between whatever stops it's given, so a ramp is just an ordered
// list of ~10 hex stops.
//
// Each ramp targets two properties so that cells of different magnitude stay
// distinguishable:
//   1. Lightness climbs steadily from one end to the other, giving a "brighter =
//      more" cue that's readable on its own (and survives greyscale).
//   2. The high end is bright and high-contrast. Human brightness perception
//      follows a power law — we resolve bright shades far better than dark ones
//      — so a ramp that ends bright keeps the busiest cells legible instead of
//      letting them blur together at a murky top end.
// Wandering through several hues along the way (rather than a single hue getting
// lighter) packs in more perceptually-distinct steps for the same lightness range.
//
// Empty/zero buckets are NOT part of the palette — they're rendered transparent
// by a piecewise `visualMap` in `HeatMapWidgetVisualization`.

/** Viridis, sampled at 10 stops. */
const VIRIDIS = [
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

/** Magma, sampled at 10 stops. */
const MAGMA = [
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
 * Sentry brand ramp: deep indigo → blurple → magenta → pink → salmon → orange →
 * yellow. Built from the theme's blue ramp (low end) and the categorical
 * data-viz palette (warm end), so it traces a magma-like arc in brand hues.
 */
const SENTRY_BRAND = [
  '#24006c',
  '#3f00a7',
  '#5827d6',
  '#7553ff',
  '#b82d90',
  '#f0369a',
  '#fa6769',
  '#ff9838',
  '#ffd00e',
] as const;

const OLD_SENTRY = [
  '#eeefff',
  '#d0c8ff',
  '#b2a1ff',
  '#937aff',
  '#7c42dd',
  '#8332bb',
  '#8b219a',
  '#921178',
  '#990056',
] as const;

/** Every selectable heat map palette, keyed by name. */
export const HEATMAP_PALETTES = {
  viridis: VIRIDIS,
  magma: MAGMA,
  brand: SENTRY_BRAND,
  old: OLD_SENTRY,
} as const;

export type HeatMapPaletteName = keyof typeof HEATMAP_PALETTES;

/**
 * Which palette to use for each theme. Change these two values to re-skin the
 * heat map — pick a low end that's visible against that theme's background and a
 * top end that contrasts it.
 */
export const HEATMAP_PALETTE_BY_THEME: Record<'light' | 'dark', HeatMapPaletteName> = {
  light: 'brand',
  dark: 'old',
};

/** Resolve the heat map color ramp for a theme (`theme.type`). */
export function getHeatMapColors(themeType: 'light' | 'dark'): readonly string[] {
  return HEATMAP_PALETTES[HEATMAP_PALETTE_BY_THEME[themeType]];
}

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
