import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';
import color from 'color';

export function computeChonk(theme: DO_NOT_USE_ChonkTheme, baseColor: string) {
  const input = color(baseColor).hsl();

  return theme.type === 'dark'
    ? color.hsl(input.hue(), input.saturationl() * 0.1, input.lightness() * 0.1).hex()
    : color.hsl(input.hue(), input.saturationl() * 0.75, input.lightness() * 0.75).hex();
}
