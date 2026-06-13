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
import {fetchMutation} from 'sentry/utils/queryClient';
import {organizationRepositoriesInfiniteOptions} from 'sentry/utils/repositories/repoQueryOptions';
import type {
  SeerProjectMutateRepoPayload,
  SeerProjectRepoCreateInput,
  SeerProjectReposResponse,
} from 'sentry/utils/seer/types';

function toOptimisticRepo(
  repo: SeerProjectRepoCreateInput,
  index: number,
  cachedRepo: Repository | undefined
): SeerProjectReposResponse {
  const [owner, name] = (cachedRepo?.name || '/').split('/');
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

// TODO: fetch this whenever a single repo is updated. It's more efficient
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

// TODO: Call this to update a single repo instead of updating everything.
// It's more efficient because we don't need to send/receive the entire list of repos.
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
                  item.id === repoId ? {...item, ...jsonUpdates} : item
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
                data: {
                  ...page,
                  json: Array.isArray(page?.json)
                    ? page.json.filter(
                        (item: SeerProjectReposResponse) => item.id !== repoId
                      )
                    : page?.json,
                },
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

// POST -> add repo
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
      queryClient.invalidateQueries({
        queryKey: variables.repos.map(
          repo =>
            getSeerProjectRepoQueryOptions({
              organization,
              project,
              repoId: repo.repositoryId.toString(),
            }).queryKey
        ),
      });
      queryClient.invalidateQueries({queryKey: [infiniteUrl], exact: false});
    },
  });
}

// PUT -> replace the whole form
// export function getMutateSeerProjectReposOptionsReplaceRepos({
//   organization,
//   project,
//   queryClient,
// }: {
//   organization: Organization;
//   project: AvatarProject;
//   queryClient: QueryClient;
// }) {
//   const infiniteQueryKey = getSeerProjectReposInfiniteQueryOptions({
//     organization,
//     project,
//   }).queryKey;
//   const [infiniteUrl] = infiniteQueryKey;

//   return mutationOptions({
//     mutationFn: (data: {repositories: SeerProjectRepoCreateInput[]}) => {
//       return fetchMutation({
//         method: 'PUT',
//         url: infiniteUrl,
//         data,
//       });
//     },
//     onMutate: async ({repositories}: {repositories: SeerProjectRepoCreateInput[]}) => {
//       await queryClient.cancelQueries({queryKey: [infiniteUrl], exact: false});

//       const previousInfinite = queryClient.getQueryData(infiniteQueryKey);
//       const repoLookup = getRepoLookupFromCache(queryClient, organization);
//       const optimisticItems = repositories.map((repo, index) =>
//         toOptimisticRepo(repo, index, repoLookup.get(String(repo.repositoryId)))
//       );

//       queryClient.setQueriesData(
//         {queryKey: [infiniteUrl], exact: false},
//         (prev: InfiniteData<ApiResponse<SeerProjectReposResponse[]>> | undefined) => {
//           if (prev && prev.pages.length > 0) {
//             return {
//               ...prev,
//               pages: [
//                 {...prev.pages[0]!, json: optimisticItems},
//                 ...prev.pages.slice(1).map(page => ({...page, json: []})),
//               ],
//             };
//           }
//           return prev;
//         }
//       );

//       return {previousInfinite, infiniteUrl};
//     },
//     onError: (_error, _data, context) => {
//       if (context?.infiniteUrl) {
//         queryClient.invalidateQueries({queryKey: [context.infiniteUrl], exact: false});
//       }
//     },
//     onSettled: () => {
//       queryClient.invalidateQueries({queryKey: [infiniteUrl], exact: false});
//     },
//   });
// }
