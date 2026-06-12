import {OrganizationFixture} from 'sentry-fixture/organization';

import {fetchOrganizations} from 'sentry/actionCreators/organizations';
import {ConfigStore} from 'sentry/stores/configStore';

describe('fetchOrganizations', () => {
  const api = new MockApiClient();
  const usorg = OrganizationFixture({slug: 'us-org'});
  const deorg = OrganizationFixture({slug: 'de-org'});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('fetches the full cross-cell list from the control silo', async () => {
    ConfigStore.set('links', {
      ...ConfigStore.get('links'),
      sentryUrl: 'https://sentry.example.org',
    });

    const controlMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [usorg, deorg],
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.host === 'https://sentry.example.org';
        },
      ],
    });

    const organizations = await fetchOrganizations(api);

    expect(organizations).toHaveLength(2);
    expect(controlMock).toHaveBeenCalledTimes(1);
  });
});
