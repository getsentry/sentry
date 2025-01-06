import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render} from 'sentry-test/reactTestingLibrary';

import type {RouteContextInterface} from 'sentry/types/legacyReactRouter';
import useRouter from 'sentry/utils/useRouter';
import {TestRouteContext} from 'sentry/views/routeContext';

describe('useRouter', () => {
  it('returns the current router object', function () {
    let actualRouter;
    function HomePage() {
      actualRouter = useRouter();
      return null;
    }

    const routeContext: RouteContextInterface = {
      location: LocationFixture(),
      params: {},
      router: RouterFixture(),
      routes: [],
    };

    render(
      <TestRouteContext.Provider value={routeContext}>
        <HomePage />
      </TestRouteContext.Provider>
    );
    expect(actualRouter).toEqual(routeContext.router);
  });
});
