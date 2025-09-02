import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render} from 'sentry-test/reactTestingLibrary';

import type {RouteContextInterface} from 'sentry/types/legacyReactRouter';
import useRouter from 'sentry/utils/useRouter';
import {TestRouteContext} from 'sentry/views/routeContext';

describe('useRouter', () => {
  it('returns the current router object', () => {
    let actualRouter: any;
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
      <TestRouteContext value={routeContext}>
        <HomePage />
      </TestRouteContext>
    );
    expect(actualRouter).toEqual(routeContext.router);
  });
});
