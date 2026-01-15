import React, {createRef} from 'react';
import {expectTypeOf} from 'expect-type';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Stack, type StackProps} from 'sentry/components/core/layout/stack';

describe('Stack', () => {
  it('renders children', () => {
    render(<Stack>Hello</Stack>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('implements render prop', () => {
    render(
      <section>
        <Stack justify="between">{props => <p {...props}>Hello</p>}</Stack>
      </section>
    );

    expect(screen.getByText('Hello')?.tagName).toBe('P');
    expect(screen.getByText('Hello').parentElement?.tagName).toBe('SECTION');
  });

  it('render prop guards against invalid attributes', () => {
    render(
      // @ts-expect-error - aria-activedescendant should be set on the child element
      <Stack justify="between" aria-activedescendant="what">
        {/* @ts-expect-error - this should be a React.ElementType */}
        {props => <p {...props}>Hello</p>}
      </Stack>
    );

    expect(screen.getByText('Hello')).not.toHaveAttribute('aria-activedescendant');
  });

  it('render prop type is correctly inferred', () => {
    // Incompatible className type - should be string
    function Child({className}: {className: 'invalid'}) {
      return <p className={className}>Hello</p>;
    }

    render(
      <Stack justify="between" padding="md">
        {/* @ts-expect-error - className is incompatible */}
        {props => <Child {...props} />}
      </Stack>
    );
  });

  it('passes attributes to the underlying element', () => {
    render(<Stack data-test-id="container">Hello</Stack>);
    expect(screen.getByTestId('container')).toBeInTheDocument();
  });

  it('renders as a different element if specified', () => {
    render(<Stack as="section">Hello</Stack>);
    expect(screen.getByText('Hello').tagName).toBe('SECTION');
  });

  it('does not bleed attributes to the underlying element', () => {
    render(<Stack radius="sm">Hello</Stack>);
    expect(screen.getByText('Hello')).not.toHaveAttribute('radius');
  });

  it('does not bleed stack attributes to the underlying element', () => {
    render(
      <Stack align="center" justify="center" gap="md">
        Hello
      </Stack>
    );

    expect(screen.getByText('Hello')).not.toHaveAttribute('align');
    expect(screen.getByText('Hello')).not.toHaveAttribute('justify');
    expect(screen.getByText('Hello')).not.toHaveAttribute('gap');
    expect(screen.getByText('Hello')).not.toHaveAttribute('direction');
  });

  it('allows settings native html attributes', () => {
    render(<Stack style={{color: 'red'}}>Hello</Stack>);
    expect(screen.getByText('Hello')).toHaveStyle({color: 'red'});
  });

  it('as=label props are correctly inferred', () => {
    render(
      <Stack as="label" htmlFor="test-id">
        Hello World
      </Stack>
    );
    expectTypeOf<StackProps<'label'>>().toHaveProperty('htmlFor');
  });

  it('attaches ref to the underlying element', () => {
    const ref = createRef<HTMLOListElement>();
    render(
      <Stack ref={ref} as="ol">
        Hello
      </Stack>
    );
    expect(ref.current).toBeInTheDocument();
    expect(ref.current?.tagName).toBe('OL');
  });

  it('reuses class names for the same props', () => {
    render(
      <React.Fragment>
        <Stack radius="sm" padding="md">
          First Stack
        </Stack>
        <Stack radius="sm" padding="md">
          Second Stack
        </Stack>
      </React.Fragment>
    );

    const firstStack = screen.getByText('First Stack').className;
    const secondStack = screen.getByText('Second Stack').className;
    expect(firstStack).toEqual(secondStack);
  });

  it('row orientation = vertical separator', () => {
    render(
      <Stack direction="row">
        <div>Item 1</div>
        <Stack.Separator />
      </Stack>
    );

    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('column orientation = horizontal separator', () => {
    render(
      <Stack direction="column">
        <div>Item 1</div>
        <Stack.Separator />
      </Stack>
    );

    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-orientation',
      'horizontal'
    );
  });
});
