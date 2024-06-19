import {useEffect} from 'react';
import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {render} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {useNavigate} from 'sentry/utils/useNavigate';
import {RouteContext} from 'sentry/views/routeContext';

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
        <Route
          path="/issues"
          component={() => {
            return null;
          }}
        />
      </Router>
    );
    expect(memoryHistory.getCurrentLocation().pathname).toBe('/issues/');
  });
});
