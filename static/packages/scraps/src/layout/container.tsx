import React, {useMemo, useRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {mergeRefs} from '@react-aria/utils';
import {styled} from '@yak/react';

import type {CSS} from '@sentry/scraps/cssTypes';
import type {
  BorderVariant,
  RadiusSize,
  SpaceSize,
  SurfaceVariant,
} from '@sentry/scraps/theme';

import {
  ContainerQueryProvider,
  getBorder,
  getMargin,
  getRadius,
  getSpacing,
  type Responsive,
  type Shorthand,
} from './styles';
import {
  addLayoutProp,
  finishLayoutStyle,
  useLayoutStyle,
  type LayoutStyle,
} from './yakLayout';
import {layoutCss} from './yakStyles.yak';

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

const handlers: {
  [K in keyof ContainerLayoutProps]?: (
    acc: LayoutStyle,
    value: ContainerLayoutProps[K]
  ) => void;
} = {
  containerType: (acc, value) => addLayoutProp(acc, 'containerType', value),
  alignSelf: (acc, value) => addLayoutProp(acc, 'alignSelf', value),
  area: (acc, value) => addLayoutProp(acc, 'gridArea', value),
  background: (acc, value) =>
    addLayoutProp(
      acc,
      'background',
      value,
      (v, theme) => theme.tokens.background[v as Exclude<SurfaceVariant, 'overlay'>]
    ),
  border: (acc, value) =>
    addLayoutProp(acc, 'border', value, (v, theme) => getBorder(v, undefined, theme)),
  borderTop: (acc, value) =>
    addLayoutProp(acc, 'borderTop', value, (v, theme) => getBorder(v, undefined, theme)),
  borderBottom: (acc, value) =>
    addLayoutProp(acc, 'borderBottom', value, (v, theme) =>
      getBorder(v, undefined, theme)
    ),
  borderLeft: (acc, value) =>
    addLayoutProp(acc, 'borderLeft', value, (v, theme) => getBorder(v, undefined, theme)),
  borderRight: (acc, value) =>
    addLayoutProp(acc, 'borderRight', value, (v, theme) =>
      getBorder(v, undefined, theme)
    ),
  bottom: (acc, value) => addLayoutProp(acc, 'bottom', value),
  column: (acc, value) => addLayoutProp(acc, 'gridColumn', value),
  contain: (acc, value) => addLayoutProp(acc, 'contain', value),
  cursor: (acc, value) => addLayoutProp(acc, 'cursor', value),
  display: (acc, value) => addLayoutProp(acc, 'display', value),
  flex: (acc, value) => addLayoutProp(acc, 'flex', value),
  flexBasis: (acc, value) => addLayoutProp(acc, 'flexBasis', value),
  flexGrow: (acc, value) => addLayoutProp(acc, 'flexGrow', value),
  flexShrink: (acc, value) => addLayoutProp(acc, 'flexShrink', value),
  height: (acc, value) => addLayoutProp(acc, 'height', value),
  inset: (acc, value) => addLayoutProp(acc, 'inset', value),
  justifySelf: (acc, value) => addLayoutProp(acc, 'justifySelf', value),
  left: (acc, value) => addLayoutProp(acc, 'left', value),
  margin: (acc, value) =>
    addLayoutProp(acc, 'margin', value, (v, theme) => getMargin(v, undefined, theme)),
  marginTop: (acc, value) =>
    addLayoutProp(acc, 'marginTop', value, (v, theme) => getMargin(v, undefined, theme)),
  marginBottom: (acc, value) =>
    addLayoutProp(acc, 'marginBottom', value, (v, theme) =>
      getMargin(v, undefined, theme)
    ),
  marginLeft: (acc, value) =>
    addLayoutProp(acc, 'marginLeft', value, (v, theme) => getMargin(v, undefined, theme)),
  marginRight: (acc, value) =>
    addLayoutProp(acc, 'marginRight', value, (v, theme) =>
      getMargin(v, undefined, theme)
    ),
  maxHeight: (acc, value) => addLayoutProp(acc, 'maxHeight', value),
  maxWidth: (acc, value) => addLayoutProp(acc, 'maxWidth', value),
  minHeight: (acc, value) => addLayoutProp(acc, 'minHeight', value),
  minWidth: (acc, value) => addLayoutProp(acc, 'minWidth', value),
  order: (acc, value) => addLayoutProp(acc, 'order', value),
  overflow: (acc, value) => addLayoutProp(acc, 'overflow', value),
  overflowX: (acc, value) => addLayoutProp(acc, 'overflowX', value),
  overflowY: (acc, value) => addLayoutProp(acc, 'overflowY', value),
  overscrollBehavior: (acc, value) => addLayoutProp(acc, 'overscrollBehavior', value),
  pointerEvents: (acc, value) => addLayoutProp(acc, 'pointerEvents', value),
  padding: (acc, value) =>
    addLayoutProp(acc, 'padding', value, (v, theme) => getSpacing(v, undefined, theme)),
  paddingTop: (acc, value) =>
    addLayoutProp(acc, 'paddingTop', value, (v, theme) =>
      getSpacing(v, undefined, theme)
    ),
  paddingBottom: (acc, value) =>
    addLayoutProp(acc, 'paddingBottom', value, (v, theme) =>
      getSpacing(v, undefined, theme)
    ),
  paddingLeft: (acc, value) =>
    addLayoutProp(acc, 'paddingLeft', value, (v, theme) =>
      getSpacing(v, undefined, theme)
    ),
  paddingRight: (acc, value) =>
    addLayoutProp(acc, 'paddingRight', value, (v, theme) =>
      getSpacing(v, undefined, theme)
    ),
  position: (acc, value) => addLayoutProp(acc, 'position', value),
  radius: (acc, value) =>
    addLayoutProp(acc, 'borderRadius', value, (v, theme) =>
      getRadius(v, undefined, theme)
    ),
  right: (acc, value) => addLayoutProp(acc, 'right', value),
  row: (acc, value) => addLayoutProp(acc, 'gridRow', value),
  top: (acc, value) => addLayoutProp(acc, 'top', value),
  visibility: (acc, value) => addLayoutProp(acc, 'visibility', value),
  width: (acc, value) => addLayoutProp(acc, 'width', value),
  whiteSpace: (acc, value) => addLayoutProp(acc, 'whiteSpace', value),
};
export function addContainerStyles(
  acc: LayoutStyle,
  props: ContainerLayoutProps,
  display = props.display
) {
  addLayoutProp(acc, 'display', display);
  for (const key in props) {
    if (key !== 'display') {
      const handler = handlers[key as keyof ContainerLayoutProps] as
        | ((acc: LayoutStyle, value: unknown) => void)
        | undefined;
      handler?.(acc, (props as Record<string, unknown>)[key]);
    }
  }
}
interface LayoutElementProps {
  elementProps: Omit<React.HTMLAttributes<HTMLElement>, 'children'> & {
    as?: React.ElementType;
    children?:
      | React.ReactNode
      | ((props: {className: string; style: React.CSSProperties}) => React.ReactNode);
    className?: string;
    containerType?: string;
    ref?: React.Ref<any>;
    style?: React.CSSProperties;
  };
  layoutStyle: LayoutStyle;
  omitProps: ReadonlySet<string>;
  className?: string;
  defaultElement?: React.ElementType;
}
export const LayoutElement = styled(function LayoutElement({
  elementProps: props,
  layoutStyle,
  omitProps,
  className,
  defaultElement = 'div',
}: LayoutElementProps) {
  const containerRef = useRef<HTMLElement>(null);
  const {as, containerType, ref, children} = props;
  const isContainer = !!containerType && containerType !== 'normal';
  const containerRefs = useMemo(
    () => (isContainer ? mergeRefs(ref, containerRef) : ref),
    [isContainer, ref]
  );
  const merged = finishLayoutStyle(
    layoutStyle,
    [className, props.className].filter(Boolean).join(' '),
    props.style
  );
  if (typeof children === 'function') {
    return children(merged);
  }
  const domProps: Record<string, unknown> = {};
  for (const key in props) {
    if (
      !['as', 'containerType', 'className', 'style', 'ref', 'theme'].includes(key) &&
      !omitProps.has(key) &&
      isPropValid(key)
    ) {
      domProps[key] = (props as Record<string, unknown>)[key];
    }
  }
  const Component = as ?? defaultElement;
  const node = <Component {...domProps} {...merged} ref={containerRefs} />;
  return isContainer ? (
    <ContainerQueryProvider elementRef={containerRef}>{node}</ContainerQueryProvider>
  ) : (
    node
  );
})`
  ${layoutCss};
  &.yk-separator[aria-orientation='horizontal'] {
    border-bottom: var(--yk-separator-border) !important;
  }
  &.yk-separator[aria-orientation='vertical'] {
    border-left: var(--yk-separator-border) !important;
  }
`;
export function Container<T extends ContainerElement = 'div'>(
  props: ContainerProps<T> | ContainerPropsWithRenderFunction<T>
) {
  const acc = useLayoutStyle(typeof props.children === 'function');
  addContainerStyles(acc, props);
  return (
    <LayoutElement
      elementProps={props}
      layoutStyle={acc}
      omitProps={omitContainerProps}
    />
  );
}
