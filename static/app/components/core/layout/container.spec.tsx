import React, {createRef} from 'react';
import {expectTypeOf} from 'expect-type';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Container, type ContainerProps} from 'sentry/components/core/layout/container';

describe('Container', () => {
  it('renders children', () => {
    render(<Container>Hello</Container>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('implements render prop', () => {
    render(
      <section>
        <Container border="primary">{props => <p {...props}>Hello</p>}</Container>
      </section>
    );

    expect(screen.getByText('Hello')?.tagName).toBe('P');
    expect(screen.getByText('Hello').parentElement?.tagName).toBe('SECTION');

    expect(screen.getByText('Hello')).not.toHaveAttribute('border', 'primary');
  });

  it('render prop guards against invalid attributes', () => {
    render(
      // @ts-expect-error - aria-activedescendant should be set on the child element
      <Container border="primary" aria-activedescendant="what">
        {/* @ts-expect-error - this should be a React.ElementType */}
        {props => <p {...props}>Hello</p>}
      </Container>
    );

    expect(screen.getByText('Hello')).not.toHaveAttribute('aria-activedescendant');
  });

  it('render prop type is correctly inferred', () => {
    // Incompatible className type - should be string
    function Child({className}: {className: 'invalid'}) {
      return <p className={className}>Hello</p>;
    }

    render(
      <Container border="primary">
        {/* @ts-expect-error - className is incompatible */}
        {props => <Child {...props} />}
      </Container>
    );
  });

  it('as=label props are correctly inferred', () => {
    render(
      <Container as="label" htmlFor="test-id">
        Hello World
      </Container>
    );
    expectTypeOf<ContainerProps<'label'>>().toHaveProperty('htmlFor');
  });

  it('passes attributes to the underlying element', () => {
    render(<Container data-test-id="container">Hello</Container>);
    expect(screen.getByTestId('container')).toBeInTheDocument();
  });

  it('renders as a different element if specified', () => {
    render(<Container as="section">Hello</Container>);
    expect(screen.getByText('Hello').tagName).toBe('SECTION');
  });

  it('does not bleed attributes to the underlying element', () => {
    render(<Container radius="sm">Hello</Container>);
    expect(screen.getByText('Hello')).not.toHaveAttribute('radius');
  });

  it('allows settings native html attributes', () => {
    render(<Container style={{color: 'red'}}>Hello</Container>);
    expect(screen.getByText('Hello')).toHaveStyle({color: 'red'});
  });

  it('attaches ref to the underlying element', () => {
    const ref = createRef<HTMLOListElement>();
    render(
      <Container ref={ref} as="ol">
        Hello
      </Container>
    );
    expect(ref.current).toBeInTheDocument();
    expect(ref.current?.tagName).toBe('OL');
  });

  it('reuses class names for the same props', () => {
    render(
      <React.Fragment>
        <Container radius="sm" padding="md">
          Padding First
        </Container>
        <Container radius="sm" padding="md">
          PaddingBottom First
        </Container>
      </React.Fragment>
    );

    const paddingFirst = screen.getByText('Padding First').className;
    const paddingBottomFirst = screen.getByText('PaddingBottom First').className;
    expect(paddingFirst).toEqual(paddingBottomFirst);
  });
});
