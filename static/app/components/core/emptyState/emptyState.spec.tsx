import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EmptyState} from '@sentry/scraps/emptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState title="No results found" description="Try adjusting your search." />
    );
    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search.')).toBeInTheDocument();
  });

  it('renders title only', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders illustration', () => {
    render(
      <EmptyState
        title="Connect a repository"
        illustration={<img src="test.svg" alt="test" />}
      />
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders action', () => {
    render(
      <EmptyState title="Connect a repository" action={<button>Add repository</button>} />
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
      />
    );
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('Connect a repository')).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add'})).toBeInTheDocument();
  });
});
