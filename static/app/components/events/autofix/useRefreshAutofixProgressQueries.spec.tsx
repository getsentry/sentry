import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useRefreshAutofixProgressQueries} from 'sentry/components/events/autofix/useRefreshAutofixProgressQueries';
import {linkedPullRequestsApiOptions} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

const organization = OrganizationFixture({slug: 'org-slug'});
const GROUP_ID = '1337';

/**
 * Mounts the queries the panel slides over, in the shapes their real call sites
 * use, so the assertions exercise key matching rather than a copy of the hook's
 * own URL list.
 */
function useSubjectQueries() {
  const org = useOrganization();
  const path = {organizationIdOrSlug: org.slug};

  // Two inbox sections: proves one invalidation covers every section's query.
  useInfiniteQuery(
    apiOptions.asInfinite<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path,
      query: {query: 'issue.progress:diagnosed is:unresolved', sort: 'progress'},
      staleTime: 0,
    })
  );
  useInfiniteQuery(
    apiOptions.asInfinite<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path,
      query: {query: 'issue.progress:fix_proposed is:unresolved', sort: 'progress'},
      staleTime: 0,
    })
  );

  useQuery(
    apiOptions.as<Record<string, number>>()(
      '/organizations/$organizationIdOrSlug/issues-count/',
      {path, query: {query: ['is:unresolved']}, staleTime: 180_000}
    )
  );

  useQuery(
    linkedPullRequestsApiOptions({
      groupId: GROUP_ID,
      organizationSlug: org.slug,
      includeChecksAndReview: false,
    })
  );

  // Two overview expands: the status one polls on its own, the stats one never
  // does, and both must be reached by the single autofix-overview entry.
  useQuery(
    apiOptions.as<unknown>()(
      '/organizations/$organizationIdOrSlug/seer/autofix-overview/',
      {path, query: {expand: ['status']}, staleTime: 30_000}
    )
  );
  useQuery(
    apiOptions.as<unknown>()(
      '/organizations/$organizationIdOrSlug/seer/autofix-overview/',
      {path, query: {expand: ['issueStats']}, staleTime: 30_000}
    )
  );

  // Control: an endpoint autofix does not affect, to catch over-broad matching.
  useQuery(
    apiOptions.as<unknown>()('/organizations/$organizationIdOrSlug/projects/', {
      path,
      staleTime: 30_000,
    })
  );

  return useRefreshAutofixProgressQueries(GROUP_ID);
}

describe('useRefreshAutofixProgressQueries', () => {
  let issuesMock: jest.Mock;
  let issuesCountMock: jest.Mock;
  let pullRequestsMock: jest.Mock;
  let overviewMock: jest.Mock;
  let projectsMock: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    issuesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [],
    });
    issuesCountMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues-count/`,
      body: {},
    });
    pullRequestsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${GROUP_ID}/pull-requests/`,
      body: {pullRequests: []},
    });
    overviewMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      body: {runsByMilestone: {}},
    });
    projectsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
  });

  it('refetches every view that reports autofix progress', async () => {
    const {result} = renderHookWithProviders(useSubjectQueries, {organization});

    await waitFor(() => expect(issuesMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(overviewMock).toHaveBeenCalledTimes(2));
    expect(issuesCountMock).toHaveBeenCalledTimes(1);
    expect(pullRequestsMock).toHaveBeenCalledTimes(1);
    expect(projectsMock).toHaveBeenCalledTimes(1);

    act(() => result.current());

    // Both inbox sections and both overview expands, despite differing query params.
    await waitFor(() => expect(issuesMock).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(overviewMock).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(issuesCountMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(pullRequestsMock).toHaveBeenCalledTimes(2));
  });

  it('leaves unrelated queries alone', async () => {
    const {result} = renderHookWithProviders(useSubjectQueries, {organization});

    await waitFor(() => expect(projectsMock).toHaveBeenCalledTimes(1));

    act(() => result.current());

    await waitFor(() => expect(issuesCountMock).toHaveBeenCalledTimes(2));
    expect(projectsMock).toHaveBeenCalledTimes(1);
  });
});
