import React, {createRef} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Container} from 'sentry/components/core/layout/container';

describe('Container', () => {
  it('renders children', () => {
    render(<Container>Hello</Container>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
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
