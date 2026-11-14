import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {Alert} from '@sentry/scraps/alert';
import {lightTheme} from '@sentry/scraps/theme';

describe('Alert', () => {
  it('renders icon by default', () => {
    render(<Alert variant="info">Hello</Alert>, {wrapper: ThemeWrapper});
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  describe('expandable', () => {
    it('does not render expand text by default', async () => {
      render(
        <Alert variant="info" expand={<div>More stuff here</div>}>
          Hello
        </Alert>,
        {wrapper: ThemeWrapper}
      );

      expect(screen.queryByText('More stuff here')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Expand'}));
      expect(screen.getByText('More stuff here')).toBeInTheDocument();
    });

    it('renders expand text when defaultExpanded is true', () => {
      render(
        <Alert variant="info" defaultExpanded expand={<div>More stuff here</div>}>
          Hello
        </Alert>,
        {wrapper: ThemeWrapper}
      );

      expect(screen.getByText('More stuff here')).toBeInTheDocument();
    });
  });
});

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}
