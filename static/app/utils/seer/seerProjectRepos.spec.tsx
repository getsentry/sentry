import type {QueryClient} from '@tanstack/react-query';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  fetchProjectHasNonGithubRepo,
  getDeleteSeerProjectRepoOptions,
  getMutateSeerProjectReposOptionsAddRepo,
  getSeerProjectReposInfiniteQueryOptions,
} from 'sentry/utils/seer/seerProjectRepos';
import {getInfiniteSeerProjectsSettingsQueryOptions} from 'sentry/utils/seer/seerProjectSettings';
import {getInfiniteSeerProjectSuggestionsQueryOptions} from 'sentry/utils/seer/seerProjectSuggestions';

const organization = OrganizationFixture({slug: 'org-slug'});
const project = {slug: 'project-slug'};
const reposUrl = `/projects/${organization.slug}/${project.slug}/seer/repos/`;

function makeRepo(provider: string, id: string) {
  return {
    id,
    repositoryId: id,
    branchName: '',
    branchOverrides: [],
    instructions: '',
    externalId: `10${id}`,
    integrationId: `20${id}`,
    name: 'sentry',
    organizationId: '',
    owner: 'getsentry',
    provider,
  };
}

describe('fetchProjectHasNonGithubRepo', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('drains later pages when the cache only holds a fresh first page', async () => {
    // Page 1 is all GitHub and advertises a `next` page via the Link header.
    MockApiClient.addMockResponse({
      url: reposUrl,
      body: [makeRepo('github', '1')],
      headers: {
        Link: `<${reposUrl}?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"`,
      },
    });
    // Page 2 carries the GitLab repo and terminates pagination.
    MockApiClient.addMockResponse({
      url: reposUrl,
      body: [makeRepo('gitlab', '2')],
      headers: {
        Link: `<${reposUrl}?cursor=0:200:0>; rel="next"; results="false"; cursor="0:200:0"`,
      },
      match: [MockApiClient.matchQuery({cursor: '0:100:0'})],
    });

    const queryClient = makeTestQueryClient();
    // Simulate another consumer that fetched only the first page, leaving a
    // fresh but partial entry in the shared cache. `fetchInfiniteQuery` without
    // a `pages` option fetches a single page.
    await queryClient.fetchInfiniteQuery(
      getSeerProjectReposInfiniteQueryOptions({organization, project})
    );

    // The guard must not trust the fresh partial cache: it detects the pending
    // next page and drains it, catching the second-page GitLab repo.
    await expect(
      fetchProjectHasNonGithubRepo({organization, project, queryClient})
    ).resolves.toBe(true);
  });

  it('reuses a fresh, complete cache without re-fetching', async () => {
    // Single GitHub page with no `next` cursor — a complete result.
    const reposMock = MockApiClient.addMockResponse({
      url: reposUrl,
      body: [makeRepo('github', '1')],
    });

    const queryClient = makeTestQueryClient();
    await queryClient.fetchInfiniteQuery(
      getSeerProjectReposInfiniteQueryOptions({organization, project})
    );
    expect(reposMock).toHaveBeenCalledTimes(1);

    await expect(
      fetchProjectHasNonGithubRepo({organization, project, queryClient})
    ).resolves.toBe(false);
    // The complete fresh cache is reused; no extra request is made.
    expect(reposMock).toHaveBeenCalledTimes(1);
  });
});

describe('organization list refresh after repo changes', () => {
  const settingsListQueryKey = getInfiniteSeerProjectsSettingsQueryOptions({
    organization,
    query: {},
  }).queryKey;
  const suggestionsQueryKey = getInfiniteSeerProjectSuggestionsQueryOptions({
    organization,
    enabled: true,
  }).queryKey;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  // Repo membership decides whether a project appears in the org suggestions
  // or settings list, so both cached lists must go stale after add/remove. A
  // missing invalidation fails silently: the table just stays outdated until
  // a reload.
  function seedListCaches(queryClient: QueryClient) {
    const emptyList = {pages: [{headers: {}, json: []}], pageParams: [undefined]};
    queryClient.setQueryData(settingsListQueryKey, emptyList);
    queryClient.setQueryData(suggestionsQueryKey, emptyList);
  }

  function expectListsInvalidated(queryClient: QueryClient) {
    expect(queryClient.getQueryState(settingsListQueryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(suggestionsQueryKey)?.isInvalidated).toBe(true);
  }

  it('invalidates both org lists after removing a repo', async () => {
    const deleteMock = MockApiClient.addMockResponse({
      url: `${reposUrl}1/`,
      method: 'DELETE',
      body: {},
    });

    const {result} = renderHookWithProviders(
      () => {
        const queryClient = useQueryClient();
        return {
          queryClient,
          mutation: useMutation(
            getDeleteSeerProjectRepoOptions({organization, project, queryClient})
          ),
        };
      },
      {organization}
    );
    seedListCaches(result.current.queryClient);

    result.current.mutation.mutate({repoId: '1'});

    await waitFor(() => expect(deleteMock).toHaveBeenCalled());
    await waitFor(() => expectListsInvalidated(result.current.queryClient));
  });

  it('invalidates both org lists after adding repos', async () => {
    const addMock = MockApiClient.addMockResponse({
      url: reposUrl,
      method: 'POST',
      body: {},
    });

    const {result} = renderHookWithProviders(
      () => {
        const queryClient = useQueryClient();
        return {
          queryClient,
          mutation: useMutation(
            getMutateSeerProjectReposOptionsAddRepo({organization, project, queryClient})
          ),
        };
      },
      {organization}
    );
    seedListCaches(result.current.queryClient);

    result.current.mutation.mutate({repos: [{repositoryId: '7'}]});

    await waitFor(() => expect(addMock).toHaveBeenCalled());
    await waitFor(() => expectListsInvalidated(result.current.queryClient));
  });
});
