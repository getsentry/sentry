import type {Theme} from '@emotion/react';

import {hexToOklch, oklchToHex} from './color';

// Dark mode: a fixed deep shade, with chroma capped so the chonk never glows
// brighter than the button surface.
const DARK_CHONK_L = 0.19;
const DARK_CHONK_MAX_C = 0.09;

// Light mode: how much darker (OKLCH lightness) the chonk is than the avatar.
const DARKER_STEP = 0.13;
// How much darker the chonk must be than the bottom edge of a full-bleed image
// for the button's edge to stay visible.
export const MIN_EDGE_STEP = 0.1;
// Below this lightness a light-mode chonk reads as black, not the hue.
export const MIN_DARK_CHONK = 0.25;
// The lighter fallback: how much lighter than the avatar, and its ceiling.
const LIGHTER_STEP = 0.26;
const MAX_LIGHTER_CHONK = 0.8;

/**
 * The chonk for an avatar's brand color, built the way the theme builds the
 * chonks of the accent, danger and warning buttons (compare them in OKLCH): the
 * same hue, one fixed step darker in light mode, and a fixed deep shade in dark
 * mode. Chroma is lowered to what sRGB can show at that lightness, so dark
 * oranges stay orange-brown (like the warning chonk) instead of clipping to red.
 *
 * `edge` is the color along the bottom of a full-bleed image, or null when no
 * image sits on the chonk. The chonk stays at least MIN_EDGE_STEP darker than
 * it, so an image that darkens toward the bottom doesn't merge into its chonk.
 *
 * In light mode, a dark avatar (like the Sentry logo) would push that darker
 * step to near-black, which loses the hue. Below MIN_DARK_CHONK the chonk flips
 * to a lighter tint of the same hue instead, still clear of the avatar.
 */
export function getAvatarChonk(
  brand: string,
  themeType: Theme['type'],
  edge: string | null
): string {
  const {l, c, h} = hexToOklch(brand);
  if (themeType === 'dark') {
    return oklchToHex({l: DARK_CHONK_L, c: Math.min(c, DARK_CHONK_MAX_C), h});
  }

  const edgeL = edge === null ? null : hexToOklch(edge).l;
  const darker = Math.min(
    l - DARKER_STEP,
    edgeL === null ? Infinity : edgeL - MIN_EDGE_STEP
  );
  if (darker >= MIN_DARK_CHONK) {
    return oklchToHex({l: darker, c, h});
  }
  const lighter = Math.min(MAX_LIGHTER_CHONK, Math.max(l, edgeL ?? 0) + LIGHTER_STEP);
  return oklchToHex({l: lighter, c, h});
}
