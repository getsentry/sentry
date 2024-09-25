// biome-ignore lint/nursery/noRestrictedImports: Will be removed with react router 6
import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {useUserQuery} from 'sentry/views/explore/hooks/useUserQuery';
import {RouteContext} from 'sentry/views/routeContext';

describe('useUserQuery', function () {
  it('allows changing user query', function () {
    let userQuery, setUserQuery;

    function TestPage() {
      [userQuery, setUserQuery] = useUserQuery();
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

    expect(userQuery).toEqual(''); // default

    act(() => setUserQuery('foo:bar'));
    expect(userQuery).toEqual('foo:bar');
  });
});
