import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render} from 'sentry-test/reactTestingLibrary';

import type {RouteContextInterface} from 'sentry/types/legacyReactRouter';
import {useLocation} from 'sentry/utils/useLocation';
import {RouteContext} from 'sentry/views/routeContext';

describe('useLocation', () => {
  it('returns the current location object', function () {
    let location;
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
      <RouteContext.Provider value={routeContext}>
        <HomePage />
      </RouteContext.Provider>
    );

    expect(location.pathname).toBe('/mock-pathname/');
    expect(location.query).toEqual({hello: null});
    expect(location.search).toBe('?hello');
  });
});
