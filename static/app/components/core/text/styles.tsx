import type {Theme} from '@emotion/react';

import type {FontSize} from 'sentry/utils/theme';

import type {HeadingProps} from './heading';
import type {TextProps} from './text';

export function getTextDecoration(p: TextProps<any> | HeadingProps) {
  const decorations: string[] = [];
  if (p.strikethrough) {
    decorations.push('line-through');
  }
  if (p.underline) {
    decorations.push('underline');

    if (p.underline === 'dotted') {
      decorations.push('dotted');
    }
  }
  return decorations.join(' ');
}

export function getLineHeight(
  density: 'compressed' | 'comfortable' | undefined,
  theme: Theme
): string | undefined {
  switch (density) {
    case 'compressed':
      return theme.font.lineHeight.compressed.toString();
    case 'comfortable':
      return theme.font.lineHeight.comfortable.toString();
    case undefined:
    default:
      return theme.font.lineHeight.default.toString();
  }
}

export function getFontSize(
  size: FontSize | undefined,
  theme: Theme
): string | undefined {
  if (size === undefined) {
    return undefined;
  }

  return theme.font.size[size];
}
