import React, {createRef} from 'react';
import {expectTypeOf} from 'expect-type';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  Grid,
  type GridProps,
  type GridPropsWithRenderFunction,
} from 'sentry/components/core/layout';

describe('Grid', () => {
  it('renders children', () => {
    render(<Grid>Hello</Grid>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('implements render prop', () => {
    render(
      <section>
        <Grid justify="between">{props => <p {...props}>Hello</p>}</Grid>
      </section>
    );

    expect(screen.getByText('Hello')?.tagName).toBe('P');
    expect(screen.getByText('Hello').parentElement?.tagName).toBe('SECTION');

    expect(screen.getByText('Hello')).not.toHaveAttribute('border', 'primary');
  });

  it('render prop guards against invalid attributes', () => {
    render(
      // @ts-expect-error - aria-activedescendant should be set on the child element
      <Grid justify="between" aria-activedescendant="what">
        {/* @ts-expect-error - this should be a React.ElementType */}
        {props => <p {...props}>Hello</p>}
      </Grid>
    );

    expect(screen.getByText('Hello')).not.toHaveAttribute('aria-activedescendant');
  });

  it('render prop type is correctly inferred', () => {
    // Incompatible className type - should be string
    function Child({className}: {className: 'invalid'}) {
      return <p className={className}>Hello</p>;
    }

    render(
      <Grid justify="between">
        {/* @ts-expect-error - className is incompatible */}
        {props => <Child {...props} />}
      </Grid>
    );
  });

  it('passes attributes to the underlying element', () => {
    render(<Grid data-test-id="container">Hello</Grid>);
    expect(screen.getByTestId('container')).toBeInTheDocument();
  });

  it('renders as a different element if specified', () => {
    render(<Grid as="section">Hello</Grid>);
    expect(screen.getByText('Hello').tagName).toBe('SECTION');
  });

  it('does not bleed attributes to the underlying element', () => {
    render(<Grid radius="sm">Hello</Grid>);
    expect(screen.getByText('Hello')).not.toHaveAttribute('radius');
  });

  it('does not bleed grid attributes to the underlying element', () => {
    render(
      <Grid align="center" justify="center">
        Hello
      </Grid>
    );

    expect(screen.getByText('Hello')).not.toHaveAttribute('align');
    expect(screen.getByText('Hello')).not.toHaveAttribute('justify');
  });

  it('allows settings native html attributes', () => {
    render(<Grid style={{color: 'red'}}>Hello</Grid>);
    expect(screen.getByText('Hello')).toHaveStyle({color: 'red'});
  });

  it('attaches ref to the underlying element', () => {
    const ref = createRef<HTMLOListElement>();
    render(
      <Grid ref={ref} as="ol">
        Hello
      </Grid>
    );
    expect(ref.current).toBeInTheDocument();
    expect(ref.current?.tagName).toBe('OL');
  });

  it('reuses class names for the same props', () => {
    render(
      <React.Fragment>
        <Grid radius="sm" padding="md">
          Padding First
        </Grid>
        <Grid radius="sm" padding="md">
          PaddingBottom First
        </Grid>
      </React.Fragment>
    );

    const paddingFirst = screen.getByText('Padding First').className;
    const paddingBottomFirst = screen.getByText('PaddingBottom First').className;
    expect(paddingFirst).toEqual(paddingBottomFirst);
  });

  describe('types', () => {
    it('default signature limits children to React.ReactNode', () => {
      const props: GridProps<any> = {};
      expectTypeOf(props.children).toEqualTypeOf<React.ReactNode | undefined>();
    });
    it('render prop signature limits children to (props: {className: string}) => React.ReactNode | undefined', () => {
      const props: GridPropsWithRenderFunction<any> = {
        children: () => undefined,
      };
      expectTypeOf(props.children).toEqualTypeOf<
        (props: {className: string}) => React.ReactNode | undefined
      >();
    });
  });
});
