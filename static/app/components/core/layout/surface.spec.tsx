import React, {createRef} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Surface} from '@sentry/scraps/layout';

describe('Surface', () => {
  it('renders children', () => {
    render(<Surface>Hello Surface</Surface>);
    expect(screen.getByText('Hello Surface')).toBeInTheDocument();
  });

  it('passes attributes to the underlying element', () => {
    render(<Surface data-test-id="surface">Hello</Surface>);
    expect(screen.getByTestId('surface')).toBeInTheDocument();
  });

  it('does not bleed props to the DOM', () => {
    render(
      <Surface variant="overlay" elevation="high" radius="xl">
        Hello
      </Surface>
    );
    expect(screen.getByText('Hello')).not.toHaveAttribute('variant');
    expect(screen.getByText('Hello')).not.toHaveAttribute('elevation');
    expect(screen.getByText('Hello')).not.toHaveAttribute('radius');
  });

  it('attaches ref to the underlying element', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Surface ref={ref}>Hello</Surface>);
    expect(ref.current).toBeInTheDocument();
    expect(ref.current?.tagName).toBe('DIV');
  });

  it('reuses class names for the same props', () => {
    render(
      <React.Fragment>
        <Surface variant="primary" radius="md">
          First
        </Surface>
        <Surface variant="primary" radius="md">
          Second
        </Surface>
      </React.Fragment>
    );

    const first = screen.getByText('First').className;
    const second = screen.getByText('Second').className;
    expect(first).toEqual(second);
  });

  it('applies different class names for different variants', () => {
    render(
      <React.Fragment>
        <Surface variant="primary">Primary</Surface>
        <Surface variant="secondary">Secondary</Surface>
        <Surface variant="overlay">Overlay</Surface>
      </React.Fragment>
    );

    const primary = screen.getByText('Primary').className;
    const secondary = screen.getByText('Secondary').className;
    const overlay = screen.getByText('Overlay').className;

    expect(primary).not.toEqual(secondary);
    expect(primary).not.toEqual(overlay);
    expect(secondary).not.toEqual(overlay);
  });

  it('applies different class names for different elevations', () => {
    render(
      <React.Fragment>
        <Surface variant="overlay" elevation="low">
          Low
        </Surface>
        <Surface variant="overlay" elevation="medium">
          Medium
        </Surface>
        <Surface variant="overlay" elevation="high">
          High
        </Surface>
      </React.Fragment>
    );

    const low = screen.getByText('Low').className;
    const medium = screen.getByText('Medium').className;
    const high = screen.getByText('High').className;
    expect(low).not.toEqual(high);
    expect(medium).not.toEqual(high);
  });
});
