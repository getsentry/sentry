import type {ReactNode, RefObject} from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {useTheme} from '@emotion/react';

import type {
  BorderVariant,
  BreakpointSize,
  RadiusSize,
  SpaceSize,
  Theme,
} from 'sentry/utils/theme';

// The two axes a responsive prop can resolve against. Container is the default
// (bare keys); viewport is opt-in via the `screen:` prefix.
const RESPONSIVE_AXES = ['container', 'viewport'] as const;

// It is unfortunate, but Emotion seems to use the fn callback name in the classname, so lets keep it short.
export function rc<T>(
  property: string,
  value: Responsive<T> | undefined,
  theme: Theme,
  // Optional resolver function to transform the value before it is applied to the CSS property.
  resolver?: (
    value: T | undefined,
    breakpoint: BreakpointSize | undefined,
    theme: Theme
  ) => string | undefined
): string | undefined {
  // Most values are unlikely to be responsive, so we can resolve
  // them directly and return early.
  if (!isResponsive(value)) {
    const resolvedValue = resolver ? resolver(value, undefined, theme) : value;

    // A resolver can return undefined to indicate that the value should be omitted.
    if (resolvedValue === undefined) {
      return undefined;
    }

    return `${property}: ${resolvedValue as string};`;
  }

  // A responsive value is keyed by breakpoint on two independent axes:
  // - bare keys (`xs`, `md`, …) resolve against the nearest query container (@container)
  // - `screen:`-prefixed keys (`screen:md`, …) resolve against the viewport (@media)
  // Both can be combined on the same prop. The smallest defined breakpoint
  // (container first within a breakpoint) is the always-applied base, emitted as
  // a plain declaration so it applies even with no query container present; the
  // rest override it via min-width rules of their respective axis, mobile-first.
  let first = true;
  const declarations: string[] = [];

  for (const breakpoint of BREAKPOINT_ORDER) {
    for (const axis of RESPONSIVE_AXES) {
      const key = axis === 'container' ? breakpoint : `screen:${breakpoint}`;
      const v = (value as Partial<Record<string, T>>)[key];
      const resolvedValue = resolver ? resolver(v, breakpoint, theme) : v;

      // A resolver can return undefined to indicate that the value should be omitted.
      if (resolvedValue === undefined) {
        continue;
      }

      if (first) {
        first = false;
        declarations.push(`${property}: ${resolvedValue as string};`);
        continue;
      }

      const atRule = axis === 'container' ? '@container' : '@media';
      declarations.push(
        `${atRule} (min-width: ${theme.breakpoints[breakpoint]}) {
          ${property}: ${resolvedValue as string};
        }`
      );
    }
  }

  return declarations.join('');
}

const BREAKPOINT_ORDER: readonly BreakpointSize[] = [
  '2xs',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
] as const;

type Margin = SpaceSize | 'auto' | '0';

// @TODO(jonasbadalic): audit for memory usage and linting performance issues.
// These may not be trivial to infer as we are dealing with n^4 complexity
export type Shorthand<T extends string, N extends 4 | 2> = N extends 4
  ? `${T} ${T} ${T} ${T}` | `${T} ${T} ${T}` | `${T} ${T}` | `${T}`
  : N extends 2
    ? `${T} ${T}` | `${T}`
    : never;

/**
 * Responsive prop keys come in two flavors, and may be combined on one prop:
 * - bare keys (`xs`, `md`, ...) resolve against the nearest query container
 *   (`@container`). Container queries are the default, so they take no prefix.
 * - `screen:`-prefixed keys (`screen:md`, ...) resolve against the viewport
 *   (`@media`).
 *
 * e.g. `direction={{xs: 'column', 'screen:lg': 'row'}}` is column until its
 * container reaches `xs`, then a row once the viewport reaches `lg`.
 */
type ScreenBreakpoint = `screen:${BreakpointSize}`;
type ResponsiveBreakpoint = BreakpointSize | ScreenBreakpoint;

export type Responsive<T> = T | Partial<Record<ResponsiveBreakpoint, T>>;

function isResponsive(prop: unknown): prop is Partial<Record<ResponsiveBreakpoint, any>> {
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
    return;
  }

  return theme.radius[sizeComponent];
}

function resolveSpacing(sizeComponent: SpaceSize, theme: Theme) {
  return theme.space[sizeComponent] ?? theme.space['0'];
}

function resolveMargin(sizeComponent: Margin, theme: Theme) {
  if (sizeComponent === 'auto') {
    return 'auto';
  }

  if (sizeComponent === '0') {
    return '0';
  }

  return theme.space[sizeComponent] ?? theme.space['0'];
}

