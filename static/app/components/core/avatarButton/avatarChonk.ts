import type {Theme} from '@emotion/react';

import {isNeutralColor} from './dominantColor';
import {hexToOklch, oklchToHex} from './oklch';

/**
 * The chonk for an avatar's color, built the way the theme builds the chonks of
 * the accent, danger and warning buttons (compare them in OKLCH): the same hue,
 * one fixed step darker in light mode, and a fixed deep shade in dark mode so
 * the chonk never glows brighter than the button surface. Chroma is lowered to
 * what sRGB can show at that lightness, so dark oranges stay orange-brown (like
 * the warning chonk) instead of clipping to red. Gray colors return undefined
 * and keep the default button chonk.
 *
 * `edge` is the color along the bottom of a full-bleed image, which sits right
 * on top of the chonk. The chonk stays at least MIN_EDGE_STEP darker than it,
 * so an image that darkens toward the bottom doesn't merge into its chonk.
 */
export function getAvatarChonk(
  dominant: string,
  themeType: Theme['type'],
  edge?: string
): string | undefined {
  if (isNeutralColor(dominant)) {
    return undefined;
  }
  const {l, c, h} = hexToOklch(dominant);
  const lightness = themeType === 'dark' ? 0.19 : l - 0.13;
  const chroma = themeType === 'dark' ? Math.min(c, 0.09) : c;
  const ceiling = edge ? hexToOklch(edge).l - MIN_EDGE_STEP : 1;
  return oklchToHex({l: Math.max(0, Math.min(lightness, ceiling)), c: chroma, h});
}

// How much darker (OKLCH lightness) the chonk must be than the bottom edge of a
// full-bleed image for the button's edge to stay visible.
export const MIN_EDGE_STEP = 0.1;
