import {createRef} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Container, Flex} from 'sentry/components/core/layout/flex';

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
      <Flex ref={ref} as="ol">
        Hello
      </Flex>
    );
    expect(ref.current).toBeInTheDocument();
  });
});

describe('Flex', () => {
  it('renders children', () => {
    render(<Flex>Hello</Flex>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('passes attributes to the underlying element', () => {
    render(<Flex data-test-id="flex">Hello</Flex>);
    expect(screen.getByTestId('flex')).toBeInTheDocument();
  });

  it('renders as a different element if specified', () => {
    render(<Flex as="section">Hello</Flex>);
    expect(screen.getByText('Hello').tagName).toBe('SECTION');
  });

  it('does not bleed attributes to the underlying element', () => {
    render(<Flex radius="sm">Hello</Flex>);
    expect(screen.getByText('Hello')).not.toHaveAttribute('radius');
  });

  it('allows setting native html attributes', () => {
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
  });
});
