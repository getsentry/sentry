import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render as rtlRender, screen, within} from '@testing-library/react';

import {lightTheme} from '@sentry/scraps/theme';

function render(ui: React.ReactNode) {
  return rtlRender(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);
}

import {AvatarButton} from '@sentry/scraps/avatarButton';

describe('AvatarButton', () => {
  it('renders letter avatar initials inside the button', () => {
    render(
      <AvatarButton
        aria-label="Open profile"
        avatar={{identifier: 'test-id', name: 'Test User'}}
      />
    );

    const button = screen.getByRole('button', {name: 'Open profile'});
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('TU');
  });

  it('renders image avatar inside the button', () => {
    render(
      <AvatarButton
        aria-label="Open profile"
        avatar={{
          identifier: 'test-id',
          name: 'Test User',
          src: 'https://example.com/avatar.jpg',
        }}
      />
    );

    const button = screen.getByRole('button', {name: 'Open profile'});
    expect(button).toBeInTheDocument();
    expect(within(button).queryByRole('img', {name: 'Test User'})).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg'
    );
  });

  it('renders a placeholder icon when no avatar is provided', () => {
    render(<AvatarButton aria-label="Assign" />);

    const button = screen.getByRole('button', {name: 'Assign'});
    expect(button).toBeInTheDocument();
    expect(
      within(button).queryByRole('img', {name: 'Test User'})
    ).not.toBeInTheDocument();
  });

  it('renders a suggested letter avatar without throwing', () => {
    render(
      <AvatarButton
        aria-label="Suggested assignee"
        avatar={{
          identifier: 'test-id',
          name: 'Test User',
          suggested: true,
        }}
      />
    );

    const button = screen.getByRole('button', {name: 'Suggested assignee'});
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('TU');
  });

  it('accepts a round shape override', () => {
    render(
      <AvatarButton
        aria-label="Open profile"
        round
        avatar={{identifier: 'test-id', name: 'Test User'}}
      />
    );

    expect(screen.getByRole('button', {name: 'Open profile'})).toBeInTheDocument();
  });
});

it('allows an explicit fallback monogram in the button', () => {
  render(
    <AvatarButton
      aria-label="Open profile"
      avatar={{identifier: 'test-id', name: 'Test User', initials: 'AB'}}
    />
  );
  expect(screen.getByRole('button', {name: 'Open profile'})).toHaveTextContent('AB');
});
