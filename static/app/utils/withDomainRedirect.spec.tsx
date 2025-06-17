import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import ConfigStore from 'sentry/stores/configStore';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Config} from 'sentry/types/system';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import withDomainRedirect from 'sentry/utils/withDomainRedirect';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.unmock('sentry/utils/recreateRoute');

// /settings/:orgId/:projectId/(searches/:searchId/)alerts/
const projectRoutes = [
  {path: '/', childRoutes: []},
  {childRoutes: []},
  {path: '/settings/', name: 'Settings', indexRoute: {}, childRoutes: []},
  {name: 'Organizations', path: ':orgId/', childRoutes: []},
  {name: 'Projects', path: ':projectId/', childRoutes: []},
  {name: 'Alerts', path: 'alerts/'},
];

describe('withDomainRedirect', function () {
  type Props = RouteComponentProps<{orgId: string}>;
  function MyComponent(props: Props) {
    const {params} = props;
    return <div>Org slug: {params.orgId ?? 'no org slug'}</div>;
  }
  let configState: Config;

  beforeEach(function () {
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

  afterEach(function () {
    jest.resetAllMocks();
    ConfigStore.loadInitialData(configState);
  });

  it('renders MyComponent in non-customer domain world', function () {
    ConfigStore.loadInitialData({
      ...configState,
      customerDomain: null,
      links: {
        organizationUrl: undefined,
        regionUrl: undefined,
        sentryUrl: 'https://sentry.io',
      },
    });

    const params = {
      orgId: 'albertos-apples',
    };
    const {router} = initializeOrg({
      router: {
        params,
      },
    });
    const WrappedComponent = withDomainRedirect(MyComponent);
    render(
      <WrappedComponent
        router={router}
        location={router.location}
        params={params}
        routes={router.routes}
        routeParams={router.params}
        route={{}}
      />
    );

    expect(screen.getByText('Org slug: albertos-apples')).toBeInTheDocument();
  });

  it('redirects to sentryUrl on org slug mistmatch', function () {
    const organization = OrganizationFixture({
      slug: 'bobs-bagels',
    });

    const params = {
      orgId: 'albertos-apples',
    };
    const {router} = initializeOrg({
      organization,
      router: {
        params,
      },
    });

    const WrappedComponent = withDomainRedirect(MyComponent);
    const {container} = render(
      <OrganizationContext value={organization}>
        <WrappedComponent
          router={router}
          location={router.location}
          params={params}
          routes={router.routes}
          routeParams={router.params}
          route={{}}
        />
      </OrganizationContext>
    );

    expect(container).toBeEmptyDOMElement();
    expect(testableWindowLocation.replace).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.replace).toHaveBeenCalledWith(
      'https://sentry.io/organizations/albertos-apples/issues/?q=123#hash'
    );
  });

  it('redirects to sentryUrl on missing customer domain feature', function () {
    const organization = OrganizationFixture({slug: 'albertos-apples'});

    const params = {
      orgId: organization.slug,
    };
    const {router} = initializeOrg({
      organization,
      router: {
        params,
      },
    });

    const WrappedComponent = withDomainRedirect(MyComponent);
    const {container} = render(
      <OrganizationContext value={organization}>
        <WrappedComponent
          router={router}
          location={router.location}
          params={params}
          routes={router.routes}
          routeParams={router.params}
          route={{}}
        />
      </OrganizationContext>
    );

    expect(container).toBeEmptyDOMElement();
    expect(testableWindowLocation.replace).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.replace).toHaveBeenCalledWith(
      'https://sentry.io/organizations/albertos-apples/issues/?q=123#hash'
    );
  });

  it('redirect when :orgId is present in the routes', function () {
    ConfigStore.set('features', new Set(['system:multi-region']));
    const organization = OrganizationFixture({
      slug: 'albertos-apples',
    });

    const params = {
      orgId: organization.slug,
      projectId: 'react',
    };
    const {router} = initializeOrg({
      organization,
      router: {
        params,
        routes: projectRoutes,
      },
    });

    const WrappedComponent = withDomainRedirect(MyComponent);
    const {container} = render(
      <OrganizationContext value={organization}>
        <WrappedComponent
          router={router}
          location={router.location}
          params={params}
          routes={router.routes}
          routeParams={router.params}
          route={{}}
        />
      </OrganizationContext>
    );

    expect(container).toBeEmptyDOMElement();
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/settings/react/alerts/?q=123#hash');
  });

  it('does not redirect when :orgId is not present in the routes', function () {
    ConfigStore.set('features', new Set(['system:multi-region']));
    const organization = OrganizationFixture({
      slug: 'albertos-apples',
    });

    const params = {};

    const {router} = initializeOrg({
      organization,
      router: {
        params,
        // /settings/account/notifications/reports/
        routes: [
          {path: '/', childRoutes: []},
          {childRoutes: []},
          {path: '/settings/', name: 'Settings', indexRoute: {}, childRoutes: []},
          {name: 'Account', path: 'account/', childRoutes: []},
          {name: 'Notifications', path: 'notifications/', childRoutes: []},
          {name: 'Reports', path: 'reports/'},
        ],
      },
    });

    const WrappedComponent = withDomainRedirect(MyComponent);
    render(
      <OrganizationContext value={organization}>
        <WrappedComponent
          router={router}
          location={router.location}
          params={params}
          routes={router.routes}
          routeParams={router.params}
          route={{}}
        />
      </OrganizationContext>
    );

    expect(screen.getByText('Org slug: no org slug')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('updates path when :orgId is present in the routes and there is no subdomain', function () {
    const organization = OrganizationFixture({
      slug: 'albertos-apples',
    });
    ConfigStore.set('customerDomain', {
      organizationUrl: 'https://sentry.io',
      sentryUrl: 'https://sentry.io',
      subdomain: '',
    });

    const params = {
      orgId: organization.slug,
      projectId: 'react',
    };
    const {router} = initializeOrg({
      organization,
      router: {
        params,
        routes: projectRoutes,
      },
    });

    const WrappedComponent = withDomainRedirect(MyComponent);
    render(
      <OrganizationContext value={organization}>
        <WrappedComponent
          router={router}
          location={router.location}
          params={params}
          routes={router.routes}
          routeParams={router.params}
          route={{}}
        />
      </OrganizationContext>
    );

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/settings/react/alerts/?q=123#hash');
  });
});
