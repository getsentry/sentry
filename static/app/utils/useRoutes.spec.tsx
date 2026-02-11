import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render} from 'sentry-test/reactTestingLibrary';

import type {RouteContextInterface} from 'sentry/types/legacyReactRouter';
import {useRoutes} from 'sentry/utils/useRoutes';
import {TestRouteContext} from 'sentry/views/routeContext';

describe('useRoutes', () => {
  it('returns the current routes object', () => {
    let routes: any;
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
      <TestRouteContext value={routeContext}>
        <HomePage />
      </TestRouteContext>
    );
    expect(routes).toHaveLength(1);
    expect(routes[0]).toEqual({path: '/', component: HomePage});
  });
});
