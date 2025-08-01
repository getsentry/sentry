import styled from '@emotion/styled';

import {Container, type ContainerElement, type ContainerProps} from './container';
import {
  type Breakpoint,
  getSpacing,
  rc,
  type Responsive,
  type SpacingSize,
} from './styles';

interface StackLayoutProps {
  axis: 'x' | 'y';
  gap?: Responsive<SpacingSize>;
  switch?: Breakpoint;
}

const omitStackProps = new Set<keyof StackLayoutProps | 'as'>([
  'as',
  'axis',
  'switch',
  'gap',
]);

type StackProps<T extends ContainerElement = 'div'> = ContainerProps<T> &
  StackLayoutProps;

const Divider = styled('div')`
  display: block;
  background: red;
  border: none;
  margin: 0;
  align-self: stretch;
  justify-self: stretch;

  @container stack style(--flex-direction: row) {
    background: blue;
    width: 4px;
  }
  @container stack style(--flex-direction: column) {
    background: green;
    height: 4px;
  }
`;

export const Stack = Object.assign(
  styled(Container, {
    shouldForwardProp: prop => {
      return !omitStackProps.has(prop as any);
    },
  })<StackProps<any>>`
    container-type: normal;
    container-name: stack;

    display: flex;
    flex-direction: var(--flex-direction);

    ${p => rc('gap', p.gap, p.theme, getSpacing)};
    ${p =>
      rc(
        '--flex-direction',
        {
          xs: p.axis === 'x' ? 'row' : 'column',
          ...(p.switch ? {[p.switch]: p.axis === 'x' ? 'column' : 'row'} : {}),
        } as any,
        p.theme
      )};
  `,
  {Divider}
);

Stack.Divider = Divider;
