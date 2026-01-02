import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import ConfigStore from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useParams} from 'sentry/utils/useParams';
import useRouter from 'sentry/utils/useRouter';
import withDomainRedirect from 'sentry/utils/withDomainRedirect';

jest.unmock('sentry/utils/recreateRoute');
jest.mock('sentry/utils/useRouter');

// /settings/:orgId/:projectId/(searches/:searchId/)alerts/
const projectRoutes = [
  {path: '/', childRoutes: []},
  {childRoutes: []},
  {path: '/settings/', name: 'Settings', indexRoute: {}, childRoutes: []},
  {name: 'Organizations', path: ':orgId/', childRoutes: []},
  {name: 'Projects', path: ':projectId/', childRoutes: []},
  {name: 'Alerts', path: 'alerts/'},
];

describe('withDomainRedirect', () => {
  function MyComponent() {
    const params = useParams();
    return <div>Org slug: {params.orgId ?? 'no org slug'}</div>;
  }
  let configState: Config;

  beforeEach(() => {
    setWindowLocation(
      'http://localhost:3000/organizations/albertos-apples/issues/?q=123#hash'
    );

    configState = ConfigStore.getState();
    ConfigStore.loadInitialData({
      ...configState,
      features: new Set(),
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
      links: {
        organizationUrl: undefined,
        regionUrl: undefined,
        sentryUrl: 'https://sentry.io',
      },
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    ConfigStore.loadInitialData(configState);
  });

  it('renders MyComponent in non-customer domain world', () => {
    ConfigStore.loadInitialData({
      ...configState,
      customerDomain: null,
      links: {
        organizationUrl: undefined,
        regionUrl: undefined,
        sentryUrl: 'https://sentry.io',
      },
    });
    const WrappedComponent = withDomainRedirect(MyComponent);
    render(<WrappedComponent />, {
      initialRouterConfig: {
        location: {
          pathname: '/organizations/albertos-apples/issues/',
          query: {q: '123'},
        },
        route: '/organizations/:orgId/issues/',
      },
    });

    expect(screen.getByText('Org slug: albertos-apples')).toBeInTheDocument();
  });

  it('redirects to sentryUrl on org slug mistmatch', () => {
    const organization = OrganizationFixture({
      slug: 'bobs-bagels',
    });
    const WrappedComponent = withDomainRedirect(MyComponent);
    const {container} = render(<WrappedComponent />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/albertos-apples/issues/',
          query: {q: '123'},
        },
        route: '/organizations/:orgId/issues/',
      },
    });

    expect(container).toBeEmptyDOMElement();
    expect(testableWindowLocation.replace).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.replace).toHaveBeenCalledWith(
      'https://sentry.io/organizations/albertos-apples/issues/?q=123#hash'
    );
  });

  it('redirects to sentryUrl on missing customer domain feature', () => {
    const organization = OrganizationFixture({slug: 'albertos-apples'});

    const WrappedComponent = withDomainRedirect(MyComponent);
    const {container} = render(<WrappedComponent />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/albertos-apples/issues/',
          query: {q: '123'},
        },
        route: '/organizations/:orgId/issues/',
      },
    });

    expect(container).toBeEmptyDOMElement();
    expect(testableWindowLocation.replace).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.replace).toHaveBeenCalledWith(
      'https://sentry.io/organizations/albertos-apples/issues/?q=123#hash'
    );
  });

  it('redirect when :orgId is present in the routes', () => {
    ConfigStore.set('features', new Set(['system:multi-region']));
    const organization = OrganizationFixture({
      slug: 'albertos-apples',
    });
    const replaceFn = jest.fn();
    jest.mocked(useRouter).mockReturnValue(
      RouterFixture({
        routes: projectRoutes,
        replace: replaceFn,
      })
    );
    const WrappedComponent = withDomainRedirect(MyComponent);
    const {container} = render(<WrappedComponent />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/settings/albertos-apples/react/alerts/',
          query: {q: '123'},
        },
        route: '/settings/:orgId/:projectId/alerts/',
      },
    });

    expect(container).toBeEmptyDOMElement();
    expect(replaceFn).toHaveBeenCalledTimes(1);
    expect(replaceFn).toHaveBeenCalledWith('/settings/react/alerts/?q=123#hash');
  });

  it('does not redirect when :orgId is not present in the routes', () => {
    ConfigStore.set('features', new Set(['system:multi-region']));
    const organization = OrganizationFixture({
      slug: 'albertos-apples',
    });

    jest.mocked(useRouter).mockReturnValue(RouterFixture({routes: []}));

    const WrappedComponent = withDomainRedirect(MyComponent);
    const {router} = render(<WrappedComponent />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/settings/account/notifications/reports/',
        },
        route: '/settings/account/notifications/reports/',
      },
    });
    const initialLocation = router.location.pathname;

    expect(screen.getByText('Org slug: no org slug')).toBeInTheDocument();
    expect(initialLocation).toBe('/settings/account/notifications/reports/');
  });

  it('updates path when :orgId is present in the routes and there is no subdomain', () => {
    const organization = OrganizationFixture({
      slug: 'albertos-apples',
    });
    ConfigStore.set('customerDomain', {
      organizationUrl: 'https://sentry.io',
      sentryUrl: 'https://sentry.io',
      subdomain: '',
    });
    const replaceFn = jest.fn();
    jest.mocked(useRouter).mockReturnValue(
      RouterFixture({
        routes: projectRoutes,
        replace: replaceFn,
      })
    );

    const WrappedComponent = withDomainRedirect(MyComponent);
    render(<WrappedComponent />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/settings/albertos-apples/react/alerts/',
          query: {q: '123'},
        },
        route: '/settings/:orgId/:projectId/alerts/',
      },
    });

    expect(replaceFn).toHaveBeenCalledTimes(1);
    expect(replaceFn).toHaveBeenCalledWith('/settings/react/alerts/?q=123#hash');
  });
});
