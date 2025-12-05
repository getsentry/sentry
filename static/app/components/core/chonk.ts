import color from 'color';

import type {Theme} from 'sentry/utils/theme';

const chonkCache = new Map<{baseColor: string; type: 'light' | 'dark'}, string>();

export function chonkFor(theme: Theme, baseColor: string) {
  const cacheKey = {baseColor, type: theme.type};
  if (chonkCache.has(cacheKey)) {
    return chonkCache.get(cacheKey)!;
  }
  const input = color(baseColor).hsl();

  const result =
    theme.type === 'dark'
      ? color.hsl(input.hue(), input.saturationl() * 0.1, input.lightness() * 0.1).hex()
      : color
          .hsl(input.hue(), input.saturationl() * 0.85, input.lightness() * 0.85)
          .hex();

  chonkCache.set(cacheKey, result);

  return result;
}

export function debossedBackground(theme: Theme) {
  return {
    backgroundColor: theme.type === 'dark' ? 'rgba(8,0,24,0.28)' : 'rgba(0,0,112,0.03)',
  };
}
