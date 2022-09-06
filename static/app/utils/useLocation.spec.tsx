import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {render} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {RouteContext} from 'sentry/views/routeContext';

describe('useLocation', () => {
  it('returns the current location object', function () {
    let location;
    function HomePage() {
      location = useLocation();
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/?hello');

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
        <Route path="/" component={HomePage} />
      </Router>
    );

    expect(location.pathname).toBe('/');
    expect(location.query).toEqual({hello: null});
    expect(location.search).toBe('?hello');
  });
});
