import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {AlertLink} from '@sentry/scraps/alert';
import {lightTheme} from '@sentry/scraps/theme';

describe('AlertLink', () => {
  it('renders internal link pointing to the correct path', () => {
    render(
      <AlertLink variant="info" to="/settings/accounts/notifications">
        This is an internal link button
      </AlertLink>,
      {wrapper: ThemeWrapper}
    );

    expect(
      screen.getByRole('link', {name: 'This is an internal link button'})
    ).toHaveAttribute('href', '/settings/accounts/notifications');
  });

  it('link has rel="noopener noreferrer" and target="_blank" when openInNewTab is true', () => {
    render(
      <AlertLink variant="info" href="https://example.com" openInNewTab>
        This is an external link button
      </AlertLink>,
      {wrapper: ThemeWrapper}
    );

    const link = screen.getByRole('link', {
      name: 'This is an external link button',
    });

    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('does not have rel="noopener noreferrer" and target="_blank" when openInNewTab is not set', () => {
    render(
      <AlertLink variant="info" href="https://example.com" openInNewTab={false}>
        This is an external link button
      </AlertLink>,
      {wrapper: ThemeWrapper}
    );

    const link = screen.getByRole('link', {
      name: 'This is an external link button',
    });

    expect(link).not.toHaveAttribute('target', '_blank');
    expect(link).not.toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('fires onClick when clicked', async () => {
    const onClick = jest.fn();

    render(
      <AlertLink variant="info" onClick={onClick}>
        This is an external link button
      </AlertLink>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByText('This is an external link button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('renders a custom trailing item', () => {
    render(
      <AlertLink
        variant="info"
        to="/settings/accounts/notifications"
        trailingItems="custom trailing item"
      >
        This is an external link button
      </AlertLink>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByText('custom trailing item')).toBeInTheDocument();
  });
});

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}
