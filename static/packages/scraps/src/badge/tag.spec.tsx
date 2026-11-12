import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {IconFire} from '@sentry/icons/fire';
import {render, screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {Tag} from '@sentry/scraps/badge';
import {lightTheme} from '@sentry/scraps/theme';

describe('Tag', () => {
  it('basic', () => {
    render(<Tag variant="muted">Text</Tag>, {wrapper: ThemeWrapper});
    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('with icon', () => {
    render(
      <Tag icon={<IconFire data-test-id="icon-fire" />} variant="danger">
        Error
      </Tag>,
      {wrapper: ThemeWrapper}
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByTestId('icon-fire')).toBeInTheDocument();
  });

  it('with dismiss', async () => {
    const mockCallback = jest.fn();

    render(
      <Tag variant="info" onDismiss={mockCallback}>
        Dismissable
      </Tag>,
      {wrapper: ThemeWrapper}
    );
    expect(screen.getByText('Dismissable')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Dismiss'})).toBeInTheDocument();

    expect(mockCallback).toHaveBeenCalledTimes(0);
    await userEvent.click(screen.getByRole('button', {name: 'Dismiss'}));
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });
});

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}
