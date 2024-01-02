import {RouteComponentProps} from 'react-router';
import {Location, LocationDescriptor, LocationDescriptorObject} from 'history';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import withDomainRequired, {normalizeUrl} from 'sentry/utils/withDomainRequired';

describe('normalizeUrl', function () {
  let result;

  beforeEach(function () {
    window.__initialData = {
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    } as any;
  });

  it('replaces paths in strings', function () {
    const location = LocationFixture();
    const cases = [
      // input, expected
      ['/settings/', '/settings/'],
      ['/accept-terms/acme/', '/accept-terms/'],

      // Organization settings views.
      ['/settings/acme/', '/settings/organization/'],
      ['/settings/organization', '/settings/organization/'],
      ['/settings/sentry-organizations/members/', '/settings/members/'],
      ['/settings/sentry-organizations/members/3/', '/settings/members/3/'],
      ['/settings/sentry-organizations/teams/peeps/', '/settings/teams/peeps/'],
      ['/settings/sentry-organizations/teams/payments/', '/settings/teams/payments/'],
      ['/settings/sentry-organizations/billing/receipts/', '/settings/billing/receipts/'],
      [
        '/settings/sentry-organizations/teams/test-organizations/notifications/',
        '/settings/teams/test-organizations/notifications/',
      ],
      [
        '/settings/acme/developer-settings/release-bot/',
        '/settings/developer-settings/release-bot/',
      ],
      [
        '/settings/sentry-organizations/integrations/vercel/12345/?next=something',
        '/settings/integrations/vercel/12345/?next=something',
      ],
      // Account settings should stay the same
      ['/settings/account/', '/settings/account/'],
      ['/settings/account/security/', '/settings/account/security/'],
      ['/settings/account/details/', '/settings/account/details/'],

      ['/join-request/acme', '/join-request/'],
      ['/join-request/acme/', '/join-request/'],
      ['/onboarding/acme/', '/onboarding/'],
      ['/onboarding/acme/project/', '/onboarding/project/'],

      ['/organizations/new/', '/organizations/new/'],
      ['/organizations/albertos-organizations/issues/', '/issues/'],
      [
        '/organizations/albertos-organizations/issues/?_q=all#hash',
        '/issues/?_q=all#hash',
      ],
      ['/acme/project-slug/getting-started/', '/getting-started/project-slug/'],
      [
        '/acme/project-slug/getting-started/python',
        '/getting-started/project-slug/python',
      ],
      ['/settings/projects/python/filters/', '/settings/projects/python/filters/'],
      ['/settings/projects/onboarding/abc123/', '/settings/projects/onboarding/abc123/'],
      [
        '/settings/projects/join-request/abc123/',
        '/settings/projects/join-request/abc123/',
      ],
      [
        '/settings/projects/python/filters/discarded/',
        '/settings/projects/python/filters/discarded/',
      ],
      [
        '/settings/projects/getting-started/abc123/',
        '/settings/projects/getting-started/abc123/',
      ],
      // Team settings links in breadcrumbs can be pre-normalized from breadcrumbs
      ['/settings/teams/peeps/', '/settings/teams/peeps/'],
      [
        '/settings/billing/checkout/?_q=all#hash',
        '/settings/billing/checkout/?_q=all#hash',
      ],
      [
        '/settings/billing/bundle-checkout/?_q=all#hash',
        '/settings/billing/bundle-checkout/?_q=all#hash',
      ],
    ];
    for (const [input, expected] of cases) {
      result = normalizeUrl(input);
      expect(result).toEqual(expected);

      result = normalizeUrl(input, location);
      expect(result).toEqual(expected);

      result = normalizeUrl(input, {forceCustomerDomain: false});
      expect(result).toEqual(expected);

      result = normalizeUrl(input, location, {forceCustomerDomain: false});
      expect(result).toEqual(expected);
    }

    // Normalizes urls if options.customerDomain is true and orgslug.sentry.io isn't being used
    window.__initialData.customerDomain = null;
    for (const [input, expected] of cases) {
      result = normalizeUrl(input, {forceCustomerDomain: true});
      expect(result).toEqual(expected);

      result = normalizeUrl(input, location, {forceCustomerDomain: true});
      expect(result).toEqual(expected);
    }

    // No effect if customerDomain isn't defined
    window.__initialData.customerDomain = null;
    for (const [input, _expected] of cases) {
      result = normalizeUrl(input);
      expect(result).toEqual(input);

      result = normalizeUrl(input, location);
      expect(result).toEqual(input);
    }
  });

  it('replaces pathname in objects', function () {
    const location = LocationFixture();
    result = normalizeUrl({pathname: '/settings/acme/'}, location);
    expect(result.pathname).toEqual('/settings/organization/');

    result = normalizeUrl({pathname: '/settings/acme/'}, location, {
      forceCustomerDomain: false,
    });
    expect(result.pathname).toEqual('/settings/organization/');

    result = normalizeUrl({pathname: '/settings/sentry/members'}, location);
    expect(result.pathname).toEqual('/settings/members');

    result = normalizeUrl({pathname: '/organizations/albertos-apples/issues'}, location);
    expect(result.pathname).toEqual('/issues');

    result = normalizeUrl(
      {
        pathname: '/organizations/sentry/profiling/profile/sentry/abc123/',
        query: {sorting: 'call order'},
      },
      location
    );
    expect(result.pathname).toEqual('/profiling/profile/sentry/abc123/');

    result = normalizeUrl(
      {
        pathname: '/organizations/albertos-apples/issues',
        query: {q: 'all'},
      },
      location
    );
    expect(result.pathname).toEqual('/issues');

    // Normalizes urls if options.customerDomain is true and orgslug.sentry.io isn't being used
    window.__initialData.customerDomain = null;
    result = normalizeUrl({pathname: '/settings/acme/'}, location, {
      forceCustomerDomain: true,
    });
    expect(result.pathname).toEqual('/settings/organization/');

    result = normalizeUrl(
      {
        pathname: '/organizations/albertos-apples/issues',
        query: {q: 'all'},
      },
      location,
      {
        forceCustomerDomain: true,
      }
    );
    expect(result.pathname).toEqual('/issues');
  });

  it('replaces pathname in function callback', function () {
    const location = LocationFixture();
    function objectCallback(_loc: Location): LocationDescriptorObject {
      return {pathname: '/settings/'};
    }
    result = normalizeUrl(objectCallback, location);
    expect(result.pathname).toEqual('/settings/');

    function stringCallback(_loc: Location): LocationDescriptor {
      return '/organizations/a-long-slug/discover/';
    }
    result = normalizeUrl(stringCallback, location);
    expect(result).toEqual('/discover/');

    // Normalizes urls if options.customerDomain is true and orgslug.sentry.io isn't being used
    window.__initialData.customerDomain = null;

    function objectCallback2(_loc: Location): LocationDescriptorObject {
      return {pathname: '/settings/'};
    }
    result = normalizeUrl(objectCallback2, location, {forceCustomerDomain: true});
    expect(result.pathname).toEqual('/settings/');

    function stringCallback2(_loc: Location): LocationDescriptor {
      return '/organizations/a-long-slug/discover/';
    }
    result = normalizeUrl(stringCallback2, location, {forceCustomerDomain: true});
    expect(result).toEqual('/discover/');
  });

  it('errors on functions without location', function () {
    function objectCallback(_loc: Location): LocationDescriptorObject {
      return {pathname: '/settings/organization'};
    }
    expect(() => normalizeUrl(objectCallback)).toThrow();
  });
});

