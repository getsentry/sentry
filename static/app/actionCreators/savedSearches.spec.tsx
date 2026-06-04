import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {SavedSearchType} from 'sentry/types/group';

import {NAMESPACE_SYMBOL, useFetchRecentSearches} from './savedSearches';

describe('useFetchRecentSearches', () => {
  const organization = OrganizationFixture();

  it('successfully filters out the added prefix in results', async () => {
    const namespace = 'metric_name';
    const namespacePrefix = `${NAMESPACE_SYMBOL}namespace${NAMESPACE_SYMBOL}${namespace}${NAMESPACE_SYMBOL}`;

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      body: [
        {
          id: '1',
          organizationId: organization.id,
          type: SavedSearchType.TRACEMETRIC,
          query: `${namespacePrefix}browser.name:firefox`,
          dateCreated: '2021-01-01T00:00:00.000Z',
          lastSeen: '2021-01-01T00:00:00.000Z',
        },
        {
          id: '2',
          organizationId: organization.id,
          type: SavedSearchType.TRACEMETRIC,
          query: `${namespacePrefix}browser.name:chrome`,
          dateCreated: '2021-01-01T00:00:00.000Z',
          lastSeen: '2021-01-01T00:00:00.000Z',
        },
      ],
    });

    const {result} = renderHookWithProviders(
      () =>
        useFetchRecentSearches({
          savedSearchType: SavedSearchType.TRACEMETRIC,
          namespace,
        }),
      {organization}
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]?.query).toBe('browser.name:firefox');
    expect(result.current.data?.[1]?.query).toBe('browser.name:chrome');
  });
});
