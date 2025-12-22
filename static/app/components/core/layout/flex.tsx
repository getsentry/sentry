import type {CSSProperties} from 'react';
import styled from '@emotion/styled';
import type {DistributedOmit} from 'type-fest';

import type {SpaceSize} from 'sentry/utils/theme';

import {Container, type ContainerElement, type ContainerProps} from './container';
import {getSpacing, rc, type Responsive} from './styles';

const omitFlexProps = new Set<keyof FlexLayoutProps | 'as'>([
  'as',
  'direction',
  'flex',
  'gap',
  'display',
  'align',
  'justify',
  'wrap',
]);

interface FlexLayoutProps {
  /**
   * Aligns flex items along the cross axis of the current line of flex items.
   * Uses CSS align-items property.
   */
  align?: Responsive<'start' | 'end' | 'center' | 'baseline' | 'stretch'>;
  /**
   * Specifies the direction of the flex items.
   */
  direction?: Responsive<'row' | 'row-reverse' | 'column' | 'column-reverse'>;
  /**
   * Specifies the display type of the flex container.
   */
  display?: Responsive<'flex' | 'inline-flex' | 'none'>;
  /**
   * Shorthand for the flex property.
   */
  flex?: Responsive<CSSProperties['flex']>;
  /**
   * Specifies the spacing between flex items.
   */
  gap?: Responsive<SpaceSize | `${SpaceSize} ${SpaceSize}`>;
  /**
   * Aligns flex items along the block axis of the current line of flex items.
   * Uses CSS justify-content property.
   */
  justify?: Responsive<
    'start' | 'end' | 'center' | 'between' | 'around' | 'evenly' | 'left' | 'right'
  >;
  /**
   * Specifies the wrapping behavior of the flex items.
   */
  wrap?: Responsive<'nowrap' | 'wrap' | 'wrap-reverse'>;
}

export type FlexProps<T extends ContainerElement = 'div'> = DistributedOmit<
  ContainerProps<T>,
  'display'
> &
  FlexLayoutProps;

export const Flex = styled(Container, {
  shouldForwardProp: prop => {
    return !omitFlexProps.has(prop as any);
  },
})<FlexProps<any>>`
  ${p => rc('display', p.display ?? 'flex', p.theme, v => v ?? 'flex')};
  ${p => rc('order', p.order, p.theme)};
  ${p => rc('gap', p.gap, p.theme, getSpacing)};

  ${p => rc('flex-direction', p.direction, p.theme)};
  ${p => rc('flex-wrap', p.wrap, p.theme)};
  ${p => rc('flex', p.flex, p.theme)};
  ${p =>
    rc('justify-content', p.justify, p.theme, (value, _breakpoint, _theme) => {
      switch (value) {
        case 'start':
          return 'flex-start';
        case 'end':
          return 'flex-end';
        case 'center':
          return 'center';
        case 'between':
          return 'space-between';
        case 'around':
          return 'space-around';
        case 'evenly':
          return 'space-evenly';
        default:
          return value;
      }
    })};

  ${p =>
    rc('align-items', p.align, p.theme, (value, _breakpoint, _theme) => {
      switch (value) {
        case 'start':
          return 'flex-start';
        case 'end':
          return 'flex-end';
        default:
          return value;
      }
    })};
  /**
   * This cast is required because styled-components does not preserve the generic signature of the wrapped component.
   * By default, the generic type parameter <T> is lost, so we use 'as unknown as' to restore the correct typing.
   * https://github.com/styled-components/styled-components/issues/1803
   */
` as unknown as <T extends ContainerElement = 'div'>(
  props: FlexProps<T>
) => React.ReactElement;
