import {
  type InfiniteData,
  mutationOptions,
  type QueryClient,
} from '@tanstack/react-query';

import type {Repository} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import {fetchMutation} from 'sentry/utils/queryClient';
import {organizationRepositoriesInfiniteOptions} from 'sentry/utils/repositories/repoQueryOptions';
import type {
  SeerProjectMutateRepoPayload,
  SeerProjectRepoCreateInput,
  SeerProjectReposResponse,
} from 'sentry/utils/seer/types';

export function isGitHubProvider(provider: string): boolean {
  // Provider strings arrive in two shapes depending on the source: the bare
  // form (`github`) from Seer/autofix repos and the prefixed form
  // (`integrations:github`) from Sentry integration configs.
  return (
    provider === 'github' ||
    provider === 'github_enterprise' ||
    provider === 'integrations:github' ||
    provider === 'integrations:github_enterprise'
  );
}

function toOptimisticRepo(
  repo: SeerProjectRepoCreateInput,
  index: number,
  cachedRepo: Repository | undefined
): SeerProjectReposResponse {
  // See also: src/sentry/seer/endpoints/project_seer_repos.py::_serialize_project_repo()
  const repoFullName = cachedRepo?.name || '';
  const slashIndex = repoFullName.indexOf('/');
  const owner = slashIndex >= 0 ? repoFullName.slice(0, slashIndex) : '';
  const name = slashIndex >= 0 ? repoFullName.slice(slashIndex + 1) : repoFullName;
  return {
    id: `optimistic-${index}-${Date.now()}`,
    repositoryId: String(repo.repositoryId),
    branchName: repo.branchName ?? '',
    branchOverrides: (repo.branchOverrides ?? []).map((o, i) => ({
      ...o,
      id: String(i),
    })),
    instructions: repo.instructions ?? '',
    externalId: cachedRepo?.externalId ?? '',
    integrationId: cachedRepo?.integrationId ?? '',
    name: name || cachedRepo?.name || '',
    organizationId: '',
    owner: owner || '',
    provider: cachedRepo?.provider?.name?.toLowerCase() ?? '',
  };
}

function getRepoLookupFromCache(
  queryClient: QueryClient,
  organization: Organization
): Map<string, Repository> {
  const options = organizationRepositoriesInfiniteOptions({organization});
  const cached = queryClient.getQueryData(options.queryKey);
  const lookup = new Map<string, Repository>();
  if (cached) {
    for (const page of cached.pages) {
      for (const repo of page.json) {
        lookup.set(repo.id, repo);
      }
    }
  }
  return lookup;
}

function getSeerProjectRepoQueryOptions({
  organization,
  project,
  repoId,
}: {
  organization: Organization;
  project: AvatarProject;
  repoId: string;
}) {
  return apiOptions.as<SeerProjectReposResponse>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/repos/$repoId/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        projectIdOrSlug: project.slug,
        repoId,
      },
      staleTime: 60_000, // 1 minute
    }
  );
}

export function getMutateSeerProjectRepoOptions({
  organization,
  project,
  queryClient,
  repoId,
}: {
  organization: Organization;
  project: AvatarProject;
  queryClient: QueryClient;
  repoId: string;
}) {
  const singleQueryKey = getSeerProjectRepoQueryOptions({
    organization,
    project,
    repoId,
  }).queryKey;
  const [singleUrl] = singleQueryKey;

  const infiniteQueryKey = getSeerProjectReposInfiniteQueryOptions({
    organization,
    project,
  }).queryKey;
  const [infiniteUrl] = infiniteQueryKey;

  return mutationOptions({
    mutationFn: (data: SeerProjectMutateRepoPayload) => {
      return fetchMutation<SeerProjectReposResponse>({
        method: 'PUT',
        url: singleUrl,
        data,
      });
    },
    onMutate: async (data: SeerProjectMutateRepoPayload) => {
      await queryClient.cancelQueries({queryKey: singleQueryKey});
      await queryClient.cancelQueries({queryKey: [infiniteUrl], exact: false});

      const previousSingle = queryClient.getQueryData(singleQueryKey);
      const previousInfinite = queryClient.getQueryData(infiniteQueryKey);

      const jsonUpdates: Partial<SeerProjectReposResponse> = {};
      if (data.branchName !== undefined) {
        jsonUpdates.branchName = data.branchName ?? '';
      }
      if (data.branchOverrides !== undefined) {
        jsonUpdates.branchOverrides = data.branchOverrides.map((o, i) => ({
          ...o,
          id: String(i),
        }));
      }
      if (data.instructions !== undefined) {
        jsonUpdates.instructions = data.instructions ?? '';
      }

      queryClient.setQueryData(
        singleQueryKey,
        (prev: ApiResponse<SeerProjectReposResponse> | undefined) => {
          if (prev) {
            return {...prev, json: {...prev.json, ...jsonUpdates}};
          }
          return prev;
        }
      );

      queryClient.setQueriesData(
        {queryKey: [infiniteUrl], exact: false},
        (prev: InfiniteData<ApiResponse<SeerProjectReposResponse[]>> | undefined) => {
          if (prev) {
            return {
              ...prev,
              pages: prev.pages.map(page => ({
                ...page,
                json: page.json.map(item =>
                  item.repositoryId === repoId ? {...item, ...jsonUpdates} : item
                ),
              })),
            };
          }
          return prev;
        }
      );

      return {previousSingle, previousInfinite, infiniteUrl};
    },
    onError: (_error, _data, context) => {
      queryClient.setQueryData(singleQueryKey, context?.previousSingle);
      if (context?.infiniteUrl) {
        queryClient.invalidateQueries({queryKey: [context.infiniteUrl], exact: false});
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: singleQueryKey});
      queryClient.invalidateQueries({queryKey: [infiniteUrl], exact: false});
    },
  });
}

