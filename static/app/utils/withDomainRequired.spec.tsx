import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import ConfigStore from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useParams} from 'sentry/utils/useParams';
import withDomainRequired from 'sentry/utils/withDomainRequired';

describe('withDomainRequired', () => {
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
    ConfigStore.loadInitialData(configState);
  });

  it('redirects to sentryUrl in non-customer domain world', () => {
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
    const WrappedComponent = withDomainRequired(MyComponent);
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

  it('redirects to sentryUrl if multi-region feature is omitted', () => {
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
    const WrappedComponent = withDomainRequired(MyComponent);
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

  it('renders when window.__initialData.customerDomain and multi-region feature is present', () => {
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
    const WrappedComponent = withDomainRequired(MyComponent);
    render(<WrappedComponent />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/albertos-apples/issues/',
          query: {q: '123'},
        },
        route: '/organizations/:orgId/issues/',
      },
    });

    expect(screen.getByText('Org slug: albertos-apples')).toBeInTheDocument();
    expect(testableWindowLocation.replace).toHaveBeenCalledTimes(0);
  });
});
