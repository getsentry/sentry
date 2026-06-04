import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {NoRowRenderer} from 'sentry/views/explore/replays/detail/noRowRenderer';

const children = 'No logs yet';

describe('NoRowRenderer', () => {
  it('renders children when unfilteredItems is empty', () => {
    render(
      <NoRowRenderer unfilteredItems={[]} clearSearchTerm={jest.fn()}>
        {children}
      </NoRowRenderer>
    );

    expect(screen.getByText('No logs yet')).toBeInTheDocument();
    expect(screen.queryByText('No results found')).not.toBeInTheDocument();
  });

  it('renders no results state when unfilteredItems has items', () => {
    render(
      <NoRowRenderer unfilteredItems={[{id: 1}]} clearSearchTerm={jest.fn()}>
        {children}
      </NoRowRenderer>
    );

    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Clear filters'})).toBeInTheDocument();
    expect(screen.queryByText('No logs yet')).not.toBeInTheDocument();
  });

  it('calls clearSearchTerm when Clear filters is clicked', async () => {
    const clearSearchTerm = jest.fn();
    render(
      <NoRowRenderer unfilteredItems={[{id: 1}]} clearSearchTerm={clearSearchTerm}>
        {children}
      </NoRowRenderer>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Clear filters'}));

    expect(clearSearchTerm).toHaveBeenCalledTimes(1);
  });

  it('uses hasUnfilteredItems prop over unfilteredItems array length', () => {
    render(
      <NoRowRenderer unfilteredItems={[]} hasUnfilteredItems clearSearchTerm={jest.fn()}>
        {children}
      </NoRowRenderer>
    );

    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.queryByText('No logs yet')).not.toBeInTheDocument();
  });

  it('renders children when hasUnfilteredItems is false even with items in array', () => {
    render(
      <NoRowRenderer
        unfilteredItems={[{id: 1}]}
        hasUnfilteredItems={false}
        clearSearchTerm={jest.fn()}
      >
        {children}
      </NoRowRenderer>
    );

    expect(screen.getByText('No logs yet')).toBeInTheDocument();
    expect(screen.queryByText('No results found')).not.toBeInTheDocument();
  });
});
