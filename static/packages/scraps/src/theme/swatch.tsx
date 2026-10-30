type OnVibrant = {dark: string; light: string};

/**
 * Hardcoded contrast mapping for categorical palette colors.
 * Colors that need light (white) text on top vs dark (black) text.
 */
const SWATCH_CONTRAST_MAP: Record<string, 'light' | 'dark'> = {
  blurple: 'light',
  purple: 'light',
  indigo: 'light',
  plum: 'light',
  magenta: 'light',
  pink: 'light',
  salmon: 'dark',
  orange: 'dark',
  yellow: 'dark',
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

export function makeSwatch(palette: Record<string, string>, onVibrant: OnVibrant) {
  const entries = Object.entries(palette);
  const swatchColors = entries.map(([key, hex]) => ({
    background: hex,
    // oxlint-disable-next-line typescript/no-non-null-assertion -- Categorical palettes use the keys in this contrast map.
    content: onVibrant[SWATCH_CONTRAST_MAP[key]!],
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
      const index = hashIdentifier(input ?? '') % swatchColors.length;
      // oxlint-disable-next-line typescript/no-non-null-assertion -- Modulo selects an entry from the non-empty categorical palette.
      return {...swatchColors[index]!};
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
