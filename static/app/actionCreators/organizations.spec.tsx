import {browserHistory} from 'react-router';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {fetchOrganizations} from 'sentry/actionCreators/organizations';
import ConfigStore from 'sentry/stores/configStore';

describe('fetchOrganizations', function () {
  const api = new MockApiClient();
  const usorg = OrganizationFixture({slug: 'us-org'});
  const deorg = OrganizationFixture({slug: 'de-org'});

  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('has a fallback to regions', async function () {
    // @ts-ignore-next-line Need to simulate undefined
    // key that can happen during deploy
    ConfigStore.set('memberRegions', undefined);
    ConfigStore.set('regions', [
      {name: 'us', url: 'https://us.example.org'},
      {name: 'de', url: 'https://de.example.org'},
    ]);
    const usMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [usorg],
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
    expect(organizations[0].slug).toEqual(usorg.slug);
    expect(usMock).toHaveBeenCalledTimes(1);
    expect(deMock).toHaveBeenCalledTimes(1);
  });

  it('fetches from multiple regions', async function () {
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

  it('ignores 401 errors from a region', async function () {
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
    expect(window.location.reload).not.toHaveBeenCalled();
    expect(browserHistory.replace).not.toHaveBeenCalled();
  });
});
