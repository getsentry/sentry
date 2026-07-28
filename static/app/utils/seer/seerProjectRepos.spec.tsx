import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';

import {
  fetchProjectHasNonGithubRepo,
  getSeerProjectReposInfiniteQueryOptions,
} from 'sentry/utils/seer/seerProjectRepos';

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
