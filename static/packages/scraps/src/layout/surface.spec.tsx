import type * as React from 'react';
import {createRef, Fragment} from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {Surface} from '@sentry/scraps/layout';
import {lightTheme} from '@sentry/scraps/theme';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('Surface', () => {
  it('renders children', () => {
    render(<Surface>Hello Surface</Surface>, {wrapper: ThemeWrapper});
    expect(screen.getByText('Hello Surface')).toBeInTheDocument();
  });

  it('passes attributes to the underlying element', () => {
    render(<Surface data-test-id="surface">Hello</Surface>, {wrapper: ThemeWrapper});
    expect(screen.getByTestId('surface')).toBeInTheDocument();
  });

  it('does not bleed props to the DOM', () => {
    render(
      <Surface variant="overlay" elevation="high" radius="xl">
        Hello
      </Surface>,
      {wrapper: ThemeWrapper}
    );
    expect(screen.getByText('Hello')).not.toHaveAttribute('variant');
    expect(screen.getByText('Hello')).not.toHaveAttribute('elevation');
    expect(screen.getByText('Hello')).not.toHaveAttribute('radius');
  });

  it('attaches ref to the underlying element', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Surface ref={ref}>Hello</Surface>, {wrapper: ThemeWrapper});
    expect(ref.current).toBeInTheDocument();
    expect(ref.current?.tagName).toBe('DIV');
  });

  it('reuses class names for the same props', () => {
    render(
      <Fragment>
        <Surface variant="primary" radius="md">
          First
        </Surface>
        <Surface variant="primary" radius="md">
          Second
        </Surface>
      </Fragment>,
      {wrapper: ThemeWrapper}
    );

    const first = screen.getByText('First').className;
    const second = screen.getByText('Second').className;
    expect(first).toEqual(second);
  });

  it('forwards background styles for different variants', () => {
    render(
      <Fragment>
        <Surface variant="primary">{props => <div {...props}>Primary</div>}</Surface>
        <Surface variant="secondary">{props => <div {...props}>Secondary</div>}</Surface>
        <Surface variant="overlay">{props => <div {...props}>Overlay</div>}</Surface>
      </Fragment>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByText('Primary')).toHaveStyle({
      background: lightTheme.tokens.background.primary,
    });
    expect(screen.getByText('Secondary')).toHaveStyle({
      background: lightTheme.tokens.background.secondary,
    });
    expect(screen.getByText('Overlay')).toHaveStyle({
      background: lightTheme.tokens.background.overlay,
    });
  });

  it('forwards shadow styles for different elevations', () => {
    render(
      <Fragment>
        <Surface variant="overlay" elevation="low">
          {props => <div {...props}>Low</div>}
        </Surface>
        <Surface variant="overlay" elevation="medium">
          {props => <div {...props}>Medium</div>}
        </Surface>
        <Surface variant="overlay" elevation="high">
          {props => <div {...props}>High</div>}
        </Surface>
      </Fragment>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByText('Low').style.boxShadow).toBe(lightTheme.shadow.low);
    expect(screen.getByText('Medium').style.boxShadow).toBe(lightTheme.shadow.medium);
    expect(screen.getByText('High').style.boxShadow).toBe(lightTheme.shadow.high);
  });
});
