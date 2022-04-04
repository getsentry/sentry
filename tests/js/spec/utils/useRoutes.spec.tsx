import * as React from 'react';
import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {render} from 'sentry-test/reactTestingLibrary';

import {useRoutes} from 'sentry/utils/useRoutes';
import {RouteContext} from 'sentry/views/routeContext';

describe('useRoutes', () => {
  it('returns the current routes object', function () {
    let routes;
    function HomePage() {
      routes = useRoutes();
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/');

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
    expect(typeof routes).toBe('object');
    expect(routes.length).toEqual(1);
    expect(routes[0]).toEqual({path: '/', component: HomePage});
  });
});
