import React, {createRef} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Flex} from 'sentry/components/core/layout/flex';

describe('Flex', () => {
  it('renders children', () => {
    render(<Flex>Hello</Flex>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
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
});