export function getDeleteSeerProjectRepoOptions({
  organization,
  project,
  queryClient,
}: {
  organization: Organization;
  project: AvatarProject;
  queryClient: QueryClient;
}) {
  const infiniteQueryKey = getSeerProjectReposInfiniteQueryOptions({
    organization,
    project,
  }).queryKey;
  const [infiniteUrl] = infiniteQueryKey;

  return mutationOptions({
    mutationFn: ({repoId}: {repoId: string}) => {
      const [singleUrl] = getSeerProjectRepoQueryOptions({
        organization,
        project,
        repoId,
      }).queryKey;

      return fetchMutation({
        method: 'DELETE',
        url: singleUrl,
        data: {repoId},
      });
    },
    onMutate: async ({repoId}: {repoId: string}) => {
      const singleQueryKey = getSeerProjectRepoQueryOptions({
        organization,
        project,
        repoId,
      }).queryKey;

      await queryClient.cancelQueries({queryKey: singleQueryKey});
      await queryClient.cancelQueries({queryKey: [infiniteUrl], exact: false});

      const previousSingle = queryClient.getQueryData(singleQueryKey);
      const previousInfinite = queryClient.getQueryData(infiniteQueryKey);

      queryClient.removeQueries({queryKey: singleQueryKey});

      queryClient.setQueriesData(
        {queryKey: [infiniteUrl], exact: false},
        (prev: InfiniteData<ApiResponse<SeerProjectReposResponse[]>> | undefined) => {
          if (prev) {
            return {
              ...prev,
              pages: prev.pages.map(page => ({
                ...page,
                json: page.json.filter(
                  (item: SeerProjectReposResponse) => item.repositoryId !== repoId
                ),
              })),
            };
          }
          return prev;
        }
      );

      return {previousSingle, previousInfinite, singleQueryKey, infiniteUrl};
    },
    onError: (_error, _data, context) => {
      if (context?.singleQueryKey) {
        queryClient.setQueryData(context.singleQueryKey, context.previousSingle);
      }
      if (context?.infiniteUrl) {
        queryClient.invalidateQueries({queryKey: [context.infiniteUrl], exact: false});
      }
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.singleQueryKey) {
        queryClient.invalidateQueries({queryKey: context.singleQueryKey});
      }
      queryClient.invalidateQueries({queryKey: [infiniteUrl], exact: false});
    },
  });
}

export function getSeerProjectReposInfiniteQueryOptions({
  organization,
  project,
}: {
  organization: Organization;
  project: AvatarProject;
}) {
  return apiOptions.asInfinite<SeerProjectReposResponse[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/repos/',
    {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      staleTime: 60_000, // 1 minute
    }
  );
}

// `fetchInfiniteQuery`/`prefetchInfiniteQuery` only paginate when the query
// actually fetches; a large `pages` cap then drains every page because
// `getNextPageParam` returns null once the `Link` header has no `next` cursor,
// stopping the fetch well before this bound.
const DRAIN_ALL_PAGES = Number.MAX_SAFE_INTEGER;

type SeerProjectReposInfiniteData = InfiniteData<
  ApiResponse<SeerProjectReposResponse[]>,
  ParsedHeader | undefined
>;

/**
 * Whether the cached infinite data still has an un-fetched next page, i.e. the
 * last page's `Link` header advertises a `next` cursor.
 */
function reposCacheHasMorePages(
  options: ReturnType<typeof getSeerProjectReposInfiniteQueryOptions>,
  data: SeerProjectReposInfiniteData
): boolean {
  const lastIndex = data.pages.length - 1;
  if (lastIndex < 0) {
    return false;
  }
  // A next-page param is a `ParsedHeader` object (truthy) when there are more
  // pages, and null/undefined when the last page has no `next` cursor.
  return Boolean(
    options.getNextPageParam(
      data.pages[lastIndex]!,
      data.pages,
      data.pageParams[lastIndex],
      data.pageParams
    )
  );
}

