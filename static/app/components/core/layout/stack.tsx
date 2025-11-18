import React from 'react';
import styled from '@emotion/styled';

import {Separator, type SeparatorProps} from 'sentry/components/core/separator';

import type {ContainerElement} from './container';
import {Flex, type FlexProps} from './flex';
import {useResponsivePropValue} from './styles';

type StackLayoutProps = Pick<
  FlexProps,
  'align' | 'direction' | 'gap' | 'justify' | 'wrap'
>;

export type StackProps<T extends ContainerElement = 'div'> = StackLayoutProps &
  FlexProps<T>;

const StackComponent = styled(
  <T extends ContainerElement = 'div'>({
    direction = 'column',
    ...props
  }: StackProps<T>) => {
    const responsiveDirection = useResponsivePropValue(direction);
    return (
      <OrientationContext.Provider
        value={getOrientationFromDirection(responsiveDirection)}
      >
        <Flex {...props} direction={direction} />
      </OrientationContext.Provider>
    );
  }
)<StackProps<any>>`
  /**
   * This cast is required because styled-components does not preserve the generic signature of the wrapped component.
   * By default, the generic type parameter <T> is lost, so we use 'as unknown as' to restore the correct typing.
   * https://github.com/styled-components/styled-components/issues/1803
   */
` as unknown as <T extends ContainerElement = 'div'>(
  props: StackProps<T>
) => React.ReactElement;

function getOrientationFromDirection(
  direction: NonNullable<StackLayoutProps['direction']>
): 'horizontal' | 'vertical' {
  switch (direction) {
    case 'row':
    case 'row-reverse':
      return 'horizontal';
    case 'column':
    case 'column-reverse':
      return 'vertical';
    default:
      throw new TypeError('No Stack Direction was provided');
  }
}

const OrientationContext = React.createContext<'horizontal' | 'vertical'>('horizontal');
function useOrientation(): 'horizontal' | 'vertical' {
  return React.useContext(OrientationContext);
}

type StackSeparatorProps = Omit<SeparatorProps, 'orientation'>;

const StackSeparator = styled((props: StackSeparatorProps) => {
  const orientation = useOrientation();

  return (
    <Separator
      {...props}
      // A separator has the opposite orientation as the stack. If we are in
      // row orientation, the separator should be vertical and vice versa
      orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
      border={props.border ?? 'primary'}
    />
  );
})<StackSeparatorProps>``;

export const Stack = Object.assign(StackComponent, {
  Separator: StackSeparator,
});
