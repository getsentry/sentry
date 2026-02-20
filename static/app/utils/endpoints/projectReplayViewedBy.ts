// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectReplayViewedByResponse {
  data: unknown;
}

interface ProjectReplayViewedByQueryParams {
  end?: string;
  environment?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
}

type TQueryData = ApiResponse<ProjectReplayViewedByResponse>;
type TData = ProjectReplayViewedByResponse;

/**
 * @public
 * Return a list of users who have viewed a replay.
 */
export function projectReplayViewedByOptions(
  organization: Organization,
  project: Project,
  replayId: string,
  query?: ProjectReplayViewedByQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/viewed-by/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          replayId,
        },
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