function borderValue(key: Exclude<BorderVariant, 'none'>, theme: Theme): string {
  if (key === 'primary') {
    return theme.tokens.border[key];
  }
  if (key === 'muted' || key === 'secondary') {
    return theme.tokens.border.secondary;
  }
  return theme.tokens.border[key].vibrant;
}

export function getBorder(
  border: BorderVariant | undefined,
  _breakpoint: BreakpointSize | undefined,
  theme: Theme
): string | undefined {
  if (border === undefined) {
    return undefined;
  }

  if (border === 'none') {
    return 'none';
  }

  return border
    .split(' ')
    .map(b => `1px solid ${borderValue(b as Exclude<BorderVariant, 'none'>, theme)}`)
    .join(' ');
}

export function getRadius(
  radius: Shorthand<RadiusSize, 4> | undefined,
  _breakpoint: BreakpointSize | undefined,
  theme: Theme
): string | undefined {
  if (radius === undefined) {
    return undefined;
  }

  if (radius.length < 3) {
    // This can only be a single radius value, so we can resolve it directly.
    return resolveRadius(radius as RadiusSize, theme);
  }

  return radius
    .split(' ')
    .map(size => resolveRadius(size as RadiusSize, theme))
    .join(' ');
}

export function getSpacing(
  spacing: Shorthand<SpaceSize, 4> | undefined,
  _breakpoint: BreakpointSize | undefined,
  theme: Theme
): string | undefined {
  if (spacing === undefined) {
    return undefined;
  }

  if (spacing.length < 3) {
    // This can only be a single spacing value, so we can resolve it directly.
    return resolveSpacing(spacing as SpaceSize, theme);
  }

  return spacing
    .split(' ')
    .map(size => resolveSpacing(size as SpaceSize, theme))
    .join(' ');
}

export function getMargin(
  margin: Shorthand<Margin, 4> | undefined,
  _breakpoint: BreakpointSize | undefined,
  theme: Theme
) {
  if (margin === undefined) {
    return;
  }

  if (margin.length < 3) {
    // This can only be a single margin value, so we can resolve it directly.
    return resolveMargin(margin as Margin, theme);
  }

  return margin
    .split(' ')
    .map(size => resolveMargin(size as Margin, theme))
    .join(' ');
}

/**
 * Resolves a `Responsive<T>` prop to its current value in JS, across both the
 * container and viewport axes — the JS mirror of what `rc()` emits as CSS.
 *
 * This is a low-level building block for **component authors** who accept a
 * `Responsive<T>` prop and must resolve it in JS rather than via CSS (e.g.
 * `Stack`'s `direction`, `SplitPanel`'s `orientation`). Most code shouldn't need
 * it: use plain responsive props (resolved in CSS) for styling, or
 * {@link useContainerBreakpoint} when you need the container's active breakpoint
 * to branch logic. Prefer those unless you're building a responsive prop of your
 * own.
 */
