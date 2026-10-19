import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {lightTheme} from '@sentry/scraps/theme';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('StatusIndicator', () => {
  it('is hidden from the accessibility tree when no aria-label is provided', () => {
    render(<StatusIndicator variant="accent" data-test-id="dot" />, {
      wrapper: ThemeWrapper,
    });
    expect(screen.getByTestId('dot')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has role="img" and aria-label when aria-label is provided', () => {
    render(<StatusIndicator variant="accent" aria-label="Online" data-test-id="dot" />, {
      wrapper: ThemeWrapper,
    });
    const dot = screen.getByRole('img', {name: 'Online'});
    expect(dot).toBeInTheDocument();
    expect(dot).not.toHaveAttribute('aria-hidden');
  });

  it('respects an explicit role override alongside aria-label', () => {
    render(
      <StatusIndicator
        variant="accent"
        role="status"
        aria-label="Authentication Method Active"
        data-test-id="dot"
      />,
      {wrapper: ThemeWrapper}
    );
    const dot = screen.getByRole('status', {name: 'Authentication Method Active'});
    expect(dot).toBeInTheDocument();
    expect(dot).not.toHaveAttribute('aria-hidden');
  });

  it('accepts a finite animation iteration count without passing styling props to the DOM', () => {
    render(
      <StatusIndicator variant="accent" animationIterationCount={3} data-test-id="dot" />,
      {wrapper: ThemeWrapper}
    );

    const dot = screen.getByTestId('dot');
    expect(dot).not.toHaveAttribute('animationIterationCount');
    expect(dot).not.toHaveAttribute('variant');
  });
});
