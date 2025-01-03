import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render} from 'sentry-test/reactTestingLibrary';

import type {RouteContextInterface} from 'sentry/types/legacyReactRouter';
import {useRoutes} from 'sentry/utils/useRoutes';
import {RouteContext} from 'sentry/views/routeContext';

describe('useRoutes', () => {
  it('returns the current routes object', function () {
    let routes;
    function HomePage() {
      routes = useRoutes();
      return null;
    }

    const routeContext: RouteContextInterface = {
      location: LocationFixture(),
      params: {},
      router: RouterFixture(),
      routes: [
        {
          path: '/',
          component: HomePage,
        },
      ],
    };

    render(
      <RouteContext.Provider value={routeContext}>
        <HomePage />
      </RouteContext.Provider>
    );
    expect(routes).toHaveLength(1);
    expect(routes[0]).toEqual({path: '/', component: HomePage});
  });
});