type ResponsiveValue<T> = T extends Responsive<infer U> ? U : never;
export function useResponsivePropValue<T extends Responsive<any>>(
  prop: T
): T | ResponsiveValue<T> {
  const viewportBreakpoint = useActiveBreakpoint();
  // No container ancestor → '2xs', the only value CSS applies in that case (the
  // plain base declaration), so JS and the @container rules stay in agreement.
  const containerBreakpoint = useContext(ContainerQueryContext) ?? '2xs';

  // Only resolve the active breakpoint if the prop is responsive, else ignore it.
  if (!isResponsive(prop)) {
    return prop;
  }

  if (Object.keys(prop).length === 0) {
    throw new Error('Responsive prop must contain at least one breakpoint');
  }

  // Walk the same mobile-first cascade rc() emits and keep the value of the last
  // rule whose condition is currently satisfied. Bare keys are matched against
  // the nearest container's breakpoint, `screen:` keys against the viewport.
  const containerIndex = BREAKPOINT_ORDER.indexOf(containerBreakpoint);
  const viewportIndex = BREAKPOINT_ORDER.indexOf(viewportBreakpoint);

  let resolved: ResponsiveValue<T> | undefined;
  let first = true;

  for (let i = 0; i < BREAKPOINT_ORDER.length; i++) {
    const breakpoint = BREAKPOINT_ORDER[i];
    if (breakpoint === undefined) {
      continue;
    }
    for (const axis of RESPONSIVE_AXES) {
      const key = axis === 'container' ? breakpoint : `screen:${breakpoint}`;
      const value = (prop as Partial<Record<string, ResponsiveValue<T>>>)[key];
      if (value === undefined) {
        continue;
      }

      const activeIndex = axis === 'container' ? containerIndex : viewportIndex;
      // The first defined breakpoint is the always-applied base; later ones only
      // apply once their axis is at least that wide.
      if (first || activeIndex >= i) {
        resolved = value;
      }
      first = false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return resolved!;
}

export function useActiveBreakpoint(): BreakpointSize {
  const theme = useTheme();

  const mediaQueries = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return [];
    }

    const queries: Array<{breakpoint: BreakpointSize; query: MediaQueryList}> = [];

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
  queries: Array<{breakpoint: BreakpointSize; query: MediaQueryList}>
): BreakpointSize {
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
  return '2xs';
}

/**
 * Holds the active breakpoint of the nearest ancestor query container, or null
 * when there is no container ancestor. Provided by container elements (those
 * with a `containerType`) so JS-resolved container queries
 * (`useResponsivePropValue`, `useContainerBreakpoint`) can resolve against the
 * container instead of the viewport.
 *
 * We broadcast the already-resolved breakpoint (not the raw inline-size) so the
 * context value only changes when a breakpoint boundary is crossed — consumers
 * aren't re-rendered on every pixel of a resize.
 *
 * CSS-only responsive props don't need this — they resolve natively via
 * `@container` queries. This context exists purely for the JS resolution path.
 */
export const ContainerQueryContext = createContext<BreakpointSize | null>(null);

/**
 * The JS equivalent of a CSS container query: returns the active breakpoint of
 * the nearest ancestor query container (read from `ContainerQueryContext`),
 * mirroring the mobile-first behavior of `rc()`/`@container`. Must be called
 * inside a query container (a `Container`/`Flex`/… with `containerType`); with
 * no container ancestor it resolves to `2xs` (the base, matching CSS's plain
 * base declaration).
 *
 * Prefer CSS responsive props (bare breakpoint keys like `{xs: …}`) when
 * possible; reach for this hook only when you genuinely need the resolved
 * breakpoint in JS (e.g. to branch rendering). It replaces width-based
 * `useMedia` usage.
 *
 * Returns the active breakpoint *key* so you can branch on it. To resolve a
 * `Responsive<T>` prop to its current *value* in JS (when building a responsive
 * prop of your own), use {@link useResponsivePropValue} instead.
 * @public
 */
export function useContainerBreakpoint(): BreakpointSize {
  return useContext(ContainerQueryContext) ?? '2xs';
}

/**
 * Whether the current element is inside a query container. This is useful for
 * components that can either establish their own container or use an existing
 * one to avoid introducing size containment into an intrinsic-size layout.
 */
export function useHasContainerQuery(): boolean {
  return useContext(ContainerQueryContext) !== null;
}

/**
 * The content-box inline size — the box CSS `@container` resolves against. We
 * avoid `clientWidth` (padding-box) so the JS breakpoint can't disagree with the
 * CSS reflow at boundaries on padded containers. `clientWidth` already excludes
 * the border and scrollbar (like `@container`), so subtracting padding yields
 * the content box.
 */
function getContentBoxInlineSize(element: Element): number {
  const style = window.getComputedStyle(element);
  const padding =
    (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  return Math.max(0, element.clientWidth - padding);
}

/**
 * Measures the given element, resolves its active breakpoint, and broadcasts it
 * through ContainerQueryContext. Rendered by container elements so descendants
 * can resolve container-mode responsive props in JS.
 */
export function ContainerQueryProvider({
  elementRef,
  children,
}: {
  children: ReactNode;
  elementRef: RefObject<Element | null>;
}) {
  const theme = useTheme();
  const [inlineSize, setInlineSize] = useState(0);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    // Read synchronously before paint so the first resolved breakpoint is right.
    setInlineSize(getContentBoxInlineSize(element));

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      // `contentBoxSize` is exactly the box CSS `@container` queries against;
      // fall back to a computed content box for engines without it.
      const size =
        entry.contentBoxSize?.[0]?.inlineSize ?? getContentBoxInlineSize(element);
      setInlineSize(size);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef]);

  // Resolve to the active breakpoint here (not the raw size) so the broadcast
  // context value only changes on a breakpoint boundary — descendants aren't
  // re-rendered on every pixel of a resize.
  const breakpoint = useMemo(() => {
    for (let i = BREAKPOINT_ORDER.length - 1; i >= 0; i--) {
      const bp = BREAKPOINT_ORDER[i];
      if (bp === undefined) {
        continue;
      }
      if (inlineSize >= parseInt(theme.breakpoints[bp], 10)) {
        return bp;
      }
    }
    return '2xs';
  }, [inlineSize, theme.breakpoints]);

  return <ContainerQueryContext value={breakpoint}>{children}</ContainerQueryContext>;
}
