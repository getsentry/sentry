import React, {createRef} from 'react';
import {expectTypeOf} from 'expect-type';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Flex, type FlexProps} from 'sentry/components/core/layout/flex';
import type {Responsive} from 'sentry/components/core/layout/styles';

describe('Flex', () => {
  it('renders children', () => {
    render(<Flex>Hello</Flex>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('implements render prop', () => {
    render(
      <section>
        <Flex justify="between">{props => <p {...props}>Hello</p>}</Flex>
      </section>
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
      </Flex>
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
      </Flex>
    );
  });

  it('as=label props are correctly inferred', () => {
    render(
      <Flex as="label" htmlFor="test-id">
        Hello World
      </Flex>
    );
    expectTypeOf<FlexProps<'label'>>().toHaveProperty('htmlFor');
  });

  it('passes attributes to the underlying element', () => {
    render(<Flex data-test-id="container">Hello</Flex>);
    expect(screen.getByTestId('container')).toBeInTheDocument();
  });

  it('renders as a different element if specified', () => {
    render(<Flex as="section">Hello</Flex>);
    expect(screen.getByText('Hello').tagName).toBe('SECTION');
  });

  it('does not bleed attributes to the underlying element', () => {
    render(<Flex radius="sm">Hello</Flex>);
    expect(screen.getByText('Hello')).not.toHaveAttribute('radius');
  });

  it('does not bleed flex attributes to the underlying element', () => {
    render(
      <Flex align="center" justify="center">
        Hello
      </Flex>
    );

    expect(screen.getByText('Hello')).not.toHaveAttribute('align');
    expect(screen.getByText('Hello')).not.toHaveAttribute('justify');
  });

  it('allows settings native html attributes', () => {
    render(<Flex style={{color: 'red'}}>Hello</Flex>);
    expect(screen.getByText('Hello')).toHaveStyle({color: 'red'});
  });

  it('attaches ref to the underlying element', () => {
    const ref = createRef<HTMLOListElement>();
    render(
      <Flex ref={ref} as="ol">
        Hello
      </Flex>
    );
    expect(ref.current).toBeInTheDocument();
    expect(ref.current?.tagName).toBe('OL');
  });

  it('reuses class names for the same props', () => {
    render(
      <React.Fragment>
        <Flex radius="sm" padding="md">
          Padding First
        </Flex>
        <Flex radius="sm" padding="md">
          PaddingBottom First
        </Flex>
      </React.Fragment>
    );

    const paddingFirst = screen.getByText('Padding First').className;
    const paddingBottomFirst = screen.getByText('PaddingBottom First').className;
    expect(paddingFirst).toEqual(paddingBottomFirst);
  });

  describe('types', () => {
    it('has a limited display prop', () => {
      const props: FlexProps = {};
      expectTypeOf(props.display).toEqualTypeOf<
        Responsive<'flex' | 'inline-flex' | 'none'> | undefined
      >();
    });
  });
});
