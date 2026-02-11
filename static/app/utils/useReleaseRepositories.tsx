import type {Repository} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';

function getReleaseRepositoriesQueryKey({
  orgSlug,
  projectSlug,
  release,
}: {
  orgSlug: string;
  projectSlug: string;
  release: string;
}): ApiQueryKey {
  return [
    getApiUrl(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/$version/repositories/',
      {
        path: {
          organizationIdOrSlug: orgSlug,
          projectIdOrSlug: projectSlug,
          version: release,
        },
      }
    ),
  ];
}

interface UseReleaseReposProps {
  orgSlug: string;
  projectSlug: string;
  release: string;
  options?: Partial<UseApiQueryOptions<Repository[]>>;
}

export function useReleaseRepositories({
  orgSlug,
  projectSlug,
  release,
  options,
}: UseReleaseReposProps) {
  return useApiQuery<Repository[]>(
    getReleaseRepositoriesQueryKey({
      orgSlug,
      projectSlug,
      release,
    }),
    {
      staleTime: Infinity,
      ...options,
    }
  );
}
