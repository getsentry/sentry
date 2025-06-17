import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import ConfigStore from 'sentry/stores/configStore';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Config} from 'sentry/types/system';
import {testableWindowLocation} from 'sentry/utils/testableLocation';
import withDomainRequired from 'sentry/utils/withDomainRequired';

describe('withDomainRequired', function () {
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
      />
    );

    expect(container).toBeEmptyDOMElement();
    expect(testableWindowLocation.replace).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.replace).toHaveBeenCalledWith(
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
      />
    );

    expect(container).toBeEmptyDOMElement();
    expect(testableWindowLocation.replace).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.replace).toHaveBeenCalledWith(
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
      />
    );

    expect(screen.getByText('Org slug: albertos-apples')).toBeInTheDocument();
    expect(testableWindowLocation.replace).toHaveBeenCalledTimes(0);
  });
});
