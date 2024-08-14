import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {useSort} from 'sentry/views/explore/hooks/useSort';
import {RouteContext} from 'sentry/views/routeContext';

describe('useSort', function () {
  it('allows changing sort', function () {
    let sort, setSort;

    const fields = ['id', 'timestamp'];

    function TestPage() {
      [sort, setSort] = useSort({fields});
      return null;
    }

    const memoryHistory = createMemoryHistory();

    render(
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/" component={TestPage} />
      </Router>
    );

    expect(sort).toEqual({
      direction: 'desc',
      field: 'timestamp',
    }); // default

    act(() =>
      setSort({
        direction: 'asc',
        field: 'timestamp',
      })
    );
    expect(sort).toEqual({
      direction: 'asc',
      field: 'timestamp',
    });

    act(() =>
      setSort({
        direction: 'desc',
        field: 'id',
      })
    );
    expect(sort).toEqual({
      direction: 'desc',
      field: 'id',
    });

    act(() =>
      setSort({
        direction: 'asc',
        field: 'foo',
      })
    );
    expect(sort).toEqual({
      direction: 'asc',
      field: 'id',
    });
  });
});
