// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectReplayDeletionJobDetailResponse {
  data: unknown;
}

type TQueryData = ApiResponse<ProjectReplayDeletionJobDetailResponse>;
type TData = ProjectReplayDeletionJobDetailResponse;

/**
 * @public
 * Fetch a replay delete job instance.
 */
export function projectReplayDeletionJobDetailOptions(
  organization: Organization,
  project: Project,
  jobId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/jobs/delete/$jobId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          jobId,
        },
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
