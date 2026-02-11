import {parseAsString, useQueryState} from 'nuqs';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

describe('SentryNuqsTestingAdapter', () => {
  it('reads search params from router location', async () => {
    function TestComponent() {
      const [search] = useQueryState('query', parseAsString);
      return <div>Search: {search ?? 'empty'}</div>;
    }

    const {router} = render(<TestComponent />, {
      initialRouterConfig: {
        location: {
          pathname: '/test',
          query: {query: 'hello'},
        },
      },
    });

    expect(screen.getByText('Search: hello')).toBeInTheDocument();

    // Navigate to a new location with different search params
    router.navigate('/test?query=world');

    expect(await screen.findByText('Search: world')).toBeInTheDocument();
  });

  it('updates router location when nuqs state changes', async () => {
    function TestComponent() {
      const [search, setSearch] = useQueryState('query', parseAsString);
      return (
        <div>
          <div>Search: {search ?? 'empty'}</div>
          <button onClick={() => setSearch('updated')}>Update</button>
        </div>
      );
    }

    const {router} = render(<TestComponent />, {
      initialRouterConfig: {
        location: {
          pathname: '/test',
          query: {query: 'initial'},
        },
      },
    });

    expect(screen.getByText('Search: initial')).toBeInTheDocument();

    // Click button to update search param via nuqs
    await userEvent.click(screen.getByRole('button', {name: 'Update'}));

    // Wait for navigation to complete
    await screen.findByText('Search: updated');

    // Verify the router location was updated
    await waitFor(() => {
      expect(router.location.search).toContain('query=updated');
    });
  });

  it('handles multiple query params', () => {
    function TestComponent() {
      const [foo] = useQueryState('foo', parseAsString);
      const [bar] = useQueryState('bar', parseAsString);
      return (
        <div>
          <div>Foo: {foo ?? 'empty'}</div>
          <div>Bar: {bar ?? 'empty'}</div>
        </div>
      );
    }

    render(<TestComponent />, {
      initialRouterConfig: {
        location: {
          pathname: '/test',
          query: {foo: 'value1', bar: 'value2'},
        },
      },
    });

    expect(screen.getByText('Foo: value1')).toBeInTheDocument();
    expect(screen.getByText('Bar: value2')).toBeInTheDocument();
  });

  it('handles missing query params', () => {
    function TestComponent() {
      const [search] = useQueryState('query', parseAsString);
      return <div>Search: {search ?? 'empty'}</div>;
    }

    render(<TestComponent />, {
      initialRouterConfig: {
        location: {
          pathname: '/test',
        },
      },
    });

    expect(screen.getByText('Search: empty')).toBeInTheDocument();
  });
});
