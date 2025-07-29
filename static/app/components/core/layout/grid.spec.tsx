import React, {createRef} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Grid} from 'sentry/components/core/layout/grid';

describe('Grid', () => {
  it('renders children', () => {
    render(<Grid>Hello</Grid>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
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
});
