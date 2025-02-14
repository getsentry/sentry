import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Config} from 'sentry/types/system';
import withDomainRequired from 'sentry/utils/withDomainRequired';

const originalLocation = window.location;

describe('withDomainRequired', function () {
  type Props = RouteComponentProps<{orgId: string}>;
  function MyComponent(props: Props) {
    const {params} = props;
    return <div>Org slug: {params.orgId ?? 'no org slug'}</div>;
  }
  let configState: Config;

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
    configState = ConfigStore.getState();
    ConfigStore.loadInitialData({
      ...configState,
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
    window.location = originalLocation;
    ConfigStore.loadInitialData(configState);
  });

  it('redirects to sentryUrl in non-customer domain world', function () {
    ConfigStore.loadInitialData({
      ...configState,
      customerDomain: null,
      features: new Set(['system:multi-region']),
      links: {
        organizationUrl: undefined,
        regionUrl: undefined,
        sentryUrl: 'https://sentry.io',
      },
    });

    const organization = OrganizationFixture({
      slug: 'albertos-apples',
      features: [],
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
    const WrappedComponent = withDomainRequired(MyComponent);
    const {container} = render(
      <WrappedComponent
        router={router}
        location={router.location}
        params={params}
        routes={router.routes}
        routeParams={router.params}
        route={{}}
      />,
      {router}
    );

    expect(container).toBeEmptyDOMElement();
    expect(window.location.replace).toHaveBeenCalledTimes(1);
    expect(window.location.replace).toHaveBeenCalledWith(
      'https://sentry.io/organizations/albertos-apples/issues/?q=123#hash'
    );
  });

  it('redirects to sentryUrl if multi-region feature is omitted', function () {
    ConfigStore.loadInitialData({
      ...configState,
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
      features: new Set(),
      links: {
        organizationUrl: undefined,
        regionUrl: undefined,
        sentryUrl: 'https://sentry.io',
      },
    });

    const organization = OrganizationFixture({
      slug: 'albertos-apples',
      features: [],
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
    const WrappedComponent = withDomainRequired(MyComponent);
    const {container} = render(
      <WrappedComponent
        router={router}
        location={router.location}
        params={params}
        routes={router.routes}
        routeParams={router.params}
        route={{}}
      />,
      {router}
    );

    expect(container).toBeEmptyDOMElement();
    expect(window.location.replace).toHaveBeenCalledTimes(1);
    expect(window.location.replace).toHaveBeenCalledWith(
      'https://sentry.io/organizations/albertos-apples/issues/?q=123#hash'
    );
  });

  it('renders when window.__initialData.customerDomain and multi-region feature is present', function () {
    ConfigStore.loadInitialData({
      ...configState,
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
      features: new Set(['system:multi-region']),
      links: {
        organizationUrl: 'https://albertos-apples.sentry.io',
        regionUrl: 'https://eu.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    });

    const organization = OrganizationFixture({
      slug: 'albertos-apples',
      features: [],
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
    const WrappedComponent = withDomainRequired(MyComponent);
    render(
      <WrappedComponent
        router={router}
        location={router.location}
        params={params}
        routes={router.routes}
        routeParams={router.params}
        route={{}}
      />,
      {router}
    );

    expect(screen.getByText('Org slug: albertos-apples')).toBeInTheDocument();
    expect(window.location.replace).toHaveBeenCalledTimes(0);
  });
});
