import React, {useMemo} from 'react';
import {useRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import type {
  BorderVariant,
  RadiusSize,
  SpaceSize,
  SurfaceVariant,
} from 'sentry/utils/theme';

import {
  ContainerQueryProvider,
  getBorder,
  getMargin,
  getRadius,
  getSpacing,
  rc,
  type Margin,
  type Responsive,
  type Shorthand,
} from './styles';

/* eslint-disable typescript-sort-keys/interface */
interface ContainerLayoutProps {
  background?: Responsive<Exclude<SurfaceVariant, 'overlay'>>;
  display?: Responsive<
    | 'block'
    | 'inline'
    | 'inline-block'
    | 'flex'
    | 'inline-flex'
    | 'grid'
    | 'inline-grid'
    | 'contents'
    | 'none'
  >;

  padding?: Responsive<Shorthand<SpaceSize, 4>>;
  paddingTop?: Responsive<SpaceSize>;
  paddingBottom?: Responsive<SpaceSize>;
  paddingLeft?: Responsive<SpaceSize>;
  paddingRight?: Responsive<SpaceSize>;

  position?: Responsive<'static' | 'relative' | 'absolute' | 'fixed' | 'sticky'>;

  inset?: Responsive<React.CSSProperties['inset']>;
  top?: Responsive<React.CSSProperties['top']>;
  bottom?: Responsive<React.CSSProperties['bottom']>;
  left?: Responsive<React.CSSProperties['left']>;
  right?: Responsive<React.CSSProperties['right']>;

  overflow?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;
  overflowX?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;
  overflowY?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;

  overscrollBehavior?: Responsive<'contain' | 'auto' | 'none'>;

  pointerEvents?: Responsive<React.CSSProperties['pointerEvents']>;

  cursor?: Responsive<React.CSSProperties['cursor']>;

  contain?: Responsive<React.CSSProperties['contain']>;

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

  width?: Responsive<React.CSSProperties['width']>;
  minWidth?: Responsive<React.CSSProperties['minWidth']>;
  maxWidth?: Responsive<React.CSSProperties['maxWidth']>;

  height?: Responsive<React.CSSProperties['height']>;
  minHeight?: Responsive<React.CSSProperties['minHeight']>;
  maxHeight?: Responsive<React.CSSProperties['maxHeight']>;

  border?: Responsive<BorderVariant>;
  borderTop?: Responsive<BorderVariant>;
  borderBottom?: Responsive<BorderVariant>;
  borderLeft?: Responsive<BorderVariant>;
  borderRight?: Responsive<BorderVariant>;

  // Grid Item Properties
  area?: Responsive<React.CSSProperties['gridArea']>;
  row?: Responsive<React.CSSProperties['gridRow']>;
  column?: Responsive<React.CSSProperties['gridColumn']>;

  // Flex Item Properties
  order?: Responsive<React.CSSProperties['order']>;
  flex?: Responsive<React.CSSProperties['flex']>;
  flexGrow?: Responsive<React.CSSProperties['flexGrow']>;
  flexShrink?: Responsive<React.CSSProperties['flexShrink']>;
  flexBasis?: Responsive<React.CSSProperties['flexBasis']>;
  alignSelf?: Responsive<React.CSSProperties['alignSelf']>;
  justifySelf?: Responsive<React.CSSProperties['justifySelf']>;

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

/* eslint-enable typescript-sort-keys/interface */
export type ContainerElement =
  | 'article'
  | 'aside'
  | 'blockquote'
  | 'div'
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
  children: (props: {className: string}) => React.ReactNode | undefined;
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

const omitContainerProps = new Set<keyof ContainerLayoutProps | 'as'>([
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

export const Container = styled(
  <T extends ContainerElement = 'div'>(
    props: (ContainerProps<T> | ContainerPropsWithRenderFunction<T>) & {
      className?: string;
    }
  ) => {
    // Hooks must run unconditionally, before the render-prop early return.
    const containerRef = useRef<HTMLElement>(null);
    const {as, containerType, ref, ...rest} = props;

    // A query container needs its size observed in JS so descendants can resolve
    // container-mode responsive props (e.g. Stack orientation). We only attach a
    // ref + observer when this element is actually a container, keeping the
    // common (non-container) path free of any ResizeObserver overhead.
    const isContainer = !!containerType && containerType !== 'normal';

    const containerRefs = useMemo(
      () => (isContainer ? mergeRefs(ref as React.Ref<any>, containerRef) : ref),
      [isContainer, ref]
    );

    if (typeof props.children === 'function') {
      // When using render prop, only pass className to the child function
      return props.children({className: props.className ?? ''});
    }

    const Component = as ?? 'div';

    const node = <Component {...(rest as any)} ref={containerRefs} />;

    if (isContainer) {
      return (
        <ContainerQueryProvider elementRef={containerRef}>{node}</ContainerQueryProvider>
      );
    }

    return node;
  },
  {
    shouldForwardProp: prop => {
      // containerType must reach the inner component to wire up the query
      // container; it is stripped there so it never lands on the DOM.
      if (prop === 'containerType') {
        return true;
      }
      if (omitContainerProps.has(prop as keyof ContainerLayoutProps | 'as')) {
        return false;
      }
      return isPropValid(prop);
    },
  }
)<ContainerProps<any> | ContainerPropsWithRenderFunction<any>>`
  ${p => rc('container-type', p.containerType, p.theme)};

  ${p => rc('display', p.display, p.theme)};
  ${p => rc('position', p.position, p.theme)};

  ${p => rc('inset', p.inset, p.theme)};
  ${p => rc('top', p.top, p.theme)};
  ${p => rc('bottom', p.bottom, p.theme)};
  ${p => rc('left', p.left, p.theme)};
  ${p => rc('right', p.right, p.theme)};

  ${p => rc('overflow', p.overflow, p.theme)};
  ${p => rc('overflow-x', p.overflowX, p.theme)};
  ${p => rc('overflow-y', p.overflowY, p.theme)};

  ${p => rc('overscroll-behavior', p.overscrollBehavior, p.theme)};

  ${p => rc('pointer-events', p.pointerEvents, p.theme)};

  ${p => rc('cursor', p.cursor, p.theme)};
  ${p => rc('contain', p.contain, p.theme)};

  ${p => rc('padding', p.padding, p.theme, getSpacing)};
  ${p => rc('padding-top', p.paddingTop, p.theme, getSpacing)};
  ${p => rc('padding-bottom', p.paddingBottom, p.theme, getSpacing)};
  ${p => rc('padding-left', p.paddingLeft, p.theme, getSpacing)};
  ${p => rc('padding-right', p.paddingRight, p.theme, getSpacing)};

  ${p => rc('margin', p.margin, p.theme, getMargin)};
  ${p => rc('margin-top', p.marginTop, p.theme, getMargin)};
  ${p => rc('margin-bottom', p.marginBottom, p.theme, getMargin)};
  ${p => rc('margin-left', p.marginLeft, p.theme, getMargin)};
  ${p => rc('margin-right', p.marginRight, p.theme, getMargin)};

  ${p =>
    rc('background', p.background, p.theme, v =>
      v ? p.theme.tokens.background[v] : undefined
    )};

  ${p => rc('border-radius', p.radius, p.theme, getRadius)};

  ${p => rc('width', p.width, p.theme)};
  ${p => rc('min-width', p.minWidth, p.theme)};
  ${p => rc('max-width', p.maxWidth, p.theme)};

  ${p => rc('height', p.height, p.theme)};
  ${p => rc('min-height', p.minHeight, p.theme)};
  ${p => rc('max-height', p.maxHeight, p.theme)};

  ${p => rc('grid-area', p.area, p.theme)};
  ${p => rc('grid-row', p.row, p.theme)};
  ${p => rc('grid-column', p.column, p.theme)};

  ${p => rc('order', p.order, p.theme)};
  ${p => rc('flex', p.flex, p.theme)};
  ${p => rc('flex-grow', p.flexGrow, p.theme)};
  ${p => rc('flex-shrink', p.flexShrink, p.theme)};
  ${p => rc('flex-basis', p.flexBasis, p.theme)};

  ${p => rc('align-self', p.alignSelf, p.theme)};
  ${p => rc('justify-self', p.justifySelf, p.theme)};

  ${p => rc('border', p.border, p.theme, getBorder)};
  ${p => rc('border-top', p.borderTop, p.theme, getBorder)};
  ${p => rc('border-bottom', p.borderBottom, p.theme, getBorder)};
  ${p => rc('border-left', p.borderLeft, p.theme, getBorder)};
  ${p => rc('border-right', p.borderRight, p.theme, getBorder)};

  ${p => rc('visibility', p.visibility, p.theme)};
  ${p => rc('white-space', p.whiteSpace, p.theme)};

  /**
   * This cast is required because styled-components does not preserve the generic signature of the wrapped component.
   * By default, the generic type parameter <T> is lost, so we use 'as unknown as' to restore the correct typing.
   * https://github.com/styled-components/styled-components/issues/1803
   */
` as unknown as <T extends ContainerElement = 'div'>(
  props: ContainerProps<T> | ContainerPropsWithRenderFunction<T>
) => React.ReactElement;
