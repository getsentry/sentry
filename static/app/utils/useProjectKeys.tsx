import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';

interface ProjectKeysParameters {
  orgSlug: Organization['slug'];
  projSlug?: Project['slug'];
}

const makeProjectKeysQueryKey = ({
  orgSlug,
  projSlug,
}: ProjectKeysParameters): ApiQueryKey => [
  getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/keys/', {
    path: {
      organizationIdOrSlug: orgSlug,
      projectIdOrSlug: projSlug!,
    },
  }),
];

export function useProjectKeys(
  params: ProjectKeysParameters,
  options: Partial<UseApiQueryOptions<ProjectKey[]>> = {}
) {
  return useApiQuery<ProjectKey[]>(makeProjectKeysQueryKey(params), {
    staleTime: Infinity,
    retry: false,
    enabled: !!params.projSlug,
    ...options,
  });
}
