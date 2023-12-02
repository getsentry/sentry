import {RouteComponentProps} from 'react-router';
import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import withDomainRedirect from 'sentry/utils/withDomainRedirect';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.unmock('sentry/utils/recreateRoute');

const originalLocation = window.location;

// /settings/:orgId/:projectId/(searches/:searchId/)alerts/
const projectRoutes = [
  {path: '/', childRoutes: []},
  {childRoutes: []},
  {path: '/settings/', name: 'Settings', indexRoute: {}, childRoutes: []},
  {name: 'Organizations', path: ':orgId/', childRoutes: []},
  {name: 'Projects', path: ':projectId/(searches/:searchId/)', childRoutes: []},
  {name: 'Alerts', path: 'alerts/'},
];

describe('withDomainRedirect', function () {
  type Props = RouteComponentProps<{orgId: string}, {}>;
  function MyComponent(props: Props) {
    const {params} = props;
    return <div>Org slug: {params.orgId ?? 'no org slug'}</div>;
  }

  beforeEach(function () {
    window.location.pathname = '/organizations/albertos-apples/issues/';
    window.location.search = '?q=123';
    window.location.hash = '#hash';

    window.__initialData = {
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
      links: {
        organizationUrl: null,
        regionUrl: null,
        sentryUrl: 'https://sentry.io',
      },
    } as any;
  });

  afterEach(function () {
    jest.resetAllMocks();
    window.location = originalLocation;
  });

  it('renders MyComponent in non-customer domain world', function () {
    window.__initialData = {
      customerDomain: null,
      links: {
        organizationUrl: null,
        regionUrl: null,
        sentryUrl: 'https://sentry.io',
      },
    } as any;

    const params = {
      orgId: 'albertos-apples',
    };
    const {router, route, routerContext} = initializeOrg({
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
        route={route}
      />,
      {context: routerContext}
    );

    expect(screen.getByText('Org slug: albertos-apples')).toBeInTheDocument();
  });

  it('redirects to sentryUrl on org slug mistmatch', function () {
    const organization = Organization({
      slug: 'bobs-bagels',
      features: ['customer-domains'],
    });

    const params = {
      orgId: 'albertos-apples',
    };
    const {router, route, routerContext} = initializeOrg({
      organization,
      router: {
        params,
      },
    });

    const WrappedComponent = withDomainRedirect(MyComponent);
    const {container} = render(
      <OrganizationContext.Provider value={organization}>
        <WrappedComponent
          router={router}
          location={router.location}
          params={params}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </OrganizationContext.Provider>,
      {context: routerContext}
    );

    expect(container).toBeEmptyDOMElement();
    expect(window.location.replace).toHaveBeenCalledTimes(1);
    expect(window.location.replace).toHaveBeenCalledWith(
      'https://sentry.io/organizations/albertos-apples/issues/?q=123#hash'
    );
  });

  it('redirects to sentryUrl on missing customer domain feature', function () {
    const organization = Organization({slug: 'albertos-apples', features: []});

    const params = {
      orgId: organization.slug,
    };
    const {router, route, routerContext} = initializeOrg({
      organization,
      router: {
        params,
      },
    });

    const WrappedComponent = withDomainRedirect(MyComponent);
    const {container} = render(
      <OrganizationContext.Provider value={organization}>
        <WrappedComponent
          router={router}
          location={router.location}
          params={params}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </OrganizationContext.Provider>,
      {context: routerContext}
    );

    expect(container).toBeEmptyDOMElement();
    expect(window.location.replace).toHaveBeenCalledTimes(1);
    expect(window.location.replace).toHaveBeenCalledWith(
      'https://sentry.io/organizations/albertos-apples/issues/?q=123#hash'
    );
  });

  it('redirect when :orgId is present in the routes', function () {
    const organization = Organization({
      slug: 'albertos-apples',
      features: ['customer-domains'],
    });

    const params = {
      orgId: organization.slug,
      projectId: 'react',
    };
    const {router, route, routerContext} = initializeOrg({
      organization,
      router: {
        params,
        routes: projectRoutes,
      },
    });

    const WrappedComponent = withDomainRedirect(MyComponent);
    const {container} = render(
      <OrganizationContext.Provider value={organization}>
        <WrappedComponent
          router={router}
          location={router.location}
          params={params}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </OrganizationContext.Provider>,
      {context: routerContext}
    );

    expect(container).toBeEmptyDOMElement();
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/settings/react/alerts/?q=123#hash');
  });

  it('does not redirect when :orgId is not present in the routes', function () {
    const organization = Organization({
      slug: 'albertos-apples',
      features: ['customer-domains'],
    });

    const params = {};

    const {router, route, routerContext} = initializeOrg({
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
      <OrganizationContext.Provider value={organization}>
        <WrappedComponent
          router={router}
          location={router.location}
          params={params}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </OrganizationContext.Provider>,
      {context: routerContext}
    );

    expect(screen.getByText('Org slug: no org slug')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('updates path when :orgId is present in the routes and there is no subdomain', function () {
    const organization = Organization({
      slug: 'albertos-apples',
      features: ['customer-domains'],
    });
    window.__initialData.customerDomain = {
      organizationUrl: 'https://sentry.io',
      sentryUrl: 'https://sentry.io',
      subdomain: '',
    };

    const params = {
      orgId: organization.slug,
      projectId: 'react',
    };
    const {router, route, routerContext} = initializeOrg({
      organization,
      router: {
        params,
        routes: projectRoutes,
      },
    });

    const WrappedComponent = withDomainRedirect(MyComponent);
    render(
      <OrganizationContext.Provider value={organization}>
        <WrappedComponent
          router={router}
          location={router.location}
          params={params}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </OrganizationContext.Provider>,
      {context: routerContext}
    );

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/settings/react/alerts/?q=123#hash');
  });
});
