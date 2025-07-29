import type {CSSProperties} from 'react';
import styled from '@emotion/styled';

import {Container, type ContainerElement, type ContainerProps} from './container';
import {getSpacing, rc, type Responsive, type SpacingSize} from './styles';

const omitFlexProps = new Set<keyof FlexProps>([
  'as',
  'direction',
  'flex',
  'gap',
  'inline',
  'align',
  'justify',
  'wrap',
]);

type FlexProps<T extends ContainerElement = 'div'> = Omit<
  ContainerProps<T>,
  'display'
> & {
  /**
   * Aligns flex items along the cross axis of the current line of flex items.
   * Uses CSS align-items property.
   */
  align?: Responsive<'start' | 'end' | 'center' | 'baseline' | 'stretch'>;
  direction?: Responsive<'row' | 'row-reverse' | 'column' | 'column-reverse'>;
  flex?: Responsive<CSSProperties['flex']>;
  gap?: Responsive<SpacingSize | `${SpacingSize} ${SpacingSize}`>;
  /**
   * Determines whether the flex container should be displayed as an inline-flex.
   */
  inline?: Responsive<boolean>;
  /**
   * Aligns flex items along the block axis of the current line of flex items.
   * Uses CSS justify-content property.
   */
  justify?: Responsive<
    'start' | 'end' | 'center' | 'between' | 'around' | 'evenly' | 'left' | 'right'
  >;
  wrap?: Responsive<'nowrap' | 'wrap' | 'wrap-reverse'>;
};

export const Flex = styled(Container, {
  shouldForwardProp: prop => {
    return !omitFlexProps.has(prop as unknown as keyof FlexProps);
  },
})<FlexProps<any>>`
  ${p => rc('display', p.as === 'span' || p.inline ? 'inline-flex' : 'flex', p.theme)};

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
