import {createContext, useContext, useMemo} from 'react';

import {Separator, type SeparatorProps} from '@sentry/scraps/separator';

import type {ContainerElement} from './container';
import {Flex, type FlexProps, type FlexPropsWithRenderFunction} from './flex';
import {useResponsivePropValue} from './styles';

/**
 * Stack is just a super set of Flex props with a default direction initializer to 'column'.
 */
export type StackProps<T extends ContainerElement = 'div'> = FlexProps<T>;

export type StackPropsWithRenderFunction<T extends ContainerElement = 'div'> =
  FlexPropsWithRenderFunction<T>;

function StackComponentImpl<T extends ContainerElement = 'div'>({
  direction = 'column',
  ...props
}: StackProps<T> | StackPropsWithRenderFunction<T>) {
  const directionContext = useMemo<StackDirectionContextValue>(
    () => ({direction}),
    [direction]
  );

  return (
    <StackDirectionContext.Provider value={directionContext}>
      <Flex {...(props as FlexProps<T>)} direction={direction} />
    </StackDirectionContext.Provider>
  );
}

const StackComponent = StackComponentImpl as <T extends ContainerElement = 'div'>(
  props: StackProps<T> | StackPropsWithRenderFunction<T>
) => React.ReactElement;

function getOrientationFromDirection(
  direction: NonNullable<StackProps['direction']>
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

interface StackDirectionContextValue {
  direction: NonNullable<StackProps['direction']>;
}

const StackDirectionContext = createContext<StackDirectionContextValue>({
  direction: 'row',
});

type StackSeparatorProps = Omit<SeparatorProps, 'orientation'>;

function StackSeparator(props: StackSeparatorProps) {
  const {direction} = useContext(StackDirectionContext);
  const responsiveDirection = useResponsivePropValue(direction);
  const orientation = getOrientationFromDirection(responsiveDirection);

  return (
    <Separator
      {...props}
      // A separator has the opposite orientation as the stack. If we are in
      // row orientation, the separator should be vertical and vice versa
      orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
      border={props.border ?? 'primary'}
    />
  );
}

export const Stack = Object.assign(StackComponent, {
  Separator: StackSeparator,
});
