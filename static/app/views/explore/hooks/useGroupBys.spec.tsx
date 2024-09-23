// biome-ignore lint/nursery/noRestrictedImports: Will be removed with react router 6
import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import {RouteContext} from 'sentry/views/routeContext';

describe('useGroupBys', function () {
  it('allows changing group bys', function () {
    let groupBys, setGroupBys;

    function TestPage() {
      [groupBys, setGroupBys] = useGroupBys();
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

    expect(groupBys).toEqual(['']); // default

    act(() => setGroupBys(['foo', 'bar']));
    expect(groupBys).toEqual(['foo', 'bar']);

    act(() => setGroupBys([]));
    expect(groupBys).toEqual(['']); // default
  });
});
