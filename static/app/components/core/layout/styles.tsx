import {css, type DO_NOT_USE_ChonkTheme, type SerializedStyles} from '@emotion/react';

import type {Theme} from 'sentry/utils/theme';
import {isChonkTheme} from 'sentry/utils/theme/withChonk';

// It is unfortunate, but Emotion seems to use the fn callback name in the classname, so lets keep it short.
export function rc<T>(
  property: string,
  value: Responsive<T> | undefined,
  theme: Theme,
  // Optional resolver function to transform the value before it is applied to the CSS property.
  resolver?: (
    value: T,
    breakpoint: Breakpoint | undefined,
    theme: Theme
  ) => string | number
): SerializedStyles | undefined {
  if (!value) {
    return undefined;
  }

  // Most values are unlikely to be responsive, so we can resolve
  // them directly and return early.
  if (!isResponsive(value)) {
    return css`
      ${property}: ${resolver ? resolver(value, undefined, theme) : value};
    `;
  }

  let first = true;

  return css`
    ${BREAKPOINT_ORDER.map(breakpoint => {
      const v = value[breakpoint];
      if (v === undefined) {
        return undefined;
      }

      if (first) {
        first = false;
        return css`
          @media (min-width: ${theme.breakpoints[breakpoint]}),
            (max-width: ${theme.breakpoints[breakpoint]}) {
            ${property}: ${resolver ? resolver(v, breakpoint, theme) : (v as string)};
          }
        `;
      }

      return css`
        @media (min-width: ${theme.breakpoints[breakpoint]}) {
          ${property}: ${resolver ? resolver(v, breakpoint, theme) : (v as string)};
        }
      `;
    }).filter(Boolean)}
  `;
}

const BREAKPOINT_ORDER: readonly Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];

// We alias None -> 0 to make it slighly more terse and easier to read.
export type RadiusSize = keyof DO_NOT_USE_ChonkTheme['radius'];
export type SpacingSize = keyof Theme['space'];
type Breakpoint = keyof Theme['breakpoints'];

// @TODO(jonasbadalic): audit for memory usage and linting performance issues.
// These may not be trivial to infer as we are dealing with n^4 complexity
export type Shorthand<T extends string, N extends 4 | 2> = N extends 4
  ? `${T} ${T} ${T} ${T}` | `${T} ${T} ${T}` | `${T} ${T}` | `${T}`
  : N extends 2
    ? `${T} ${T}` | `${T}`
    : never;

export type Responsive<T> = T | Record<Breakpoint, T | undefined>;

function isResponsive(prop: unknown): prop is Record<Breakpoint, any> {
  return typeof prop === 'object' && prop !== null;
}

/**
 * Our layout components use string sizes that map to t-shirt sizes, so we need
 * resolvers to transform them into actual CSS values.
 * The task is to take a string like "md sm" and lookup its theme value so that
 * it can become something like "16px 8px". Separate resolvers are needed for
 * handling the different themes and the implementation of chonk vs non chonk.
 */
function resolveRadius(sizeComponent: RadiusSize | undefined, theme: Theme) {
  if (sizeComponent === undefined) {
    return undefined;
  }

  return isChonkTheme(theme) ? theme.radius[sizeComponent] : theme.borderRadius;
}

function resolveSpacing(sizeComponent: SpacingSize, theme: Theme) {
  if (sizeComponent === undefined) {
    return undefined;
  }

  return theme.space[sizeComponent] ?? theme.space['0'];
}

export function getRadius(
  radius: Shorthand<RadiusSize, 4>,
  _breakpoint: Breakpoint | undefined,
  theme: Theme
) {
  if (radius.length <= 3) {
    // This can only be a single radius value, so we can resolve it directly.
    return resolveRadius(radius as RadiusSize, theme) as string;
  }

  return radius
    .split(' ')
    .map(size => resolveRadius(size as RadiusSize, theme))
    .join(' ');
}

export function getSpacing(
  spacing: Shorthand<SpacingSize, 4>,
  _breakpoint: Breakpoint | undefined,
  theme: Theme
): string {
  if (spacing.length <= 3) {
    // This can only be a single spacing value, so we can resolve it directly.
    return resolveSpacing(spacing as SpacingSize, theme) as string;
  }

  return spacing
    .split(' ')
    .map(size => resolveSpacing(size as SpacingSize, theme))
    .join(' ');
}
