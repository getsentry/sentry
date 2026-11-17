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
 *
 * In light mode, a dark avatar (like the Sentry logo) would push that darker
 * step to near-black, which loses the hue. Below MIN_DARK_CHONK the chonk flips
 * to a lighter tint of the same hue instead, still clear of the avatar.
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
  if (themeType === 'dark') {
    return oklchToHex({l: 0.19, c: Math.min(c, 0.09), h});
  }
  const edgeL = edge ? hexToOklch(edge).l : undefined;
  const darker = Math.min(l - 0.13, edgeL === undefined ? 1 : edgeL - MIN_EDGE_STEP);
  if (darker >= MIN_DARK_CHONK) {
    return oklchToHex({l: darker, c, h});
  }
  const lighter = Math.min(MAX_LIGHT_CHONK, Math.max(l, edgeL ?? 0) + LIGHT_CHONK_STEP);
  return oklchToHex({l: lighter, c, h});
}

// Below this OKLCH lightness a light-mode chonk reads as black, not the hue.
export const MIN_DARK_CHONK = 0.25;
// How much lighter than the avatar the light-mode fallback chonk is.
const LIGHT_CHONK_STEP = 0.26;
const MAX_LIGHT_CHONK = 0.8;

// How much darker (OKLCH lightness) the chonk must be than the bottom edge of a
// full-bleed image for the button's edge to stay visible.
export const MIN_EDGE_STEP = 0.1;
