import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useFetchIssueTags} from 'sentry/views/issueList/utils/useFetchIssueTags';

describe('useFetchIssueTags', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [],
    });
  });

  it('merges tag keys named like Object properties', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/`,
      body: [
        {key: '__proto__', name: '__proto__', totalValues: 1},
        {key: 'constructor', name: 'constructor', totalValues: 2},
      ],
      match: [MockApiClient.matchQuery({dataset: 'events'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/`,
      body: [
        {key: 'constructor', name: 'constructor', totalValues: 3},
        {key: 'toString', name: 'toString', totalValues: 4},
      ],
      match: [MockApiClient.matchQuery({dataset: 'search_issues'})],
    });

    const {result} = renderHookWithProviders(
      () => useFetchIssueTags({org: organization, projectIds: []}),
      {organization}
    );

    await waitFor(() =>
      expect(Object.hasOwn(result.current.tags, 'toString')).toBe(true)
    );

    const tags = new Map(Object.entries(result.current.tags));
    expect(tags.get('__proto__')?.totalValues).toBe(1);
    expect(tags.get('constructor')?.totalValues).toBe(5);
    expect(tags.get('toString')?.totalValues).toBe(4);
  });
});
