import type {CSSProperties} from 'react';
import {useTheme} from '@emotion/react';

import type {Theme} from '@sentry/scraps/theme';

import type {Responsive, ResponsiveKey} from './styles';
import {YAK_RESPONSIVE_KEYS} from './yakResponsive';

export interface LayoutStyle {
  classNames: string[];
  inline: boolean;
  style: Record<string, string | number>;
  theme: Theme;
}

export function useLayoutStyle(inline = false): LayoutStyle {
  const theme = useTheme();
  return {classNames: [], inline, style: {}, theme};
}

/** Each class selects one extracted declaration; values stay on the element. */
export function addLayoutProp<T>(
  acc: LayoutStyle,
  property: string,
  value: Responsive<T> | undefined,
  resolve?: (value: T, theme: Theme) => string | number | undefined
): void {
  if (value === undefined) {
    return;
  }
  const add = (v: T, key?: ResponsiveKey) => {
    const resolved = resolve ? resolve(v, acc.theme) : v;
    if (resolved === undefined) {
      return false;
    }
    const suffix = key ? `-${key.replace(':', '-')}` : '';
    const name = `yk-${property}${suffix}`;
    acc.classNames.push(name);
    acc.style[`--${name}`] = resolved as string | number;
    if (acc.inline && key === undefined && typeof value !== 'object') {
      acc.style[property] = resolved as string | number;
    }
    return true;
  };
  if (typeof value !== 'object' || value === null) {
    add(value as T);
    return;
  }
  let first = true;
  for (const key of YAK_RESPONSIVE_KEYS) {
    const v = (value as Partial<Record<ResponsiveKey, T>>)[key];
    if (v !== undefined && add(v, first ? undefined : key)) {
      first = false;
    }
  }
}

export function finishLayoutStyle(
  acc: LayoutStyle,
  className?: string,
  style?: CSSProperties
): {className: string; style: CSSProperties} {
  return {
    className: [...acc.classNames, className].filter(Boolean).join(' '),
    style: {...acc.style, ...style},
  };
}
