import type {Project} from 'sentry/types/project';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';

interface DetailedProjectParameters {
  orgSlug: string;
  projectSlug: string;
}

export const makeDetailedProjectQueryKey = ({
  orgSlug,
  projectSlug,
}: DetailedProjectParameters): ApiQueryKey => [`/projects/${orgSlug}/${projectSlug}/`];

export function useDetailedProject(
  params: DetailedProjectParameters,
  options: Partial<UseApiQueryOptions<Project>> = {}
) {
  return useApiQuery<Project>(makeDetailedProjectQueryKey(params), {
    staleTime: Infinity,
    retry: false,
    ...options,
  });
}
