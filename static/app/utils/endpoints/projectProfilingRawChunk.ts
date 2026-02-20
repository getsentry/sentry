// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectProfilingRawChunkResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<ProjectProfilingRawChunkResponse>;
type TData = ProjectProfilingRawChunkResponse;

/** @public */
export function projectProfilingRawChunkOptions(
  organization: Organization,
  project: Project,
  profilerId: string,
  chunkId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/profiling/raw_chunks/$profilerId/$chunkId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          profilerId,
          chunkId,
        },
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
