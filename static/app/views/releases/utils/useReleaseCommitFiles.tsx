import type {CommitFile, Repository} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
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
type OtherUrlParams = 'cursor' | 'perPage';

interface UseReleaseCommitFilesParams
  extends Partial<
    Record<
      PageFilterUrlParams | OtherUrlParams,
      string | string[] | number | null | undefined
    >
  > {
  release: string;
  activeRepository?: Repository;
}
export function useReleaseCommitFiles(
  {release, activeRepository, perPage = 40, ...query}: UseReleaseCommitFilesParams,
  queryOptions?: UseApiQueryOptions<CommitFile[]>
) {
  const organization = useOrganization();
  return useApiQuery<CommitFile[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/releases/$version/commitfiles/', {
        path: {organizationIdOrSlug: organization.slug, version: release},
      }),
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
