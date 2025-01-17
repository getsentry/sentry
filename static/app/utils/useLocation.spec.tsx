import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render} from 'sentry-test/reactTestingLibrary';

import type {RouteContextInterface} from 'sentry/types/legacyReactRouter';
import {useLocation} from 'sentry/utils/useLocation';
import {TestRouteContext} from 'sentry/views/routeContext';

describe('useLocation', () => {
  it('returns the current location object', function () {
    let location: any;
    function HomePage() {
      location = useLocation();
      return null;
    }

    const routeContext: RouteContextInterface = {
      location: LocationFixture({
        query: {hello: null},
        search: '?hello',
      }),
      params: {},
      router: RouterFixture(),
      routes: [],
    };

    render(
      <TestRouteContext.Provider value={routeContext}>
        <HomePage />
      </TestRouteContext.Provider>
    );

    expect(location.pathname).toBe('/mock-pathname/');
    expect(location.query).toEqual({hello: null});
    expect(location.search).toBe('?hello');
  });
});
