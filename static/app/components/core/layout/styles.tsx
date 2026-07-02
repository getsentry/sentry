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
  // - bare keys (`xs`, `380px`, …) resolve against the nearest query container (@container)
  // - `screen:`-prefixed keys (`screen:md`, …) resolve against the viewport (@media)
  // Keys may be a named breakpoint or a raw `<number>px` escape hatch. We resolve
  // every declared key into a { minWidth, axis } slot, order them mobile-first
  // (smallest first), emit the smallest as the always-applied base declaration
  // (so it applies even with no query container present), and emit the rest as
  // min-width overrides on their respective axis.
  const slots: Array<{
    axis: (typeof RESPONSIVE_AXES)[number];
    declaration: string;
    minWidth: number;
    minWidthPx: string;
  }> = [];

  const pushSlot = (
    axis: (typeof RESPONSIVE_AXES)[number],
    minWidthPx: string,
    resolvedValue: string
  ) => {
    slots.push({
      axis,
      declaration: `${property}: ${resolvedValue};`,
      minWidth: parseFloat(minWidthPx),
      minWidthPx,
    });
  };

  // Named breakpoints, in scale order, on both axes.
  for (const breakpoint of BREAKPOINT_ORDER) {
    for (const axis of RESPONSIVE_AXES) {
      const key = axis === 'container' ? breakpoint : `screen:${breakpoint}`;
      const v = (value as Partial<Record<string, T>>)[key];
      const resolvedValue = resolver ? resolver(v, breakpoint, theme) : v;

      // A resolver can return undefined to indicate that the value should be omitted.
      if (resolvedValue === undefined) {
        continue;
      }

      pushSlot(axis, theme.breakpoints[breakpoint], resolvedValue as string);
    }
  }

  // `<number>px` escape-hatch keys (e.g. `380px`, `screen:380px`) the named
  // scale doesn't cover. The resolver receives an undefined breakpoint.
  for (const key of Object.keys(value)) {
    const axis = key.startsWith('screen:') ? 'viewport' : 'container';
    const raw = axis === 'viewport' ? key.slice('screen:'.length) : key;
    if (!raw.endsWith('px') || Number.isNaN(parseFloat(raw))) {
      continue;
    }

    const v = (value as Partial<Record<string, T>>)[key];
    const resolvedValue = resolver ? resolver(v, undefined, theme) : v;
    if (resolvedValue === undefined) {
      continue;
    }

    pushSlot(axis, raw, resolvedValue as string);
  }

  return (
    slots
      // Mobile-first order: smallest min-width first; container before viewport at an
      // equal threshold (matching the named-key iteration order). The first slot is
      // the always-applied base; the rest become min-width overrides.
      .toSorted(
        (a, b) =>
          a.minWidth - b.minWidth ||
          (a.axis === b.axis ? 0 : a.axis === 'container' ? -1 : 1)
      )
      .map((slot, index) => {
        if (index === 0) {
          return slot.declaration;
        }

        const atRule = slot.axis === 'container' ? '@container' : '@media';
        return `${atRule} (min-width: ${slot.minWidthPx}) {
          ${slot.declaration}
        }`;
      })
      .join('')
  );
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

/**
 * Prefer using padding or gap instead.
 * @deprecated
 */
export type Margin = SpaceSize | 'auto' | '0';

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
/**
 * Escape hatch for a one-off pixel threshold the named scale doesn't cover,
 * e.g. `"380px"`. Like named keys it resolves against the container by default
 * and the viewport with a `screen:` prefix (`"screen:380px"`). Prefer a named
 * breakpoint when one fits — reach for this only when a design genuinely needs a
 * width the scale lacks.
 */
type CustomBreakpoint = `${number}px`;
type ScreenCustomBreakpoint = `screen:${CustomBreakpoint}`;
type ResponsiveBreakpoint =
  | BreakpointSize
  | ScreenBreakpoint
  | CustomBreakpoint
  | ScreenCustomBreakpoint;

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
  const theme = useTheme();
  const viewportBreakpoint = useActiveBreakpoint();
  // No container ancestor → '2xs', the only value CSS applies in that case (the
  // plain base declaration), so JS and the @container rules stay in agreement.
  const containerSize = useContext(ContainerQueryContext);
  const containerBreakpoint =
    containerSize === null
      ? '2xs'
      : (resolveContainerBreakpoint(containerSize, theme.breakpoints) as BreakpointSize);

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
 * Holds the content-box inline-size (the box CSS `@container` resolves against)
 * of the nearest ancestor query container, or null when there is no container
 * ancestor. Provided by container elements (those with a `containerType`) so
 * that JS-resolved container queries (`useResponsivePropValue`,
 * `useContainerBreakpoint`) can resolve against the container's width.
 *
 * We broadcast the raw size rather than a pre-resolved breakpoint because the
 * container is generic and can't know which thresholds each descendant cares
 * about — each consumer resolves its own breakpoints off this one measurement.
 *
 * CSS-only responsive props don't need this — they resolve natively via
 * `@container` queries. This context exists purely for the JS resolution path.
 */
