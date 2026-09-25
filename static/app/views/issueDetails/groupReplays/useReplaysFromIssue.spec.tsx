import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {IssueCategory} from 'sentry/types/group';
import {useReplaysFromIssue} from 'sentry/views/issueDetails/groupReplays/useReplaysFromIssue';

describe('useReplaysFromIssue', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

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

  it('keeps the newest environment results when an older request finishes last', async () => {
    const group = GroupFixture();
    const productionResponse = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      match: [MockApiClient.matchQuery({environment: 'production'})],
      body: {[group.id]: ['production-replay']},
      asyncDelay: productionResponse.promise,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      match: [MockApiClient.matchQuery({environment: 'staging'})],
      body: {[group.id]: ['staging-replay']},
    });
    const {result, rerender} = renderHookWithProviders(useReplaysFromIssue, {
      initialProps: {
        group,
        location: LocationFixture({query: {environment: 'production'}}),
        organization,
      },
      initialRouterConfig,
    });

    rerender({
      group,
      location: LocationFixture({query: {environment: 'staging'}}),
      organization,
    });
    await waitFor(() => {
      expect(result.current.eventView?.query).toBe('id:[staging-replay]');
    });

    await act(() => {
      productionResponse.resolve();
      return productionResponse.promise;
    });
    expect(result.current.eventView?.query).toBe('id:[staging-replay]');
  });

  it('finishes loading after a failed lookup and clears the error after changing environments', async () => {
    const group = GroupFixture();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      match: [MockApiClient.matchQuery({environment: 'production'})],
      statusCode: 503,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      match: [MockApiClient.matchQuery({environment: 'staging'})],
      body: {[group.id]: ['staging-replay']},
    });
    const {result, rerender} = renderHookWithProviders(useReplaysFromIssue, {
      initialProps: {
        group,
        location: LocationFixture({query: {environment: 'production'}}),
        organization,
      },
      initialRouterConfig,
    });

    await waitFor(() => expect(result.current.fetchError).toBeDefined());
    expect(result.current.isFetching).toBe(false);

    rerender({
      group,
      location: LocationFixture({query: {environment: 'staging'}}),
      organization,
    });
    await waitFor(() => {
      expect(result.current.eventView?.query).toBe('id:[staging-replay]');
    });
    expect(result.current.fetchError).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
  });

  it('clears the old replay selection while a different issue is loading', async () => {
    const group = GroupFixture();
    const otherGroup = GroupFixture({id: '2'});
    const otherResponse = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      match: [MockApiClient.matchQuery({query: `issue.id:[${group.id}]`})],
      body: {[group.id]: ['first-issue-replay']},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      match: [MockApiClient.matchQuery({query: `issue.id:[${otherGroup.id}]`})],
      body: {[otherGroup.id]: ['second-issue-replay']},
      asyncDelay: otherResponse.promise,
    });
    const {result, rerender} = renderHookWithProviders(useReplaysFromIssue, {
      initialProps: {group, location, organization},
      initialRouterConfig,
    });
    await waitFor(() => {
      expect(result.current.eventView?.query).toBe('id:[first-issue-replay]');
    });

    rerender({group: otherGroup, location, organization});
    expect(result.current.eventView).toBeNull();
    expect(result.current.isFetching).toBe(true);

    await act(() => {
      otherResponse.resolve();
      return otherResponse.promise;
    });
    await waitFor(() => {
      expect(result.current.eventView?.query).toBe('id:[second-issue-replay]');
    });
  });

  it('should fetch a list of replay ids', async () => {
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
        refetch: expect.any(Function),
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
        refetch: expect.any(Function),
      })
    );
  });

  it('should return an empty EventView when there are no replay_ids returned from the count endpoint', async () => {
    const MOCK_GROUP = GroupFixture();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {
        [MOCK_GROUP.id]: [],
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
        eventView: null,
        fetchError: undefined,
        isFetching: false,
        pageLinks: null,
        refetch: expect.any(Function),
      })
    );
  });
});
