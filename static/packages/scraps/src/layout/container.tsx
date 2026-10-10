import React, {useMemo, useRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {mergeRefs} from '@react-aria/utils';

import type {CSS} from '@sentry/scraps/cssTypes';
import type {
  BorderVariant,
  RadiusSize,
  SpaceSize,
  SurfaceVariant,
} from '@sentry/scraps/theme';
import {radius, space} from '@sentry/scraps/theme/constants.linaria';
import {background, border} from '@sentry/scraps/theme/tokens.linaria';

import type {LayoutProperty} from './generatedStyles';
import {
  addLayoutProp,
  createLayoutStyle,
  finishLayoutStyle,
  type LayoutPropOptions,
  type LayoutStyle,
} from './linariaLayout';
import {ContainerQueryProvider, type Responsive, type Shorthand} from './styles';

type Margin = SpaceSize | 'auto' | '0';

/* eslint-disable @sentry/sort-interface-keys */
export interface ContainerLayoutProps {
  background?: Responsive<Exclude<SurfaceVariant, 'overlay'>>;
  display?: Responsive<CSS['display']>;

  padding?: Responsive<Shorthand<SpaceSize, 4>>;
  paddingTop?: Responsive<SpaceSize>;
  paddingBottom?: Responsive<SpaceSize>;
  paddingLeft?: Responsive<SpaceSize>;
  paddingRight?: Responsive<SpaceSize>;

  position?: Responsive<CSS['position']>;

  inset?: Responsive<CSS['inset']>;
  top?: Responsive<CSS['inset']>;
  bottom?: Responsive<CSS['inset']>;
  left?: Responsive<CSS['inset']>;
  right?: Responsive<CSS['inset']>;

  overflow?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;
  overflowX?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;
  overflowY?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;

  overscrollBehavior?: Responsive<'contain' | 'auto' | 'none'>;

  pointerEvents?: Responsive<CSS['pointerEvents']>;

  cursor?: Responsive<CSS['cursor']>;

  contain?: Responsive<CSS['contain']>;

  /**
   * Declares this element as a query container, so descendants' container
   * responsive props (bare breakpoint keys like `{xs: …}`) resolve against its
   * size. Maps to the CSS `container-type`.
   *
   * Prefer `inline-size`: it only contains the inline (width) axis, so height
   * still flows from content. `size` additionally contains the block axis, so
   * the element must get its height from elsewhere or its content collapses —
   * only reach for it when you genuinely need height-based queries. `normal`
   * (the default) means the element is not a size query container, so
   * descendants resolve against the next container up — equivalent to omitting
   * the prop.
   */
  containerType?: 'inline-size' | 'size' | 'normal';

  radius?: Responsive<Shorthand<RadiusSize, 4>>;

  width?: Responsive<CSS['width']>;
  minWidth?: Responsive<CSS['minWidth']>;
  maxWidth?: Responsive<CSS['maxWidth']>;

  height?: Responsive<CSS['height']>;
  minHeight?: Responsive<CSS['minHeight']>;
  maxHeight?: Responsive<CSS['maxHeight']>;

  border?: Responsive<BorderVariant>;
  borderTop?: Responsive<BorderVariant>;
  borderBottom?: Responsive<BorderVariant>;
  borderLeft?: Responsive<BorderVariant>;
  borderRight?: Responsive<BorderVariant>;

  // Grid Item Properties
  area?: Responsive<CSS['gridArea']>;
  row?: Responsive<CSS['gridRow']>;
  column?: Responsive<CSS['gridColumn']>;

  // Flex Item Properties
  order?: Responsive<CSS['order']>;
  flex?: Responsive<CSS['flex']>;
  flexGrow?: Responsive<CSS['flexGrow']>;
  flexShrink?: Responsive<CSS['flexShrink']>;
  flexBasis?: Responsive<CSS['flexBasis']>;
  alignSelf?: Responsive<CSS['alignSelf']>;
  justifySelf?: Responsive<CSS['justifySelf']>;

  visibility?: Responsive<'visible' | 'hidden' | 'collapse'>;

  // Text Wrapping
  whiteSpace?: Responsive<
    'break-spaces' | 'normal' | 'nowrap' | 'pre' | 'pre-line' | 'pre-wrap'
  >;

  /**
   * @deprecated Use the `gap` prop on `Flex` or `Grid` instead.
   */
  margin?: Responsive<Shorthand<Margin, 4>>;
  /**
   * @deprecated Use the `gap` prop on `Flex` or `Grid` instead.
   */
  marginTop?: Responsive<Margin>;
  /**
   * @deprecated Use the `gap` prop on `Flex` or `Grid` instead.
   */
  marginBottom?: Responsive<Margin>;
  /**
   * @deprecated Use the `gap` prop on `Flex` or `Grid` instead.
   */
  marginLeft?: Responsive<Margin>;
  /**
   * @deprecated Use the `gap` prop on `Flex` or `Grid` instead.
   */
  marginRight?: Responsive<Margin>;
}

/* eslint-enable @sentry/sort-interface-keys */
export type ContainerElement =
  | 'article'
  | 'aside'
  | 'blockquote'
  | 'div'
  | 'dl'
  | 'fieldset'
  | 'figure'
  | 'footer'
  | 'header'
  | 'label'
  | 'li'
  | 'main'
  | 'nav'
  | 'ol'
  | 'section'
  | 'span'
  | 'summary'
  | 'td'
  | 'th'
  | 'ul'
  | 'hr';

export type ContainerProps<T extends ContainerElement = 'div'> = ContainerLayoutProps & {
  as?: T;
  children?: React.ReactNode;
  htmlFor?: T extends 'label' ? string : never;
  ref?: React.Ref<HTMLElementTagNameMap[T] | null>;
  /**
   * Deprecated in favor of the Container component API.
   * If you have an is an unsupported use-case, please contact design engineering for support.
   * @deprecated
   */
  style?: React.CSSProperties;
} & Omit<
    React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElementTagNameMap[T]>,
      HTMLElementTagNameMap[T]
    >,
    'style'
  >;

export type ContainerPropsWithRenderFunction<T extends ContainerElement = 'div'> = Omit<
  ContainerLayoutProps,
  'containerType'
> & {
  children: (props: {
    className: string;
    style?: React.CSSProperties;
  }) => React.ReactNode | undefined;
  as?: never;
  /**
   * Declaring a query container is not supported with the render-prop form: the
   * styled component must own the DOM node to observe it for JS resolution,
   * which the render prop hands to the caller. Use the standard children form.
   */
  containerType?: never;
  htmlFor?: never;
  ref?: never;
} & Partial<
    Record<
      // HTMLAttributes extends from DOMAttributes which types children as React.ReactNode | undefined.
      // Therefore, we need to exclude it from the map, or the children will produce a never type.
      Exclude<
        keyof React.DetailedHTMLProps<
          React.HTMLAttributes<HTMLElementTagNameMap[T]>,
          HTMLElementTagNameMap[T]
        >,
        'children'
      >,
      never
    >
  >;

export const omitContainerProps = new Set<keyof ContainerLayoutProps | 'as'>([
  'alignSelf',
  'area',
  'as',
  'background',
  'border',
  'borderTop',
  'borderBottom',
  'borderLeft',
  'borderRight',
  'bottom',
  'column',
  'contain',
  'cursor',
  'display',
  'flex',
  'flexBasis',
  'flexGrow',
  'flexShrink',
  'height',
  'inset',
  'justifySelf',
  'left',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'maxHeight',
  'maxWidth',
  'minHeight',
  'minWidth',
  'order',
  'overflow',
  'overflowX',
  'overflowY',
  'overscrollBehavior',
  'pointerEvents',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'position',
  'radius',
  'right',
  'row',
  'top',
  'visibility',
  'width',
  'whiteSpace',
]);

const OMIT_CONTAINER_PROPS: ReadonlySet<string> = omitContainerProps;

function resolveSpace(size: SpaceSize): string {
  return space[size] ?? space['0'];
}

/** `"md lg"` → `"8px 12px"`, like `getSpacing` but without the Emotion theme. */
export function resolveSpacing(spacing: Shorthand<SpaceSize, 4>): string {
  return spacing.length < 3
    ? resolveSpace(spacing as SpaceSize)
    : spacing
        .split(' ')
        .map(size => resolveSpace(size as SpaceSize))
        .join(' ');
}

function resolveMarginSize(size: Margin): string {
  return size === 'auto' || size === '0' ? size : resolveSpace(size);
}

function resolveMargin(margin: Shorthand<Margin, 4>): string {
  return margin.length < 3
    ? resolveMarginSize(margin as Margin)
    : margin
        .split(' ')
        .map(size => resolveMarginSize(size as Margin))
        .join(' ');
}

function resolveRadius(value: Shorthand<RadiusSize, 4>): string {
  return value
    .split(' ')
    .map(size => radius[size as RadiusSize])
    .join(' ');
}

function borderColor(key: Exclude<BorderVariant, 'none'>): string {
  switch (key) {
    case 'primary':
      return border.primary;
    case 'muted':
    case 'secondary':
      return border.secondary;
    default:
      return border[`${key}Vibrant`];
  }
}

type BorderSide = 'border' | 'borderTop' | 'borderBottom' | 'borderLeft' | 'borderRight';

/**
 * Keep the border longhands from the StyleX comparison: one static class
 * per variant for plain values, and
 * per-breakpoint variables for responsive ones.
 */
function addBorder(
  acc: LayoutStyle,
  side: BorderSide,
  value: Responsive<BorderVariant> | undefined
): void {
  if (value === undefined) {
    return;
  }
  if (typeof value === 'string') {
    if (acc.inline) {
      acc.style = {
        ...acc.style,
        [`${side}Width`]: value === 'none' ? '0' : '1px',
        [`${side}Style`]: value === 'none' ? 'none' : 'solid',
        ...(value === 'none' ? {} : {[`${side}Color`]: borderColor(value)}),
      };
    }
    addLayoutProp(acc, `${side}Width`, value, {fixed: side, noInline: true});
    return;
  }
  addLayoutProp(acc, `${side}Width`, value, {resolve: v => (v === 'none' ? '0' : '1px')});
  addLayoutProp(acc, `${side}Style`, value, {
    resolve: v => (v === 'none' ? 'none' : 'solid'),
  });
  addLayoutProp(acc, `${side}Color`, value, {
    resolve: v => (v === 'none' ? undefined : borderColor(v)),
  });
}

export function resolveBackground(value: SurfaceVariant | 'overlay'): string {
  return background[value];
}

type PropHandler = (acc: LayoutStyle, value: unknown) => void;

function layoutProp<T>(
  property: LayoutProperty,
  options?: LayoutPropOptions<T>
): PropHandler {
  return (acc, value) => addLayoutProp(acc, property, value as Responsive<T>, options);
}

function borderProp(side: BorderSide): PropHandler {
  return (acc, value) => addBorder(acc, side, value as Responsive<BorderVariant>);
}

/**
 * One handler per `Container` prop (except `display`), built once so a render
 * only visits the props that were passed.
 */
const CONTAINER_PROP_HANDLERS: Record<string, PropHandler | undefined> = {
  containerType: layoutProp('containerType', {fixed: 'containerType'}),
  position: layoutProp('position', {fixed: 'position'}),

  inset: layoutProp('inset', {fixed: 'inset'}),
  top: layoutProp('top', {fixed: 'top'}),
  bottom: layoutProp('bottom', {fixed: 'bottom'}),
  left: layoutProp('left', {fixed: 'left'}),
  right: layoutProp('right', {fixed: 'right'}),

  overflow: layoutProp('overflow', {fixed: 'overflow'}),
  overflowX: layoutProp('overflowX', {fixed: 'overflowX'}),
  overflowY: layoutProp('overflowY', {fixed: 'overflowY'}),
  overscrollBehavior: layoutProp('overscrollBehavior'),
  pointerEvents: layoutProp('pointerEvents', {fixed: 'pointerEvents'}),
  cursor: layoutProp('cursor', {fixed: 'cursor'}),
  contain: layoutProp('contain'),

  padding: layoutProp('padding', {fixed: 'padding', resolve: resolveSpacing}),
  paddingTop: layoutProp('paddingTop', {fixed: 'paddingTop', resolve: resolveSpace}),
  paddingBottom: layoutProp('paddingBottom', {
    fixed: 'paddingBottom',
    resolve: resolveSpace,
  }),
  paddingLeft: layoutProp('paddingLeft', {fixed: 'paddingLeft', resolve: resolveSpace}),
  paddingRight: layoutProp('paddingRight', {
    fixed: 'paddingRight',
    resolve: resolveSpace,
  }),

  margin: layoutProp('margin', {fixed: 'margin', resolve: resolveMargin}),
  marginTop: layoutProp('marginTop', {fixed: 'marginTop', resolve: resolveMarginSize}),
  marginBottom: layoutProp('marginBottom', {
    fixed: 'marginBottom',
    resolve: resolveMarginSize,
  }),
  marginLeft: layoutProp('marginLeft', {fixed: 'marginLeft', resolve: resolveMarginSize}),
  marginRight: layoutProp('marginRight', {
    fixed: 'marginRight',
    resolve: resolveMarginSize,
  }),

  background: layoutProp('backgroundColor', {
    fixed: 'background',
    resolve: resolveBackground,
  }),
  radius: layoutProp('borderRadius', {fixed: 'radius', resolve: resolveRadius}),

  width: layoutProp('width', {fixed: 'width'}),
  minWidth: layoutProp('minWidth', {fixed: 'minWidth'}),
  maxWidth: layoutProp('maxWidth', {fixed: 'maxWidth'}),
  height: layoutProp('height', {fixed: 'height'}),
  minHeight: layoutProp('minHeight', {fixed: 'minHeight'}),
  maxHeight: layoutProp('maxHeight', {fixed: 'maxHeight'}),

  area: layoutProp('gridArea'),
  row: layoutProp('gridRow'),
  column: layoutProp('gridColumn'),

  order: layoutProp('order'),
  flex: layoutProp('flex', {fixed: 'flex'}),
  flexGrow: layoutProp('flexGrow', {fixed: 'flexGrow'}),
  flexShrink: layoutProp('flexShrink', {fixed: 'flexShrink'}),
  flexBasis: layoutProp('flexBasis'),
  alignSelf: layoutProp('alignSelf', {fixed: 'alignSelf'}),
  justifySelf: layoutProp('justifySelf', {fixed: 'justifySelf'}),

  border: borderProp('border'),
  borderTop: borderProp('borderTop'),
  borderBottom: borderProp('borderBottom'),
  borderLeft: borderProp('borderLeft'),
  borderRight: borderProp('borderRight'),

  visibility: layoutProp('visibility', {fixed: 'visibility'}),
  whiteSpace: layoutProp('whiteSpace', {fixed: 'whiteSpace'}),
};

const DISPLAY_OPTIONS = {fixed: 'display'};

/**
 * Adds the styles of every `Container` prop that was passed. `display` is
 * passed separately so `Flex` and `Grid` can default it without copying props.
 */
export function addContainerStyles(
  acc: LayoutStyle,
  p: ContainerLayoutProps,
  display: ContainerLayoutProps['display'] = p.display
): void {
  addLayoutProp(acc, 'display', display, DISPLAY_OPTIONS);
  for (const key in p) {
    const handler = CONTAINER_PROP_HANDLERS[key];
    if (handler !== undefined) {
      handler(acc, (p as Record<string, unknown>)[key]);
    }
  }
}

/**
 * Renders the element of a layout primitive with its computed styles. Props in
 * `omitProps` and anything that is not a valid DOM attribute are dropped,
 * matching the `shouldForwardProp` the Emotion version used.
 */
interface LayoutElementProps {
  as?: React.ElementType;
  children?: unknown;
  className?: string;
  containerType?: string;
  ref?: React.Ref<any>;
  style?: React.CSSProperties;
}

export function useLayoutElement(
  props: LayoutElementProps,
  acc: LayoutStyle,
  omitProps: ReadonlySet<string>,
  defaultElement: React.ElementType = 'div'
): React.ReactNode {
  // Hooks must run unconditionally, before the render-prop early return.
  const containerRef = useRef<HTMLElement>(null);
  const {as, containerType, ref, className, style, children} = props;

  // A query container needs its size observed in JS so descendants can resolve
  // container-mode responsive props (e.g. Stack orientation). We only attach a
  // ref + observer when this element is actually a container, keeping the
  // common (non-container) path free of any ResizeObserver overhead.
  const isContainer = !!containerType && containerType !== 'normal';

  const containerRefs = useMemo(
    // Passes the ref objects along; nothing reads `.current` during render.
    // oxlint-disable-next-line react/refs
    () => (isContainer ? mergeRefs(ref, containerRef) : ref),
    [isContainer, ref]
  );

  const merged = finishLayoutStyle(acc, className, style);

  if (typeof children === 'function') {
    // When using render prop, only pass the styling to the child function
    return (children as (styleProps: typeof merged) => React.ReactNode)(merged);
  }

  const domProps: Record<string, unknown> = {};
  for (const key in props) {
    if (
      key === 'as' ||
      key === 'className' ||
      key === 'containerType' ||
      key === 'ref' ||
      key === 'style' ||
      omitProps.has(key) ||
      !isPropValid(key)
    ) {
      continue;
    }
    domProps[key] = (props as Record<string, unknown>)[key];
  }

  const Component = as ?? defaultElement;
  const node = (
    <Component
      {...domProps}
      className={merged.className}
      style={merged.style}
      ref={containerRefs}
    />
  );

  if (isContainer) {
    return (
      <ContainerQueryProvider elementRef={containerRef}>{node}</ContainerQueryProvider>
    );
  }

  return node;
}

function ContainerComponent<T extends ContainerElement = 'div'>(
  props: ContainerProps<T> | ContainerPropsWithRenderFunction<T>
) {
  const acc = createLayoutStyle(typeof props.children === 'function');
  addContainerStyles(acc, props);
  return useLayoutElement(props, acc, OMIT_CONTAINER_PROPS);
}

export const Container = ContainerComponent as <T extends ContainerElement = 'div'>(
  props: ContainerProps<T> | ContainerPropsWithRenderFunction<T>
) => React.ReactElement;
