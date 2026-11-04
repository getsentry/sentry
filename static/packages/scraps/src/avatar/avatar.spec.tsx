import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {act, render, screen} from '@testing-library/react';

import {lightTheme} from '@sentry/scraps/theme';

import {Avatar} from './index';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('Avatar', () => {
  it('renders initials without a query client or application providers', () => {
    render(<Avatar name="Test User" identifier="test-id" />, {wrapper: ThemeWrapper});
    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('uses resolved URLs without applying an application size query', () => {
    render(
      <Avatar
        name="Test User"
        identifier="test-id"
        src="https://example.com/photo?v=1"
      />,
      {wrapper: ThemeWrapper}
    );
    expect(screen.getByRole('img', {name: 'Test User'})).toHaveAttribute(
      'src',
      'https://example.com/photo?v=1'
    );
  });

  it('falls back after an image error and tries a changed URL', () => {
    const {rerender} = render(
      <Avatar name="Test User" identifier="test-id" src="https://example.com/old" />,
      {wrapper: ThemeWrapper}
    );
    const image = screen.getByRole('img', {name: 'Test User'});
    act(() => image.dispatchEvent(new Event('error')));
    expect(screen.getByText('TU')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    rerender(
      <Avatar name="Test User" identifier="test-id" src="https://example.com/new" />
    );
    expect(screen.getByRole('img', {name: 'Test User'})).toHaveAttribute(
      'src',
      'https://example.com/new'
    );
    // An event on a detached former image must not mark the new URL as failed.
    act(() => image.dispatchEvent(new Event('error')));
    expect(screen.getByRole('img', {name: 'Test User'})).toHaveAttribute(
      'src',
      'https://example.com/new'
    );
  });
});

it('treats names literally without interpreting application scrub markers', () => {
  render(<Avatar name="[Filtered]" identifier="test-id" />, {wrapper: ThemeWrapper});
  expect(screen.getByText('[')).toBeInTheDocument();
});

it('uses explicit fallback initials without replacing the image accessible name', () => {
  render(
    <Avatar
      name="Test User"
      identifier="test-id"
      initials="AB"
      src="https://example.com/avatar"
    />,
    {wrapper: ThemeWrapper}
  );
  const image = screen.getByRole('img', {name: 'Test User'});
  act(() => image.dispatchEvent(new Event('error')));
  expect(screen.getByText('AB')).toBeInTheDocument();
});
