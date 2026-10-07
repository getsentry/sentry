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
import {radius, space} from '@sentry/scraps/theme/constants.stylex';
import {background, border} from '@sentry/scraps/theme/tokens.stylex';

import {ContainerQueryProvider, type Responsive, type Shorthand} from './styles';
import {
  addLayoutProp,
  createLayoutStyle,
  finishLayoutStyle,
  type LayoutStyle,
} from './stylexLayout';

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
 * StyleX drops the `border*` shorthands, so a border variant is set as
 * width/style/color longhands: one static class each for plain values, and
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
  if (typeof value === 'string' && !acc.inline) {
    addLayoutProp(acc, `${side}Width`, value, {fixed: side});
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

/**
 * Adds the styles of every `Container` prop. `display` is passed separately
 * so `Flex` and `Grid` can default it without copying props.
 */
export function addContainerStyles(
  acc: LayoutStyle,
  p: ContainerLayoutProps,
  display: ContainerLayoutProps['display'] = p.display
): void {
  addLayoutProp(acc, 'containerType', p.containerType, {fixed: 'containerType'});

  addLayoutProp(acc, 'display', display, {fixed: 'display'});
  addLayoutProp(acc, 'position', p.position, {fixed: 'position'});

  addLayoutProp(acc, 'inset', p.inset, {fixed: 'inset'});
  addLayoutProp(acc, 'top', p.top, {fixed: 'top'});
  addLayoutProp(acc, 'bottom', p.bottom, {fixed: 'bottom'});
  addLayoutProp(acc, 'left', p.left, {fixed: 'left'});
  addLayoutProp(acc, 'right', p.right, {fixed: 'right'});

  addLayoutProp(acc, 'overflow', p.overflow, {fixed: 'overflow'});
  addLayoutProp(acc, 'overflowX', p.overflowX, {fixed: 'overflowX'});
  addLayoutProp(acc, 'overflowY', p.overflowY, {fixed: 'overflowY'});

  addLayoutProp(acc, 'overscrollBehavior', p.overscrollBehavior);

  addLayoutProp(acc, 'pointerEvents', p.pointerEvents, {fixed: 'pointerEvents'});

  addLayoutProp(acc, 'cursor', p.cursor, {fixed: 'cursor'});
  addLayoutProp(acc, 'contain', p.contain);

  addLayoutProp(acc, 'padding', p.padding, {fixed: 'padding', resolve: resolveSpacing});
  addLayoutProp(acc, 'paddingTop', p.paddingTop, {
    fixed: 'paddingTop',
    resolve: resolveSpace,
  });
  addLayoutProp(acc, 'paddingBottom', p.paddingBottom, {
    fixed: 'paddingBottom',
    resolve: resolveSpace,
  });
  addLayoutProp(acc, 'paddingLeft', p.paddingLeft, {
    fixed: 'paddingLeft',
    resolve: resolveSpace,
  });
  addLayoutProp(acc, 'paddingRight', p.paddingRight, {
    fixed: 'paddingRight',
    resolve: resolveSpace,
  });

  addLayoutProp(acc, 'margin', p.margin, {fixed: 'margin', resolve: resolveMargin});
  addLayoutProp(acc, 'marginTop', p.marginTop, {
    fixed: 'marginTop',
    resolve: resolveMarginSize,
  });
  addLayoutProp(acc, 'marginBottom', p.marginBottom, {
    fixed: 'marginBottom',
    resolve: resolveMarginSize,
  });
  addLayoutProp(acc, 'marginLeft', p.marginLeft, {
    fixed: 'marginLeft',
    resolve: resolveMarginSize,
  });
  addLayoutProp(acc, 'marginRight', p.marginRight, {
    fixed: 'marginRight',
    resolve: resolveMarginSize,
  });

  addLayoutProp(acc, 'backgroundColor', p.background, {
    fixed: 'background',
    resolve: resolveBackground,
  });

  addLayoutProp(acc, 'borderRadius', p.radius, {fixed: 'radius', resolve: resolveRadius});

  addLayoutProp(acc, 'width', p.width, {fixed: 'width'});
  addLayoutProp(acc, 'minWidth', p.minWidth, {fixed: 'minWidth'});
  addLayoutProp(acc, 'maxWidth', p.maxWidth, {fixed: 'maxWidth'});

  addLayoutProp(acc, 'height', p.height, {fixed: 'height'});
  addLayoutProp(acc, 'minHeight', p.minHeight, {fixed: 'minHeight'});
  addLayoutProp(acc, 'maxHeight', p.maxHeight, {fixed: 'maxHeight'});

  addLayoutProp(acc, 'gridArea', p.area);
  addLayoutProp(acc, 'gridRow', p.row);
  addLayoutProp(acc, 'gridColumn', p.column);

  addLayoutProp(acc, 'order', p.order);
  addLayoutProp(acc, 'flex', p.flex, {fixed: 'flex'});
  addLayoutProp(acc, 'flexGrow', p.flexGrow, {fixed: 'flexGrow'});
  addLayoutProp(acc, 'flexShrink', p.flexShrink, {fixed: 'flexShrink'});
  addLayoutProp(acc, 'flexBasis', p.flexBasis);

  addLayoutProp(acc, 'alignSelf', p.alignSelf, {fixed: 'alignSelf'});
  addLayoutProp(acc, 'justifySelf', p.justifySelf, {fixed: 'justifySelf'});

  addBorder(acc, 'border', p.border);
  addBorder(acc, 'borderTop', p.borderTop);
  addBorder(acc, 'borderBottom', p.borderBottom);
  addBorder(acc, 'borderLeft', p.borderLeft);
  addBorder(acc, 'borderRight', p.borderRight);

  addLayoutProp(acc, 'visibility', p.visibility, {fixed: 'visibility'});
  addLayoutProp(acc, 'whiteSpace', p.whiteSpace, {fixed: 'whiteSpace'});
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
