import {useEffect} from 'react';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import type {RouteContextInterface} from 'sentry/types/legacyReactRouter';
import {useNavigate} from 'sentry/utils/useNavigate';
import {TestRouteContext} from 'sentry/views/routeContext';

describe('useNavigate', () => {
  const configState = ConfigStore.getState();

  afterEach(() => {
    ConfigStore.loadInitialData(configState);
  });

  it('returns the navigate function', function () {
    let navigate: ReturnType<typeof useNavigate> | undefined = undefined;

    function HomePage() {
      navigate = useNavigate();
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

    expect(typeof navigate).toBe('function');
  });

  it('applies url normalization for customer-domains', function () {
    ConfigStore.set('customerDomain', {
      subdomain: 'albertos-apples',
      organizationUrl: 'https://albertos-apples.sentry.io',
      sentryUrl: 'https://sentry.io',
    });

    function HomePage() {
      const navigate = useNavigate();
      useEffect(() => {
        navigate('/organizations/acme/issues/');
      }, [navigate]);

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

    expect(routeContext.router.push).toHaveBeenCalledWith({
      pathname: '/issues/',
      state: undefined,
    });
  });
});
