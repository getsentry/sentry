import {useState} from 'react';
import {parseAsString, useQueryState, useQueryStates} from 'nuqs';

import {SentryNuqsTestingAdapter} from 'sentry-test/nuqsTestingAdapter';
import {
  act,
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {useTraceItemDatasetAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';

jest.mock('sentry/views/explore/hooks/useTraceItemAttributes');

describe('SentryNuqsTestingAdapter', () => {
  it('supports automatic mocks alongside real query state', async () => {
    expect(jest.isMockFunction(useTraceItemDatasetAttributes)).toBe(true);

    function QueryStateButton() {
      const [query, setQuery] = useQueryState('query', parseAsString);
      return <button onClick={() => setQuery('updated')}>{query}</button>;
    }

    const {router} = render(<QueryStateButton />, {
      initialRouterConfig: {
        location: {pathname: '/test', query: {query: 'initial'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'initial'}));
    expect(await screen.findByRole('button', {name: 'updated'})).toBeInTheDocument();
    expect(router.location.query.query).toBe('updated');
  });

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

  it('preserves child state when the URL update callback changes', async () => {
    function TestComponent() {
      const [count, setCount] = useState(0);
      const [, setSearch] = useQueryState('query', parseAsString);
      return (
        <div>
          <button onClick={() => setCount(value => value + 1)}>Count: {count}</button>
          <button onClick={() => setSearch('updated')}>Update</button>
        </div>
      );
    }

    const firstCallback = jest.fn();
    const secondCallback = jest.fn();
    const {rerender} = render(
      <SentryNuqsTestingAdapter onUrlUpdate={firstCallback}>
        <TestComponent />
      </SentryNuqsTestingAdapter>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Count: 0'}));

    rerender(
      <SentryNuqsTestingAdapter onUrlUpdate={secondCallback}>
        <TestComponent />
      </SentryNuqsTestingAdapter>
    );

    expect(screen.getByRole('button', {name: 'Count: 1'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Update'}));
    await waitFor(() => expect(secondCallback).toHaveBeenCalledTimes(1));
    expect(firstCallback).not.toHaveBeenCalled();
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

  describe('queued URL updates', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
    });

    it('keeps setters stable when the router query changes', () => {
      const parsers = {query: parseAsString};
      const {result, router} = renderHookWithProviders(() => useQueryStates(parsers), {
        initialRouterConfig: {
          location: {pathname: '/test', query: {query: 'initial'}},
        },
      });
      const setQuery = result.current[1];

      router.navigate('/test?query=updated');

      expect(result.current[0]).toEqual({query: 'updated'});
      expect(result.current[1]).toBe(setQuery);
    });

    it('preserves earlier URL updates before React commits the navigation', () => {
      const {result, router} = renderHookWithProviders(
        () => {
          const [, setDisplayType] = useQueryState('displayType', parseAsString);
          const [, setSort] = useQueryState('sort', parseAsString);
          return {setDisplayType, setSort};
        },
        {
          initialRouterConfig: {
            location: {pathname: '/test', query: {displayType: 'table'}},
          },
        }
      );

      act(() => {
        result.current.setDisplayType('area');
        jest.advanceTimersByTime(0);

        // Flush another key while React still has the previous location.
        result.current.setSort('-count()');
        jest.advanceTimersByTime(0);
      });

      expect(router.location.query).toEqual({displayType: 'area', sort: '-count()'});
    });

    it('preserves the new pathname and query before React commits navigation', () => {
      const {result, router} = renderHookWithProviders(
        () => useQueryState('sort', parseAsString),
        {
          initialRouterConfig: {
            location: {pathname: '/test', query: {displayType: 'table'}},
          },
        }
      );

      act(() => {
        router.navigate('/next?displayType=area');
        result.current[1]('-count()');
        jest.advanceTimersByTime(0);
      });

      expect(router.location.pathname).toBe('/next');
      expect(router.location.query).toEqual({displayType: 'area', sort: '-count()'});
    });
  });
});