const originalLocation = window.location;

describe('withDomainRequired', function () {
  type Props = RouteComponentProps<{orgId: string}, {}>;
  function MyComponent(props: Props) {
    const {params} = props;
    return <div>Org slug: {params.orgId ?? 'no org slug'}</div>;
  }

  beforeEach(function () {
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
    window.location = originalLocation;
  });

  it('redirects to sentryUrl in non-customer domain world', function () {
    window.__initialData = {
      customerDomain: null,
      features: ['organizations:customer-domains'],
      links: {
        organizationUrl: null,
        regionUrl: null,
        sentryUrl: 'https://sentry.io',
      },
    } as any;

    const organization = Organization({
      slug: 'albertos-apples',
      features: [],
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
    const WrappedComponent = withDomainRequired(MyComponent);
    const {container} = render(
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

    expect(container).toBeEmptyDOMElement();
    expect(window.location.replace).toHaveBeenCalledTimes(1);
    expect(window.location.replace).toHaveBeenCalledWith(
      'https://sentry.io/organizations/albertos-apples/issues/?q=123#hash'
    );
  });

  it('redirects to sentryUrl if customer-domains is omitted', function () {
    window.__initialData = {
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
      features: [],
      links: {
        organizationUrl: null,
        regionUrl: null,
        sentryUrl: 'https://sentry.io',
      },
    } as any;

    const organization = Organization({
      slug: 'albertos-apples',
      features: [],
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
    const WrappedComponent = withDomainRequired(MyComponent);
    const {container} = render(
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

    expect(container).toBeEmptyDOMElement();
    expect(window.location.replace).toHaveBeenCalledTimes(1);
    expect(window.location.replace).toHaveBeenCalledWith(
      'https://sentry.io/organizations/albertos-apples/issues/?q=123#hash'
    );
  });

  it('renders when window.__initialData.customerDomain and customer-domains feature is present', function () {
    window.__initialData = {
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
      features: ['organizations:customer-domains'],
      links: {
        organizationUrl: 'https://albertos-apples.sentry.io',
        regionUrl: 'https://eu.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    } as any;

    const organization = Organization({
      slug: 'albertos-apples',
      features: [],
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
    const WrappedComponent = withDomainRequired(MyComponent);
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
    expect(window.location.replace).toHaveBeenCalledTimes(0);
  });
});
