import {createRef, Fragment} from 'react';
import {render, screen} from '@testing-library/react';
import {expectTypeOf} from 'expect-type';

import type {Responsive} from '@sentry/scraps/layout';

import {ThemeWrapper} from '../../test/theme';

import {Flex, type FlexProps, type FlexPropsWithRenderFunction} from './flex';

describe('Flex', () => {
  it('renders children', () => {
    render(<Flex>Hello</Flex>, {wrapper: ThemeWrapper});
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('implements render prop', () => {
    render(
      <section>
        <Flex justify="between">{props => <p {...props}>Hello</p>}</Flex>
      </section>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByText('Hello')?.tagName).toBe('P');
    expect(screen.getByText('Hello').parentElement?.tagName).toBe('SECTION');

    expect(screen.getByText('Hello')).not.toHaveAttribute('border', 'primary');
  });

  it('render prop guards against invalid attributes', () => {
    render(
      // @ts-expect-error - aria-activedescendant should be set on the child element
      <Flex justify="between" aria-activedescendant="what">
        {/* @ts-expect-error - this should be a React.ElementType */}
        {props => <p {...props}>Hello</p>}
      </Flex>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByText('Hello')).not.toHaveAttribute('aria-activedescendant');
  });

  it('render prop type is correctly inferred', () => {
    // Incompatible className type - should be string
    function Child({className}: {className: 'invalid'}) {
      return <p className={className}>Hello</p>;
    }

    render(
      <Flex justify="between" padding="md">
        {/* @ts-expect-error - className is incompatible */}
        {props => <Child {...props} />}
      </Flex>,
      {wrapper: ThemeWrapper}
    );
  });

  it('as=label props are correctly inferred', () => {
    render(
      <Flex as="label" htmlFor="test-id">
        Hello World
      </Flex>,
      {wrapper: ThemeWrapper}
    );
    expectTypeOf<FlexProps<'label'>>().toHaveProperty('htmlFor');
  });

  it('passes attributes to the underlying element', () => {
    render(<Flex data-test-id="container">Hello</Flex>, {wrapper: ThemeWrapper});
    expect(screen.getByTestId('container')).toBeInTheDocument();
  });

  it('renders as a different element if specified', () => {
    render(<Flex as="section">Hello</Flex>, {wrapper: ThemeWrapper});
    expect(screen.getByText('Hello').tagName).toBe('SECTION');
  });

  it('does not bleed attributes to the underlying element', () => {
    render(<Flex radius="sm">Hello</Flex>, {wrapper: ThemeWrapper});
    expect(screen.getByText('Hello')).not.toHaveAttribute('radius');
  });

  it('does not bleed flex attributes to the underlying element', () => {
    render(
      <Flex align="center" justify="center">
        Hello
      </Flex>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByText('Hello')).not.toHaveAttribute('align');
    expect(screen.getByText('Hello')).not.toHaveAttribute('justify');
  });

  it('allows settings native html attributes', () => {
    render(<Flex style={{color: 'red'}}>Hello</Flex>, {wrapper: ThemeWrapper});
    expect(screen.getByText('Hello')).toHaveStyle({color: 'rgb(255, 0, 0)'});
  });

  it('attaches ref to the underlying element', () => {
    const ref = createRef<HTMLOListElement>();
    render(
      <Flex ref={ref} as="ol">
        Hello
      </Flex>,
      {wrapper: ThemeWrapper}
    );
    expect(ref.current).toBeInTheDocument();
    expect(ref.current?.tagName).toBe('OL');
  });

  it('reuses class names for the same props', () => {
    render(
      <Fragment>
        <Flex radius="sm" padding="md">
          Padding First
        </Flex>
        <Flex radius="sm" padding="md">
          PaddingBottom First
        </Flex>
      </Fragment>,
      {wrapper: ThemeWrapper}
    );

    const paddingFirst = screen.getByText('Padding First').className;
    const paddingBottomFirst = screen.getByText('PaddingBottom First').className;
    expect(paddingFirst).toEqual(paddingBottomFirst);
  });

  describe('types', () => {
    it('has a limited display prop', () => {
      const props: FlexProps<any> = {};
      expectTypeOf(props.display).toEqualTypeOf<
        Responsive<'flex' | 'inline-flex' | 'none'> | undefined
      >();
    });

    it('default signature limits children to React.ReactNode', () => {
      const props: FlexProps<any> = {};
      expectTypeOf(props.children).toEqualTypeOf<React.ReactNode | undefined>();
    });
    it('render prop signature limits children to (props: {className: string}) => React.ReactNode | undefined', () => {
      const props: FlexPropsWithRenderFunction<any> = {
        children: () => {},
      };
      expectTypeOf(props.children).toEqualTypeOf<
        (props: {className: string}) => React.ReactNode | undefined
      >();
    });
  });
});
