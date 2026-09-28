import type {Theme} from '@emotion/react';

import type {HeadingSize, TextSize} from 'sentry/utils/theme';

import type {BaseTextProps} from './text';

export function getTextDecoration(p: Pick<BaseTextProps, 'strikethrough' | 'underline'>) {
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
  density: keyof Theme['font']['lineHeight'] | undefined,
  theme: Theme
): string | undefined {
  if (density === undefined) {
    return undefined;
  }

  return theme.font.lineHeight[density].toString();
}

export function getFontSize(
  size: TextSize | HeadingSize | undefined,
  theme: Theme
): string | undefined {
  if (size === undefined) {
    return undefined;
  }

  return theme.font.size[size];
}
