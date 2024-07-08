import type {ProjectKey} from 'sentry/types/project';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';

interface ProjectKeysParameters {
  orgSlug: string;
  projSlug?: string;
}

export const makeProjectKeysQueryKey = ({
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
