import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {IssueCategory} from 'sentry/types/group';
import {useReplaysFromIssue} from 'sentry/views/issueDetails/groupReplays/useReplaysFromIssue';

describe('useReplaysFromIssue', () => {
  const initialRouterConfig = {
    route: '/organizations/:orgSlug/issues/:groupId/',
    location: {
      pathname: '/organizations/test-org/issues/1/',
    },
  };

  const location = LocationFixture();

  const organization = OrganizationFixture({
    features: ['session-replay'],
  });

  it.isKnownFlake('should fetch a list of replay ids', async () => {
    const MOCK_GROUP = GroupFixture();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {
        [MOCK_GROUP.id]: ['replay42', 'replay256'],
      },
    });

    const {result} = renderHookWithProviders(useReplaysFromIssue, {
      initialProps: {
        group: MOCK_GROUP,
        location,
        organization,
      },
      initialRouterConfig,
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        eventView: expect.objectContaining({
          query: 'id:[replay42,replay256]',
        }),
        fetchError: undefined,
        isFetching: false,
        pageLinks: null,
      })
    );
  });

  it('should fetch a list of replay ids for a performance issue', async () => {
    const MOCK_GROUP = GroupFixture({issueCategory: IssueCategory.PERFORMANCE});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {
        [MOCK_GROUP.id]: ['replay42', 'replay256'],
      },
    });

    const {result} = renderHookWithProviders(useReplaysFromIssue, {
      initialProps: {
        group: MOCK_GROUP,
        location,
        organization,
      },
      initialRouterConfig,
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        eventView: expect.objectContaining({
          query: 'id:[replay42,replay256]',
        }),
        fetchError: undefined,
        isFetching: false,
        pageLinks: null,
      })
    );
  });

  it('should return an empty EventView when there are no replay_ids returned from the count endpoint', async () => {
    const MOCK_GROUP = GroupFixture();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {},
    });

    const {result} = renderHookWithProviders(useReplaysFromIssue, {
      initialProps: {
        group: MOCK_GROUP,
        location,
        organization,
      },
      initialRouterConfig,
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        eventView: null,
        fetchError: undefined,
        isFetching: false,
        pageLinks: null,
      })
    );
  });
});
