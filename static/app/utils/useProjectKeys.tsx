import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';

interface ProjectKeysParameters {
  orgSlug: Organization['slug'];
  projSlug?: Project['slug'];
}

const makeProjectKeysQueryKey = ({
  orgSlug,
  projSlug,
}: ProjectKeysParameters): ApiQueryKey => [`/projects/${orgSlug}/${projSlug}/keys/`];

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
