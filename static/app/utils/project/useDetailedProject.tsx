import type {Project} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';

interface DetailedProjectParameters {
  orgSlug: string;
  projectSlug: string;
}

export const makeDetailedProjectQueryKey = ({
  orgSlug,
  projectSlug,
}: DetailedProjectParameters): ApiQueryKey => [
  getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/', {
    path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
  }),
];

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
