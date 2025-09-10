import type {Theme} from '@emotion/react';

import type {Responsive} from 'sentry/components/core/layout/styles';

import type {HeadingProps} from './heading';
import type {TextProps} from './text';

export function getTextDecoration(p: TextProps<any> | HeadingProps) {
  const decorations: string[] = [];
  if (p.strikethrough) {
    decorations.push('line-through');
  }
  if (p.underline) {
    decorations.push('underline');
  }
  return decorations.join(' ');
}

export function getLineHeight(density: ResponsiveValue<TextProps<any>['density']>) {
  switch (density) {
    case 'compressed':
      return '1';
    case 'comfortable':
      return '1.4';
    // @TODO: Fixed density is 16, how does that work with larger sizes?
    case undefined:
    default:
      return '1.2';
  }
}

export function getFontSize(
  size: NonNullable<ResponsiveValue<TextProps<any>['size']>>,
  theme: Theme
) {
  return theme.fontSize[size];
}

type ResponsiveValue<T> = T extends Responsive<infer U> ? U : T;