const ContainerQueryContext = createContext<number | null>(null);

/**
 * The JS equivalent of a CSS container query: resolves the active breakpoint of
 * the nearest ancestor query container (read from `ContainerQueryContext`),
 * mirroring the mobile-first behavior of `rc()`/`@container`. Must be called
 * inside a query container (a `Container`/`Flex`/… with `containerType`); with
 * no container ancestor it resolves as if the container were 0px wide (the base,
 * matching CSS's plain base declaration).
 *
 * Prefer CSS responsive props (bare breakpoint keys like `{xs: …}`) when
 * possible; reach for this hook only when you genuinely need the resolved
 * breakpoint in JS (e.g. to branch rendering). It replaces width-based
 * `useMedia` usage.
 *
 * By default it resolves against the theme's named breakpoints. Pass an explicit
 * list of tokens — named and/or `<number>px` escape hatches, e.g.
 * `['sm', 'md', '380px']` — for one-off thresholds the named scale lacks; the
 * hook then returns the active token from that list.
 *
 * This returns the active breakpoint *key* so you can branch on it. To resolve a
 * `Responsive<T>` prop to its current *value* in JS (when building a responsive
 * prop of your own), use {@link useResponsivePropValue} instead.
 */
export function useContainerBreakpoint(): BreakpointSize;
export function useContainerBreakpoint<
  const T extends ReadonlyArray<BreakpointSize | `${number}px`>,
>(tokens: T): T[number];
export function useContainerBreakpoint(tokens?: readonly string[]): string {
  const theme = useTheme();
  const inlineSize = useContext(ContainerQueryContext) ?? 0;

  return useMemo(() => {
    const thresholds: Record<string, string> = {};
    for (const token of tokens ?? BREAKPOINT_ORDER) {
      // A `<number>px` token is its own threshold; a named token maps through
      // the theme scale.
      thresholds[token] = token.endsWith('px')
        ? token
        : theme.breakpoints[token as BreakpointSize];
    }
    return resolveContainerBreakpoint(inlineSize, thresholds);
  }, [inlineSize, tokens, theme.breakpoints]);
}

/**
 * Observes an element's content-box inline size (the box CSS `@container`
 * resolves against), calling `onSize` immediately and on every resize. Returns
 * a disconnect function.
 */
function observeInlineSize(element: Element, onSize: (size: number) => void): () => void {
  // Measure synchronously on attach so the first resolved breakpoint is right.
  onSize(getContentBoxInlineSize(element));

  const observer = new ResizeObserver(entries => {
    const entry = entries[0];
    if (!entry) {
      return;
    }
    // `contentBoxSize` is exactly the box CSS `@container` queries against; fall
    // back to a computed content box for engines without it.
    onSize(entry.contentBoxSize?.[0]?.inlineSize ?? getContentBoxInlineSize(element));
  });
  observer.observe(element);
  return () => observer.disconnect();
}

/**
 * The largest breakpoint whose min-width threshold `inlineSize` satisfies,
 * falling back mobile-first to the smallest when it satisfies none.
 */
function resolveContainerBreakpoint(
  inlineSize: number,
  breakpoints: Record<string, string>
): string {
  let active: {label: string; px: number} | undefined;
  let smallest: {label: string; px: number} | undefined;

  for (const [label, value] of Object.entries(breakpoints)) {
    const px = parseFloat(value);
    if (Number.isNaN(px)) {
      continue;
    }
    if (smallest === undefined || px < smallest.px) {
      smallest = {label, px};
    }
    if (inlineSize >= px && (active === undefined || px > active.px)) {
      active = {label, px};
    }
  }

  return active?.label ?? smallest?.label ?? '2xs';
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
 * Measures the given element and broadcasts its content-box inline-size through
 * ContainerQueryContext. Rendered by container elements so descendants can
 * resolve container-mode responsive props in JS. Renders no DOM of its own.
 */
export function ContainerQueryProvider({
  elementRef,
  children,
}: {
  children: ReactNode;
  elementRef: RefObject<Element | null>;
}) {
  const [inlineSize, setInlineSize] = useState(0);

  // The observed element is rendered by the caller and passed in via `elementRef`
  // (e.g. a Container's own node or a Modal's portal), so it's attached before
  // this provider's layout effect runs — no callback ref needed here.
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return () => {};
    }
    return observeInlineSize(element, setInlineSize);
  }, [elementRef]);

  return <ContainerQueryContext value={inlineSize}>{children}</ContainerQueryContext>;
}
