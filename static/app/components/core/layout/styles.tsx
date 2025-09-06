import {useCallback, useMemo, useSyncExternalStore} from 'react';
import {
  css,
  useTheme,
  type DO_NOT_USE_ChonkTheme,
  type SerializedStyles,
} from '@emotion/react';

import type {Theme} from 'sentry/utils/theme';
import {isChonkTheme} from 'sentry/utils/theme/withChonk';

// It is unfortunate, but Emotion seems to use the fn callback name in the classname, so lets keep it short.
export function rc<T>(
  property: string,
  value: Responsive<T> | undefined,
  theme: Theme,
  // Optional resolver function to transform the value before it is applied to the CSS property.
  resolver?: (value: T, breakpoint: Breakpoint | undefined, theme: Theme) => string
): SerializedStyles | undefined {
  if (!value) {
    return undefined;
  }

  // Most values are unlikely to be responsive, so we can resolve
  // them directly and return early.
  if (!isResponsive(value)) {
    return css`
      ${property}: ${resolver
        ? resolver(value as T, undefined, theme)
        : (value as string)};
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
export type Border = keyof Theme['tokens']['border'];
export type Breakpoint = keyof Theme['breakpoints'];

/**
 * Prefer using padding or gap instead.
 * @deprecated
 */
export type Margin = SpacingSize | 'auto' | '0';

// @TODO(jonasbadalic): audit for memory usage and linting performance issues.
// These may not be trivial to infer as we are dealing with n^4 complexity
export type Shorthand<T extends string, N extends 4 | 2> = N extends 4
  ? `${T} ${T} ${T} ${T}` | `${T} ${T} ${T}` | `${T} ${T}` | `${T}`
  : N extends 2
    ? `${T} ${T}` | `${T}`
    : never;

export type Responsive<T> = T | Partial<Record<Breakpoint, T>>;

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

function resolveMargin(sizeComponent: Margin, theme: Theme) {
  if (sizeComponent === undefined) {
    return undefined;
  }

  if (sizeComponent === 'auto') {
    return 'auto';
  }

  if (sizeComponent === '0') {
    return '0';
  }

  return theme.space[sizeComponent] ?? theme.space['0'];
}

export function getBorder(
  border: Border,
  _breakpoint: Breakpoint | undefined,
  theme: Theme
) {
  return border
    .split(' ')
    .map(b => `1px solid ${theme.tokens.border[b as keyof Theme['tokens']['border']]}`)
    .join(' ');
}

export function getRadius(
  radius: Shorthand<RadiusSize, 4>,
  _breakpoint: Breakpoint | undefined,
  theme: Theme
) {
  if (radius.length < 3) {
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
  if (spacing.length < 3) {
    // This can only be a single spacing value, so we can resolve it directly.
    return resolveSpacing(spacing as SpacingSize, theme) as string;
  }

  return spacing
    .split(' ')
    .map(size => resolveSpacing(size as SpacingSize, theme))
    .join(' ');
}

export function getMargin(
  margin: Shorthand<Margin, 4>,
  _breakpoint: Breakpoint | undefined,
  theme: Theme
) {
  if (margin.length < 3) {
    // This can only be a single margin value, so we can resolve it directly.
    return resolveMargin(margin as Margin, theme) as string;
  }

  return margin
    .split(' ')
    .map(size => resolveMargin(size as Margin, theme))
    .join(' ');
}

/**
 * Hook that resolves responsive values to their current breakpoint value.
 * Mirrors the behavior of the rc() function but returns the resolved value
 * instead of generating CSS media queries.
 */
type ResponsiveValue<T> = T extends Responsive<infer U> ? U : never;
export function useResponsivePropValue<T extends Responsive<any>>(
  prop: T
): ResponsiveValue<T> {
  const activeBreakpoint = useActiveBreakpoint();

  // Only resolve the active breakpoint if the prop is responsive, else ignore it.
  if (!isResponsive(prop)) {
    return prop as ResponsiveValue<T>;
  }

  if (Object.keys(prop).length === 0) {
    throw new Error('Responsive prop must contain at least one breakpoint');
  }

  // If the active breakpoint exists in the prop, return it
  if (prop[activeBreakpoint] !== undefined) {
    return prop[activeBreakpoint];
  }

  let value: ResponsiveValue<T> | undefined;

  const activeIndex = BREAKPOINT_ORDER.indexOf(activeBreakpoint);

  // If we don't have an exact match, find the next smallest breakpoint
  for (let i = activeIndex - 1; i >= 0; i--) {
    const smallerBreakpoint = BREAKPOINT_ORDER[i]!;
    if (prop[smallerBreakpoint] !== undefined) {
      value = prop[smallerBreakpoint];
      break;
    }
  }

  // If no smaller breakpoint found, then window < smallest breakpoint, so we need to find the first larger breakpoint
  if (value === undefined) {
    for (let i = activeIndex + 1; i < BREAKPOINT_ORDER.length; i++) {
      const largerBreakpoint = BREAKPOINT_ORDER[i]!;
      if (prop[largerBreakpoint] !== undefined) {
        value = prop[largerBreakpoint];
        break;
      }
    }
  }

  return value as ResponsiveValue<T>;
}

export function useActiveBreakpoint(): Breakpoint {
  const theme = useTheme();

  const mediaQueries = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return [];
    }

    const queries: Array<{breakpoint: Breakpoint; query: MediaQueryList}> = [];

    // Iterate in reverse so that we always find the largest breakpoint
    for (let i = BREAKPOINT_ORDER.length - 1; i >= 0; i--) {
      const bp = BREAKPOINT_ORDER[i];

      if (bp === undefined) {
        continue;
      }

      queries.push({
        breakpoint: bp,
        query: window.matchMedia(`(min-width: ${theme.breakpoints[bp]})`),
      });
    }

    return queries;
  }, [theme.breakpoints]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!mediaQueries.length) {
        return () => {};
      }

      const controller = new AbortController();

      for (const query of mediaQueries) {
        query.query.addEventListener('change', onStoreChange, {
          signal: controller.signal,
        });
      }

      return () => controller.abort();
    },
    [mediaQueries]
  );

  return useSyncExternalStore(subscribe, () => findLargestBreakpoint(mediaQueries));
}

function findLargestBreakpoint(
  queries: Array<{breakpoint: Breakpoint; query: MediaQueryList}>
): Breakpoint {
  // Find the largest active breakpoint with a defined value
  // This mirrors the logic in rc() function
  for (const query of queries) {
    if (query === undefined) {
      continue;
    }

    if (!query.query.matches) {
      continue;
    }

    return query.breakpoint;
  }

  // Since we use min width, the only remaining breakpoint that we might have missed is <xs,
  // in which case we return xs, which is in line with behavior of rc() function.
  return 'xs';
}
