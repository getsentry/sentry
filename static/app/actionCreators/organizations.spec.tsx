import {OrganizationFixture} from 'sentry-fixture/organization';

import {fetchOrganizations} from 'sentry/actionCreators/organizations';
import {ConfigStore} from 'sentry/stores/configStore';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

describe('fetchOrganizations', () => {
  const api = new MockApiClient();
  const usorg = OrganizationFixture({slug: 'us-org'});
  const deorg = OrganizationFixture({slug: 'de-org'});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    // Reset between tests so the control-silo flag doesn't leak into the
    // fan-out cases (and vice versa).
    ConfigStore.set('features', new Set());
  });

  it('fetches from multiple regions', async () => {
    ConfigStore.set('memberRegions', [
      {name: 'us', url: 'https://us.example.org'},
      {name: 'de', url: 'https://de.example.org'},
    ]);
    const usMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [usorg],
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.host === 'https://us.example.org';
        },
      ],
    });
    const deMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [deorg],
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.host === 'https://de.example.org';
        },
      ],
    });

    const organizations = await fetchOrganizations(api);

    expect(organizations).toHaveLength(2);
    expect(usMock).toHaveBeenCalledTimes(1);
    expect(deMock).toHaveBeenCalledTimes(1);
  });

  it('fetches from the control silo when organizations:use-control-org-listing is enabled', async () => {
    ConfigStore.set('features', new Set(['organizations:use-control-org-listing']));
    ConfigStore.set('links', {
      ...ConfigStore.get('links'),
      sentryUrl: 'https://sentry.example.org',
    });
    ConfigStore.set('memberRegions', [
      {name: 'us', url: 'https://us.example.org'},
      {name: 'de', url: 'https://de.example.org'},
    ]);

    const controlMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [usorg, deorg],
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.host === 'https://sentry.example.org';
        },
      ],
    });
    const regionMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [usorg],
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.host !== 'https://sentry.example.org';
        },
      ],
    });

    const organizations = await fetchOrganizations(api);

    // Single control-silo request, no per-region fan-out.
    expect(organizations).toHaveLength(2);
    expect(controlMock).toHaveBeenCalledTimes(1);
    expect(regionMock).not.toHaveBeenCalled();
  });

  it('ignores 401 errors from a region', async () => {
    ConfigStore.set('memberRegions', [
      {name: 'us', url: 'https://us.example.org'},
      {name: 'de', url: 'https://de.example.org'},
    ]);
    const usMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [usorg],
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.host === 'https://us.example.org';
        },
      ],
    });
    const deMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: {detail: 'Authentication credentials required'},
      status: 401,
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.host === 'https://de.example.org';
        },
      ],
    });

    const organizations = await fetchOrganizations(api);

    expect(organizations).toHaveLength(1);
    expect(organizations[0].slug).toEqual(usorg.slug);
    expect(usMock).toHaveBeenCalledTimes(1);
    expect(deMock).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.reload).not.toHaveBeenCalled();
  });
});
