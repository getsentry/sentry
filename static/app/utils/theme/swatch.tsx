import type {color} from 'sentry/utils/theme/scraps/tokens/color';

type CategoricalPaletteKey = keyof typeof color.categorical.light;
type CategoricalPalette = Record<CategoricalPaletteKey, string>;
type OnVibrant = {dark: string; light: string};

/**
 * Hardcoded contrast mapping for categorical palette colors.
 * Colors that need light (white) text on top vs dark (black) text.
 */
const SWATCH_CONTRAST_MAP: Record<CategoricalPaletteKey, 'light' | 'dark'> = {
  blurple: 'light',
  purple: 'light',
  indigo: 'light',
  plum: 'light',
  magenta: 'light',
  pink: 'light',
  salmon: 'dark',
  orange: 'dark',
  yellow: 'dark',
  lime: 'dark',
  green: 'dark',
};

function hashIdentifier(identifier: string): number {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash += identifier.charCodeAt(i);
  }
  return hash;
}

export type Swatch = ReturnType<typeof makeSwatch>;

export function makeSwatch(palette: CategoricalPalette, onVibrant: OnVibrant) {
  const entries = Object.entries(palette) as Array<[CategoricalPaletteKey, string]>;
  const swatchColors = entries.map(([key, hex]) => ({
    background: hex,
    content: onVibrant[SWATCH_CONTRAST_MAP[key]],
  }));
  const colorSet: ReadonlySet<string> = Object.freeze(
    new Set(entries.map(([, hex]) => hex))
  );

  return {
    /**
     * Given a string input, deterministically pick a single color from the
     * categorical palette. Returns both the background color and the correct
     * contrasting content (text) color.
     *
     * The same input always produces the same color pair.
     */
    get(input: string): {background: string; content: string} {
      const index = hashIdentifier(input) % swatchColors.length;
      return swatchColors[index]!;
    },

    /**
     * Returns an iterator over the categorical color palette values.
     *
     * The iteration order should not be relied on as an API detail.
     * To deterministically pick a color for a given input, use
     * `get(input)` instead.
     */
    values(): IterableIterator<string> {
      return colorSet.values();
    },
  };
}
