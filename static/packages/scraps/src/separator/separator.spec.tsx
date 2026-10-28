import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {Separator} from '@sentry/scraps/separator';
import {lightTheme} from '@sentry/scraps/theme';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('Separator', () => {
  it('should render a horizontal Separator', () => {
    render(<Separator orientation="horizontal" />, {wrapper: ThemeWrapper});
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('should render a vertical Separator', () => {
    render(<Separator orientation="vertical" />, {wrapper: ThemeWrapper});
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('does not allow children', () => {
    expect(() =>
      render(
        // @ts-expect-error children are not allowed
        <Separator orientation="horizontal">Hello</Separator>,
        {wrapper: ThemeWrapper}
      )
    ).toThrow();
  });
});
