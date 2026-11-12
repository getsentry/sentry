import type {HeadingSize, TextSize, Theme} from '@sentry/scraps/theme';

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

  // Use String() rather than calling .toString() on the token: some browser
  // builds (Chrome 154) have been observed dispatching Number.prototype.toString
  // with a non-Number receiver here, crashing render.
  return String(theme.font.lineHeight[density]);
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
