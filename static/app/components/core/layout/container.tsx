import type React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import type {Theme} from 'sentry/utils/theme';

import {
  getBorder,
  getRadius,
  getSpacing,
  rc,
  type Border,
  type RadiusSize,
  type Responsive,
  type Shorthand,
  type SpacingSize,
} from './styles';

/* eslint-disable typescript-sort-keys/interface */
interface ContainerLayoutProps {
  background?: Responsive<keyof Theme['tokens']['background']>;
  display?: Responsive<
    'block' | 'inline' | 'inline-block' | 'flex' | 'inline-flex' | 'grid' | 'inline-grid'
  >;

  padding?: Responsive<Shorthand<SpacingSize, 4>>;

  position?: Responsive<'static' | 'relative' | 'absolute' | 'fixed' | 'sticky'>;

  overflow?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;
  overflowX?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;
  overflowY?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;

  radius?: Responsive<Shorthand<RadiusSize, 4>>;

  width?: Responsive<React.CSSProperties['width']>;
  minWidth?: Responsive<React.CSSProperties['minWidth']>;
  maxWidth?: Responsive<React.CSSProperties['maxWidth']>;

  height?: Responsive<React.CSSProperties['height']>;
  minHeight?: Responsive<React.CSSProperties['minHeight']>;
  maxHeight?: Responsive<React.CSSProperties['maxHeight']>;

  border?: Responsive<Border>;

  area?: Responsive<React.CSSProperties['gridArea']>;
  order?: Responsive<React.CSSProperties['order']>;
  flex?: Responsive<React.CSSProperties['flex']>;
  alignSelf?: Responsive<React.CSSProperties['alignSelf']>;
}

/* eslint-enable typescript-sort-keys/interface */
export type ContainerElement =
  | 'article'
  | 'aside'
  | 'div'
  | 'figure'
  | 'footer'
  | 'header'
  | 'li'
  | 'main'
  | 'nav'
  | 'ol'
  | 'section'
  | 'span'
  | 'summary'
  | 'ul'
  | 'hr';

type ContainerPropsWithChildren<T extends ContainerElement = 'div'> =
  ContainerLayoutProps & {
    as?: T;
    children?: React.ReactNode;
    ref?: React.Ref<HTMLElementTagNameMap[T] | null>;
  } & React.HTMLAttributes<HTMLElementTagNameMap[T]>;

type ContainerPropsWithRenderProp<T extends ContainerElement = 'div'> =
  ContainerLayoutProps & {
    children: (props: {className: string}) => React.ReactNode | undefined;
    as?: never;
    ref?: never;
  } & Partial<
      Record<
        // HTMLAttributes extends from DOMAttributes which types children as React.ReactNode | undefined.
        // Therefore, we need to exclude it from the map, or the children will produce a never type.
        Exclude<keyof React.HTMLAttributes<HTMLElementTagNameMap[T]>, 'children'>,
        never
      >
    >;

export type ContainerProps<T extends ContainerElement = 'div'> =
  | ContainerPropsWithChildren<T>
  | ContainerPropsWithRenderProp<T>;

const omitContainerProps = new Set<keyof ContainerLayoutProps | 'as'>([
  'alignSelf',
  'as',
  'area',
  'border',
  'background',
  'display',
  'flex',
  'padding',
  'overflow',
  'overflowX',
  'overflowY',
  'order',
  'position',
  'radius',
  'width',
  'minWidth',
  'maxWidth',
  'height',
  'minHeight',
  'maxHeight',
]);

export const Container = styled(
  <T extends ContainerElement = 'div'>(props: ContainerProps<T>) => {
    if (typeof props.children === 'function') {
      // When using render prop, only pass className to the child function
      return props.children({className: (props as any).className});
    }

    const {as, ...rest} = props;
    const Component = as ?? 'div';
    return <Component {...(rest as any)} />;
  },
  {
    shouldForwardProp: prop => {
      if (omitContainerProps.has(prop as any)) {
        return false;
      }
      return isPropValid(prop);
    },
  }
)`
  ${p => rc('display', p.display, p.theme)};
  ${p => rc('position', p.position, p.theme)};

  ${p => rc('overflow', p.overflow, p.theme)};
  ${p => rc('overflow-x', p.overflowX, p.theme)};
  ${p => rc('overflow-y', p.overflowY, p.theme)};

  ${p => rc('padding', p.padding, p.theme, getSpacing)};

  ${p => rc('background', p.background, p.theme, v => p.theme.tokens.background[v])};

  ${p => rc('border-radius', p.radius, p.theme, getRadius)};

  ${p => rc('width', p.width, p.theme)};
  ${p => rc('min-width', p.minWidth, p.theme)};
  ${p => rc('max-width', p.maxWidth, p.theme)};

  ${p => rc('height', p.height, p.theme)};
  ${p => rc('min-height', p.minHeight, p.theme)};
  ${p => rc('max-height', p.maxHeight, p.theme)};

  ${p => rc('grid-area', p.area, p.theme)};
  ${p => rc('order', p.order, p.theme)};
  ${p => rc('flex', p.flex, p.theme)};
  ${p => rc('align-self', p.alignSelf, p.theme)};

  ${p => rc('border', p.border, p.theme, getBorder)};

  /**
   * This cast is required because styled-components does not preserve the generic signature of the wrapped component.
   * By default, the generic type parameter <T> is lost, so we use 'as unknown as' to restore the correct typing.
   * https://github.com/styled-components/styled-components/issues/1803
   */
` as unknown as <T extends ContainerElement = 'div'>(
  props: ContainerProps<T>
) => React.ReactElement;
