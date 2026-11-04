import {useTheme} from '@emotion/react';

import type {IconVariant} from './svgIcon';

// Only icons with a variant need these tokens. Keep the contract local so the
// package can run without the application's Emotion theme declaration.
interface IconTheme {
  tokens: {
    content: Record<Exclude<IconVariant, 'muted'>, string>;
    graphics: {warning: {vibrant: string}};
  };
}

export function useIconTheme() {
  return useTheme() as IconTheme;
}
