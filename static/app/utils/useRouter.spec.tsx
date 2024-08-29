import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render} from 'sentry-test/reactTestingLibrary';

import type {RouteContextInterface} from 'sentry/types/legacyReactRouter';
import useRouter from 'sentry/utils/useRouter';
import {RouteContext} from 'sentry/views/routeContext';

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
      <RouteContext.Provider value={routeContext}>
        <HomePage />
      </RouteContext.Provider>
    );
    expect(actualRouter).toEqual(routeContext.router);
  });

  it('throws error when called outside of routes provider', function () {
    // Error is expected, do not fail when calling console.error
    jest.spyOn(console, 'error').mockImplementation();

    function HomePage() {
      useRouter();
      return null;
    }

    expect(() =>
      render(
        <RouteContext.Provider value={null}>
          <HomePage />
        </RouteContext.Provider>
      )
    ).toThrow(/useRouteContext called outside of routes provider/);
  });
});
