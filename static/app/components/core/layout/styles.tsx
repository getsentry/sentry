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
  ContainerBreakpointSize,
  RadiusSize,
  SpaceSize,
  Theme,
} from 'sentry/utils/theme';

// A responsive prop resolves against two independent axes with their own scales:
// - the container axis (bare keys like `md`) → `@container`, `theme.containers`
// - the viewport axis (`screen:`-prefixed keys) → `@media`, `theme.breakpoints`
// The breakpoint passed to a resolver can come from either scale.
type ResponsiveBreakpoint = BreakpointSize | ContainerBreakpointSize;

// It is unfortunate, but Emotion seems to use the fn callback name in the classname, so lets keep it short.
export function rc<T>(
  property: string,
  value: Responsive<T> | undefined,
  theme: Theme,
  // Optional resolver function to transform the value before it is applied to the CSS property.
  resolver?: (
    value: T | undefined,
    breakpoint: ResponsiveBreakpoint | undefined,
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

  const emit = (axisConfig: {
    atRule: '@container' | '@media';
    order: readonly ResponsiveBreakpoint[];
    prefix: '' | 'screen:';
    sizes: Record<string, string>;
  }) => {
    const {order, prefix, sizes, atRule} = axisConfig;
    for (const breakpoint of order) {
      const key = `${prefix}${breakpoint}`;
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

      declarations.push(
        `${atRule} (min-width: ${sizes[breakpoint]}) {
          ${property}: ${resolvedValue as string};
        }`
      );
    }
  };

  emit({
    atRule: '@container',
    order: CONTAINER_ORDER,
    prefix: '',
    sizes: theme.containers,
  });
  emit({
    atRule: '@media',
    order: VIEWPORT_ORDER,
    prefix: 'screen:',
    sizes: theme.breakpoints,
  });

  return declarations.join('');
}

// The container query scale (bare keys) — resolved against `theme.containers`.
const CONTAINER_ORDER: readonly ContainerBreakpointSize[] = [
  'zero',
  '3xs',
  '2xs',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
];

// The viewport scale (`screen:`-prefixed keys) — resolved against `theme.breakpoints`.
const VIEWPORT_ORDER: readonly BreakpointSize[] = [
  '2xs',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
];

type Margin = SpaceSize | 'auto' | '0';

// @TODO(jonasbadalic): audit for memory usage and linting performance issues.
// These may not be trivial to infer as we are dealing with n^4 complexity
export type Shorthand<T extends string, N extends 4 | 2> = N extends 4
  ? `${T} ${T} ${T} ${T}` | `${T} ${T} ${T}` | `${T} ${T}` | `${T}`
  : N extends 2
    ? `${T} ${T}` | `${T}`
    : never;

/**
 * Responsive prop keys come in two flavors, drawn from two independent scales,
 * and may be combined on one prop:
 * - bare keys (`zero`, `md`, ...) resolve against the nearest query container
 *   (`@container`, `theme.containers`). Container queries are the default, so
 *   they take no prefix.
 * - `screen:`-prefixed keys (`screen:md`, ...) resolve against the viewport
 *   (`@media`, `theme.breakpoints`).
 *
 * e.g. `direction={{zero: 'column', 'screen:lg': 'row'}}` is column until its
 * container reaches the next breakpoint, then a row once the viewport reaches
 * `lg`.
 */
type ScreenBreakpoint = `screen:${BreakpointSize}`;
type ResponsiveKey = ContainerBreakpointSize | ScreenBreakpoint;

export type Responsive<T> = T | Partial<Record<ResponsiveKey, T>>;

function isResponsive(prop: unknown): prop is Partial<Record<ResponsiveKey, any>> {
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
  _breakpoint: ResponsiveBreakpoint | undefined,
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
  _breakpoint: ResponsiveBreakpoint | undefined,
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
  _breakpoint: ResponsiveBreakpoint | undefined,
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
  _breakpoint: ResponsiveBreakpoint | undefined,
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
  // No container ancestor → 'zero', the only value CSS applies in that case (the
  // plain base declaration), so JS and the @container rules stay in agreement.
  const containerBreakpoint = useContext(ContainerQueryContext) ?? 'zero';

  // Only resolve the active breakpoint if the prop is responsive, else ignore it.
  if (!isResponsive(prop)) {
    return prop;
  }

  if (Object.keys(prop).length === 0) {
    throw new Error('Responsive prop must contain at least one breakpoint');
  }

  // Walk the same mobile-first cascade rc() emits — container axis first, then
  // viewport axis on top — and keep the value of the last rule whose condition is
  // currently satisfied. Bare keys are matched against the nearest container's
  // breakpoint (`theme.containers` scale), `screen:` keys against the viewport
  // (`theme.breakpoints` scale). Whichever axis is emitted later wins a tie.
  const containerIndex = CONTAINER_ORDER.indexOf(containerBreakpoint);
  const viewportIndex = VIEWPORT_ORDER.indexOf(viewportBreakpoint);

  let resolved: ResponsiveValue<T> | undefined;
  let first = true;

  const cascade = (
    axis: 'container' | 'viewport',
    order: readonly ResponsiveBreakpoint[],
    activeIndex: number
  ) => {
    for (let i = 0; i < order.length; i++) {
      const breakpoint = order[i];
      if (breakpoint === undefined) {
        continue;
      }
      const key = axis === 'container' ? breakpoint : `screen:${breakpoint}`;
      const value = (prop as Partial<Record<string, ResponsiveValue<T>>>)[key];
      if (value === undefined) {
        continue;
      }

      // The first defined breakpoint is the always-applied base; later ones only
      // apply once their axis is at least that wide.
      if (first || activeIndex >= i) {
        resolved = value;
      }
      first = false;
    }
  };

  cascade('container', CONTAINER_ORDER, containerIndex);
  cascade('viewport', VIEWPORT_ORDER, viewportIndex);

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
    for (let i = VIEWPORT_ORDER.length - 1; i >= 0; i--) {
      const bp = VIEWPORT_ORDER[i];

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
const ContainerQueryContext = createContext<ContainerBreakpointSize | null>(null);

/**
 * The JS equivalent of a CSS container query: returns the active breakpoint of
 * the nearest ancestor query container (read from `ContainerQueryContext`),
 * mirroring the mobile-first behavior of `rc()`/`@container`. Must be called
 * inside a query container (a `Container`/`Flex`/… with `containerType`); with
 * no container ancestor it resolves to `zero` (the base, matching CSS's plain
 * base declaration).
 *
 * The returned key is on the container scale (`theme.containers`: `zero`, `3xs`,
 * …, `5xl`) — distinct from the viewport scale used by `useActiveBreakpoint`.
 *
 * Prefer CSS responsive props (bare breakpoint keys like `{md: …}`) when
 * possible; reach for this hook only when you genuinely need the resolved
 * breakpoint in JS (e.g. to branch rendering). It replaces width-based
 * `useMedia` usage.
 *
 * Returns the active breakpoint *key* so you can branch on it. To resolve a
 * `Responsive<T>` prop to its current *value* in JS (when building a responsive
 * prop of your own), use {@link useResponsivePropValue} instead.
 * @public
 */
export function useContainerBreakpoint(): ContainerBreakpointSize {
  return useContext(ContainerQueryContext) ?? 'zero';
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
    for (let i = CONTAINER_ORDER.length - 1; i >= 0; i--) {
      const bp = CONTAINER_ORDER[i];
      if (bp === undefined) {
        continue;
      }
      if (inlineSize >= parseInt(theme.containers[bp], 10)) {
        return bp;
      }
    }
    return 'zero';
  }, [inlineSize, theme.containers]);

  return <ContainerQueryContext value={breakpoint}>{children}</ContainerQueryContext>;
}
