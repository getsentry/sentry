import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {lightTheme} from '@sentry/scraps/theme';

import {EmptyState} from './index';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState title="No results found" description="Try adjusting your search." />,
      {wrapper: ThemeWrapper}
    );
    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search.')).toBeInTheDocument();
  });

  it('renders title only', () => {
    render(<EmptyState title="Nothing here" />, {wrapper: ThemeWrapper});
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders illustration', () => {
    render(
      <EmptyState
        title="Connect a repository"
        illustration={<img src="test.svg" alt="test" />}
      />,
      {wrapper: ThemeWrapper}
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders action', () => {
    render(
      <EmptyState
        title="Connect a repository"
        action={<button>Add repository</button>}
      />,
      {wrapper: ThemeWrapper}
    );
    expect(screen.getByRole('button', {name: 'Add repository'})).toBeInTheDocument();
  });

  it('renders all props together', () => {
    render(
      <EmptyState
        title="Connect a repository"
        description="Autofix requires a connected repo."
        illustration={<img src="test.svg" alt="illo" />}
        action={<button>Add</button>}
      />,
      {wrapper: ThemeWrapper}
    );
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('Connect a repository')).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add'})).toBeInTheDocument();
  });
});
