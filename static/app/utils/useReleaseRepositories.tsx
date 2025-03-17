import type {Repository} from 'sentry/types/integrations';
import {
  type ApiQueryKey,
  useApiQuery,
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
    `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(release)}/repositories/`,
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
