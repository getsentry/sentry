import React, {createRef} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Container, Flex} from 'sentry/components/core/layout/flex';

describe.each([
  ['Container', Container],
  ['Flex', Flex],
])('%s', (_, Component) => {
  it('renders children', () => {
    render(<Component>Hello</Component>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('passes attributes to the underlying element', () => {
    render(<Component data-test-id="container">Hello</Component>);
    expect(screen.getByTestId('container')).toBeInTheDocument();
  });

  it('renders as a different element if specified', () => {
    render(<Component as="section">Hello</Component>);
    expect(screen.getByText('Hello').tagName).toBe('SECTION');
  });

  it('does not bleed attributes to the underlying element', () => {
    render(<Component radius="sm">Hello</Component>);
    expect(screen.getByText('Hello')).not.toHaveAttribute('radius');
  });

  it('allows settings native html attributes', () => {
    render(<Component style={{color: 'red'}}>Hello</Component>);
    expect(screen.getByText('Hello')).toHaveStyle({color: 'red'});
  });

  it('attaches ref to the underlying element', () => {
    const ref = createRef<HTMLOListElement>();
    render(
      <Component ref={ref} as="ol">
        Hello
      </Component>
    );
    expect(ref.current).toBeInTheDocument();
    expect(ref.current?.tagName).toBe('OL');
  });

  it('respects prop order', () => {
    render(
      <React.Fragment>
        <Component radius="sm" padding="md" pb="sm">
          Padding First
        </Component>
        <Component radius="sm" pb="sm" padding="md">
          PaddingBottom First
        </Component>
      </React.Fragment>
    );

    const paddingFirst = screen.getByText('Padding First').className;
    const paddingBottomFirst = screen.getByText('PaddingBottom First').className;
    expect(paddingFirst).not.toEqual(paddingBottomFirst);
  });
});

describe('Flex', () => {
  it('does not bleed flex attributes to the underlying element', () => {
    render(
      <Flex align="center" justify="center">
        Hello
      </Flex>
    );

    expect(screen.getByText('Hello')).not.toHaveAttribute('align');
    expect(screen.getByText('Hello')).not.toHaveAttribute('justify');
  });
});
