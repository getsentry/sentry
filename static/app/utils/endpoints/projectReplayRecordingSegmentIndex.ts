// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectReplayRecordingSegmentIndexResponse {
  // No response keys detected — fill in manually
}

interface ProjectReplayRecordingSegmentIndexQueryParams {
  /** A pointer to the last object fetched and its sort order; used to retrieve the next or previous results. */
  cursor?: string;
  /** Limit the number of rows to return in the result. Default and maximum allowed is 100. */
  per_page?: number;
}

type TQueryData = ApiResponse<ProjectReplayRecordingSegmentIndexResponse>;
type TData = ProjectReplayRecordingSegmentIndexResponse;

/**
 * @public
 * Return a collection of replay recording segments.
 */
export function projectReplayRecordingSegmentIndexOptions(
  organization: Organization,
  project: Project,
  replayId: string,
  query?: ProjectReplayRecordingSegmentIndexQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/recording-segments/',
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
