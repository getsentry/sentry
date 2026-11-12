import {useLayoutEffect, useReducer, useState} from 'react';
import {parseAsString, useQueryState, useQueryStates} from 'nuqs';

import {SentryNuqsTestingAdapter} from 'sentry-test/nuqsTestingAdapter';
import {
  act,
  cleanup,
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useTraceItemDatasetAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';

jest.mock('sentry/views/explore/hooks/useTraceItemAttributes');

describe('SentryNuqsTestingAdapter', () => {
  it('supports automatic mocks alongside real query state', async () => {
    expect(jest.isMockFunction(useTraceItemDatasetAttributes)).toBe(true);

    function QueryStateButton() {
      const [query, setQuery] = useQueryState('query', parseAsString);
      return <Button onClick={() => setQuery('updated')}>{query}</Button>;
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

  it('keeps a written value when React renders before the router commits it', async () => {
    const committedQueries: Array<[number, unknown, string | null]> = [];
    function TestComponent() {
      const location = useLocation();
      const [query, setQuery] = useQueryState('query', parseAsString);
      const [renders, rerender] = useReducer((count: number) => count + 1, 0);
      useLayoutEffect(() => {
        committedQueries.push([renders, location.query.query, query]);
      });
      return (
        <div>
          <div>Forced renders: {renders}</div>
          <div>Location: {location.query.query}</div>
          <button
            onClick={() => {
              setQuery('updated');
              setTimeout(rerender, 0);
            }}
          >
            {query}
          </button>
        </div>
      );
    }

    render(<TestComponent />, {
      initialRouterConfig: {
        location: {pathname: '/test', query: {query: 'initial'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'initial'}));
    await screen.findByText('Forced renders: 1');
    await screen.findByText('Location: updated');

    expect(committedQueries).toContainEqual([1, 'initial', 'updated']);
    expect(committedQueries.filter(([, , query]) => query === 'initial')).toEqual([
      [0, 'initial', 'initial'],
    ]);
  });

  it('keeps earlier writes when a later write flushes before React renders', async () => {
    const committedQueries: Array<[string | null, string | null]> = [];
    function TestComponent() {
      const location = useLocation();
      const [first, setFirst] = useQueryState('first', parseAsString);
      const [second, setSecond] = useQueryState('second', parseAsString);
      const [renders, rerender] = useReducer((count: number) => count + 1, 0);
      useLayoutEffect(() => {
        committedQueries.push([first, second]);
      });
      return (
        <div>
          <div>Location: {location.search}</div>
          <button
            onClick={async () => {
              await setFirst('1');
              setSecond('2');
              setTimeout(rerender, 0);
            }}
          >
            Forced renders: {renders}
          </button>
        </div>
      );
    }

    render(<TestComponent />, {
      initialRouterConfig: {location: {pathname: '/test'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Forced renders: 0'}));
    await screen.findByRole('button', {name: 'Forced renders: 1'});
    await screen.findByText('Location: ?first=1&second=2');

    const firstWrittenIndex = committedQueries.findIndex(([first]) => first === '1');
    expect(
      committedQueries.slice(firstWrittenIndex).map(([first]) => first)
    ).not.toContain(null);
    expect(committedQueries.at(-1)).toEqual(['1', '2']);
  });

  it('reads a router navigation that follows a write', async () => {
    function TestComponent() {
      const [query, setQuery] = useQueryState('query', parseAsString);
      return <button onClick={() => setQuery('updated')}>{query}</button>;
    }

    const {router} = render(<TestComponent />, {
      initialRouterConfig: {
        location: {pathname: '/test', query: {query: 'initial'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'initial'}));
    await screen.findByRole('button', {name: 'updated'});
    router.navigate('/test?query=navigated');

    expect(await screen.findByRole('button', {name: 'navigated'})).toBeInTheDocument();
  });

  it('reads the previous URL when navigating back after a pushed write', async () => {
    function TestComponent() {
      const [query, setQuery] = useQueryState('query', parseAsString);
      return (
        <button onClick={() => setQuery('updated', {history: 'push'})}>{query}</button>
      );
    }

    const {router} = render(<TestComponent />, {
      initialRouterConfig: {
        location: {pathname: '/test', query: {query: 'initial'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'initial'}));
    await screen.findByRole('button', {name: 'updated'});
    router.navigate(-1);

    expect(await screen.findByRole('button', {name: 'initial'})).toBeInTheDocument();
  });

  it('reads the previous URL in a remounted consumer after navigating back', async () => {
    function TabSetter() {
      const [tab, setTab] = useQueryState('tab', parseAsString);
      return <button onClick={() => setTab('b', {history: 'push'})}>Tab: {tab}</button>;
    }
    function TestComponent() {
      const location = useLocation();
      return location.query.tab === 'b' ? <div>Other view</div> : <TabSetter />;
    }

    const {router} = render(<TestComponent />, {
      initialRouterConfig: {
        location: {pathname: '/test', query: {tab: 'a'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Tab: a'}));
    await screen.findByText('Other view');
    router.navigate(-1);

    expect(await screen.findByRole('button', {name: 'Tab: a'})).toBeInTheDocument();
  });

  it('reads a router navigation in the same render as the location', async () => {
    const committedQueries: Array<[number, unknown, string | null]> = [];
    function TestComponent() {
      const location = useLocation();
      const navigate = useNavigate();
      const [query] = useQueryState('query', parseAsString);
      const [renders, rerender] = useReducer((count: number) => count + 1, 0);
      useLayoutEffect(() => {
        committedQueries.push([renders, location.query.query, query]);
      });
      return (
        <button
          onClick={() => {
            setTimeout(() => navigate('/test?query=navigated'), 0);
            setTimeout(rerender, 0);
          }}
        >
          Forced renders: {renders}
        </button>
      );
    }

    render(<TestComponent />, {
      initialRouterConfig: {
        location: {pathname: '/test', query: {query: 'initial'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Forced renders: 0'}));
    await waitFor(() =>
      expect(committedQueries.at(-1)).toEqual([1, 'navigated', 'navigated'])
    );

    expect(committedQueries).toContainEqual([1, 'initial', 'initial']);
    expect(
      committedQueries.filter(([, fromLocation, fromNuqs]) => fromLocation !== fromNuqs)
    ).toEqual([]);
  });

  it('reads a forward navigation to a written URL in the same render as the location', async () => {
    const committedQueries: Array<[number, unknown, string | null]> = [];
    function TestComponent() {
      const location = useLocation();
      const navigate = useNavigate();
      const [query, setQuery] = useQueryState('query', parseAsString);
      const [renders, rerender] = useReducer((count: number) => count + 1, 0);
      useLayoutEffect(() => {
        committedQueries.push([renders, location.query.query, query]);
      });
      return (
        <div>
          <button onClick={() => setQuery('updated', {history: 'push'})}>Write</button>
          <button
            onClick={() => {
              setTimeout(() => navigate(1), 0);
              setTimeout(rerender, 0);
            }}
          >
            Forward
          </button>
        </div>
      );
    }

    const {router} = render(<TestComponent />, {
      initialRouterConfig: {
        location: {pathname: '/test', query: {query: 'initial'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Write'}));
    await waitFor(() => expect(router.location.query.query).toBe('updated'));
    router.navigate(-1);
    committedQueries.length = 0;
    await userEvent.click(screen.getByRole('button', {name: 'Forward'}));
    await waitFor(() =>
      expect(committedQueries.at(-1)).toEqual([1, 'updated', 'updated'])
    );

    expect(committedQueries).toContainEqual([1, 'initial', 'initial']);
    expect(
      committedQueries.filter(([, fromLocation, fromNuqs]) => fromLocation !== fromNuqs)
    ).toEqual([]);
  });

  it('keeps the location hash and state when writing', async () => {
    function TestComponent() {
      const [query, setQuery] = useQueryState('query', parseAsString);
      return <button onClick={() => setQuery('updated')}>{query}</button>;
    }

    const {router} = render(<TestComponent />, {
      initialRouterConfig: {
        location: {pathname: '/test'},
      },
    });
    router.navigate('/test?query=initial#details', {state: {from: 'list'}});

    await userEvent.click(screen.getByRole('button', {name: 'initial'}));
    await screen.findByRole('button', {name: 'updated'});

    expect(router.location).toEqual(
      expect.objectContaining({
        hash: '#details',
        search: '?query=updated',
        state: {from: 'list'},
      })
    );
  });

  describe('queued URL updates', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      try {
        cleanup();
        act(() => {
          jest.runOnlyPendingTimers();
        });
      } finally {
        jest.useRealTimers();
      }
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
