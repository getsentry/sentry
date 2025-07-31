import styled from '@emotion/styled';

import type {ContainerElement, ContainerProps} from './container';
import {Flex} from './flex';
import type {Responsive, SpacingSize} from './styles';

interface StackLayoutProps {
  /**
   * Aligns flex items along the cross axis of the current line of flex items.
   * Uses CSS align-items property.
   */
  align?: Responsive<'start' | 'end' | 'center' | 'baseline' | 'stretch'>;
  /**
   * Sets the stack direction.
   * @default 'column'
   */
  direction?: Responsive<'row' | 'row-reverse' | 'column' | 'column-reverse'>;
  gap?: Responsive<SpacingSize | `${SpacingSize} ${SpacingSize}`>;
  /**
   * Aligns flex items along the block axis of the current line of flex items.
   * Uses CSS justify-content property.
   */
  justify?: Responsive<
    'start' | 'end' | 'center' | 'between' | 'around' | 'evenly' | 'left' | 'right'
  >;
}

type StackProps<T extends ContainerElement = 'div'> = ContainerProps<T> &
  StackLayoutProps;

export const Stack = styled((props: StackProps<any>) => (
  <Flex {...props} direction={props.direction ?? 'column'} />
))<StackProps<any>>`
  /**
   * This cast is required because styled-components does not preserve the generic signature of the wrapped component.
   * By default, the generic type parameter <T> is lost, so we use 'as unknown as' to restore the correct typing.
   * https://github.com/styled-components/styled-components/issues/1803
   */
` as unknown as <T extends ContainerElement = 'div'>(
  props: StackProps<T>
) => React.ReactElement;
