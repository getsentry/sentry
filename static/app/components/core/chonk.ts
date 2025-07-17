import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';
import color from 'color';

const chonkCache = new Map<{baseColor: string; type: 'light' | 'dark'}, string>();

export function chonkFor(theme: DO_NOT_USE_ChonkTheme, baseColor: string) {
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