/**
 * Prefetch every page of a project's Seer repos to warm the cache.
 *
 * Pairs with {@link fetchProjectHasNonGithubRepo}: warming all pages up front
 * lets the later gating check resolve from cache instead of re-fetching.
 */
export function prefetchAllSeerProjectRepos({
  organization,
  project,
  queryClient,
}: {
  organization: Organization;
  project: AvatarProject;
  queryClient: QueryClient;
}) {
  return queryClient.prefetchInfiniteQuery({
    ...getSeerProjectReposInfiniteQueryOptions({organization, project}),
    pages: DRAIN_ALL_PAGES,
  });
}

/**
 * Fetch every page of a project's Seer repos and report whether any of them is
 * not a GitHub repo.
 *
 * Coding-agent handoff only works for GitHub, so callers use this to gate
 * non-Seer agent selection. This is the imperative counterpart to the
 * `useFetchAllPages` + `isGitHubProvider` pattern in the Seer drawer's
 * `useCodingAgents` hook — a non-GitHub repo on a later page must still be
 * caught, so we drain all pages rather than inspecting only the first.
 *
 * `fetchInfiniteQuery` returns a fresh cache as-is without paginating, so a
 * partial (e.g. page-1-only) entry left by another consumer — or a fetch
 * deduped against another consumer's in-flight single-page load — would
 * short-circuit the drain and hide non-GitHub repos on later pages. Guard
 * against that by re-fetching with `staleTime: 0` whenever the result still has
 * an un-fetched next page: on an empty/stale query this drains every page. The
 * re-fetch is single-shot, so in the rare case where it dedupes onto another
 * consumer's still-in-flight incremental drain it may resolve before every page
 * lands; the next selection re-runs the check against a by-then-complete cache.
 */
export async function fetchProjectHasNonGithubRepo({
  organization,
  project,
  queryClient,
}: {
  organization: Organization;
  project: AvatarProject;
  queryClient: QueryClient;
}): Promise<boolean> {
  const options = getSeerProjectReposInfiniteQueryOptions({organization, project});
  let data = await queryClient.fetchInfiniteQuery({...options, pages: DRAIN_ALL_PAGES});
  if (reposCacheHasMorePages(options, data)) {
    data = await queryClient.fetchInfiniteQuery({
      ...options,
      pages: DRAIN_ALL_PAGES,
      staleTime: 0,
    });
  }
  return data.pages
    .flatMap(page => page.json)
    .some(repo => !isGitHubProvider(repo.provider));
}

export function getMutateSeerProjectReposOptionsAddRepo({
  organization,
  project,
  queryClient,
}: {
  organization: Organization;
  project: AvatarProject;
  queryClient: QueryClient;
}) {
  const infiniteQueryKey = getSeerProjectReposInfiniteQueryOptions({
    organization,
    project,
  }).queryKey;
  const [infiniteUrl] = infiniteQueryKey;

  return mutationOptions({
    mutationFn: (data: {repos: SeerProjectRepoCreateInput[]}) => {
      return fetchMutation({
        method: 'POST',
        url: infiniteUrl,
        data,
      });
    },
    onMutate: async (data: {repos: SeerProjectRepoCreateInput[]}) => {
      await queryClient.cancelQueries({queryKey: [infiniteUrl], exact: false});

      const previousInfinite = queryClient.getQueryData(infiniteQueryKey);
      const repoLookup = getRepoLookupFromCache(queryClient, organization);
      const optimisticItems = data.repos.map((repo, index) =>
        toOptimisticRepo(repo, index, repoLookup.get(String(repo.repositoryId)))
      );

      queryClient.setQueriesData(
        {queryKey: [infiniteUrl], exact: false},
        (prev: InfiniteData<ApiResponse<SeerProjectReposResponse[]>> | undefined) => {
          if (prev && prev.pages.length > 0) {
            const lastPageIndex = prev.pages.length - 1;
            return {
              ...prev,
              pages: prev.pages.map((page, i) =>
                i === lastPageIndex
                  ? {...page, json: [...page.json, ...optimisticItems]}
                  : page
              ),
            };
          }
          return prev;
        }
      );

      return {previousInfinite, infiniteUrl};
    },
    onError: (_error, _data, context) => {
      if (context?.infiniteUrl) {
        queryClient.invalidateQueries({queryKey: [context.infiniteUrl], exact: false});
      }
    },
    onSettled: (_data, _error, variables, _context) => {
      for (const repo of variables.repos) {
        queryClient.invalidateQueries({
          queryKey: getSeerProjectRepoQueryOptions({
            organization,
            project,
            repoId: repo.repositoryId.toString(),
          }).queryKey,
        });
      }
      queryClient.invalidateQueries({queryKey: [infiniteUrl], exact: false});
    },
  });
}
