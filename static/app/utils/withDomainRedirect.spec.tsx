import {RouteComponentProps} from 'react-router';
import * as Sentry from '@sentry/react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import withDomainRedirect from 'sentry/utils/withDomainRedirect';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.unmock('sentry/utils/recreateRoute');

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
  const MyComponent = (props: Props) => {
    const {params} = props;
    return <div>Org slug: {params.orgId ?? 'no org slug'}</div>;
  };

  let spyWithScope;

  beforeEach(function () {
    spyWithScope = jest.spyOn(Sentry, 'withScope').mockImplementation(() => {});
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        replace: jest.fn(),
        pathname: '/organizations/albertos-apples/issues/',
        search: '?q=123',
        hash: '#hash',
      },
    });
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
      ...initializeOrg(),
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
    const organization = TestStubs.Organization({
      slug: 'bobs-bagels',
      features: ['customer-domains'],
    });

    const params = {
      orgId: 'albertos-apples',
    };
    const {router, route, routerContext} = initializeOrg({
      ...initializeOrg(),
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
    expect(spyWithScope).not.toHaveBeenCalled();
  });

  it('redirects to sentryUrl on missing customer domain feature', function () {
    const organization = TestStubs.Organization({slug: 'albertos-apples', features: []});

    const params = {
      orgId: organization.slug,
    };
    const {router, route, routerContext} = initializeOrg({
      ...initializeOrg(),
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
    expect(spyWithScope).not.toHaveBeenCalled();
  });

  it('redirect when :orgId is present in the routes', function () {
    const organization = TestStubs.Organization({
      slug: 'albertos-apples',
      features: ['customer-domains'],
    });

    const params = {
      orgId: organization.slug,
      projectId: 'react',
    };
    const {router, route, routerContext} = initializeOrg({
      ...initializeOrg(),
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
    expect(spyWithScope).toHaveBeenCalledTimes(1);
  });

  it('does not redirect when :orgId is not present in the routes', function () {
    const organization = TestStubs.Organization({
      slug: 'albertos-apples',
      features: ['customer-domains'],
    });

    const params = {};

    const {router, route, routerContext} = initializeOrg({
      ...initializeOrg(),
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
    expect(spyWithScope).not.toHaveBeenCalled();
  });

  it('redirect option that provides alternative redirect destination', function () {
    const organization = TestStubs.Organization({
      slug: 'albertos-apples',
      features: ['customer-domains'],
    });

    const params = {
      orgId: organization.slug,
      projectId: 'react',
    };
    const {router, route, routerContext} = initializeOrg({
      ...initializeOrg(),
      organization,
      router: {
        params,
        routes: [
          // /settings/:orgId/
          {path: '/', childRoutes: []},
          {childRoutes: []},
          {path: '/settings/', name: 'Settings', indexRoute: {}, childRoutes: []},
          {name: 'Organizations', path: ':orgId/', childRoutes: []},
        ],
      },
    });

    const WrappedComponent = withDomainRedirect(MyComponent, {
      redirect: [
        {
          // If /settings/:orgId/ is encountered, then redirect to /settings/organization/ rather than redirecting to
          // /settings/.
          from: '/settings/:orgId/',
          to: '/settings/organization/',
        },
      ],
    });
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
    expect(router.replace).toHaveBeenCalledWith('/settings/organization/?q=123#hash');
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(spyWithScope).toHaveBeenCalledTimes(1);
  });

  it('redirect option that provides alternative redirect destination and preserves paths', function () {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        replace: jest.fn(),
        pathname: '/albertos-appls/money-making-app/getting-started/react-native',
        search: '?q=123',
        hash: '#hash',
      },
    });

    const organization = TestStubs.Organization({
      slug: 'albertos-apples',
      features: ['customer-domains'],
    });

    const params = {
      orgId: organization.slug,
      projectId: 'money-making-app',
      platform: 'react-native',
    };
    const {router, route, routerContext} = initializeOrg({
      ...initializeOrg(),
      organization,
      router: {
        params,
        routes: [
          // /:orgId/:projectId/getting-started/:platform/
          {path: '/', childRoutes: []},
          {childRoutes: []},
          {path: ':orgId/:projectId/getting-started/', indexRoute: {}, childRoutes: []},
          {path: ':platform/', indexRoute: {}, childRoutes: []},
        ],
      },
    });

    const WrappedComponent = withDomainRedirect(MyComponent, {
      redirect: [
        {
          from: '/:orgId/:projectId/getting-started/',
          to: '/getting-started/:projectId/',
        },
      ],
    });
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
    expect(router.replace).toHaveBeenCalledWith(
      '/getting-started/money-making-app/react-native/?q=123#hash'
    );
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(spyWithScope).toHaveBeenCalledTimes(1);
  });
});
