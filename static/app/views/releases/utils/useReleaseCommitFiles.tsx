import type {CommitFile, Repository} from 'sentry/types/integrations';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

// These are the URL params that our project/date/env picker generates (+ cursor for pagination)
type PageFilterUrlParams =
  | 'start'
  | 'end'
  | 'utc'
  | 'statsPeriod'
  | 'project'
  | 'environment';

interface UseReleaseCommitFilesParams
  extends Partial<Record<PageFilterUrlParams, string>> {
  release: string;
  activeRepository?: Repository;
  cursor?: string;
  perPage?: number;
}
export function useReleaseCommitFiles(
  {release, activeRepository, perPage = 40, ...query}: UseReleaseCommitFilesParams,
  queryOptions?: UseApiQueryOptions<CommitFile[]>
) {
  const organization = useOrganization();
  return useApiQuery<CommitFile[]>(
    [
      `/organizations/${organization.slug}/releases/${encodeURIComponent(
        release
      )}/commitfiles/`,
      {
        query: {
          ...query,
          per_page: perPage,
          ...(activeRepository
            ? {
                repo_id: activeRepository.externalId,
                repo_name: activeRepository.name,
              }
            : {}),
        },
      },
    ],
    {
      staleTime: Infinity,
      ...queryOptions,
    }
  );
}
