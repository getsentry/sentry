import {ReactNode} from 'react';
import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useProfileEventsSort} from 'sentry/utils/profiling/hooks/useProfileEventsSort';
import {RouteContext} from 'sentry/views/routeContext';

function createTestContext(route: string) {
  return function ({children}: {children?: ReactNode}) {
    function DummyPage() {
      return <div>{children}</div>;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push(route);

    return (
      <Router
        history={memoryHistory}
        render={props => (
          <RouteContext.Provider value={props}>
            <RouterContext {...props} />
          </RouteContext.Provider>
        )}
      >
        <Route path="/" component={DummyPage} />
      </Router>
    );
  };
}

describe('useProfileEventsSort', function () {
  it('uses the desc default', function () {
    const {result} = reactHooks.renderHook(useProfileEventsSort, {
      wrapper: createTestContext('/'),
      initialProps: {
        allowedKeys: ['count()'],
        fallback: {
          key: 'count()',
          order: 'desc' as const,
        },
        key: 'sort',
      },
    });

    expect(result.current).toEqual({
      key: 'count()',
      order: 'desc',
    });
  });

  it('uses the asc default', function () {
    const {result} = reactHooks.renderHook(useProfileEventsSort, {
      wrapper: createTestContext('/'),
      initialProps: {
        allowedKeys: ['count()'],
        fallback: {
          key: 'count()',
          order: 'asc' as const,
        },
        key: 'sort',
      },
    });

    expect(result.current).toEqual({
      key: 'count()',
      order: 'asc',
    });
  });

  it('uses the asc from qs', function () {
    const {result} = reactHooks.renderHook(useProfileEventsSort, {
      wrapper: createTestContext('/?sort=p95()'),
      initialProps: {
        allowedKeys: ['p95()', 'count()'],
        fallback: {
          key: 'count()',
          order: 'asc' as const,
        },
        key: 'sort',
      },
    });

    expect(result.current).toEqual({
      key: 'p95()',
      order: 'asc',
    });
  });

  it('uses the desc from qs', function () {
    const {result} = reactHooks.renderHook(useProfileEventsSort, {
      wrapper: createTestContext('/?sort=-p95()'),
      initialProps: {
        allowedKeys: ['p95()', 'count()'],
        fallback: {
          key: 'count()',
          order: 'asc' as const,
        },
        key: 'sort',
      },
    });

    expect(result.current).toEqual({
      key: 'p95()',
      order: 'desc',
    });
  });
});
