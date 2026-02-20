// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectReplayRecordingSegmentDetailsResponse {
  // No response keys detected — fill in manually
}

interface ProjectReplayRecordingSegmentDetailsQueryParams {
  download?: string;
}

type TQueryData = ApiResponse<ProjectReplayRecordingSegmentDetailsResponse>;
type TData = ProjectReplayRecordingSegmentDetailsResponse;

/**
 * @public
 * Return a replay recording segment.
 */
export function projectReplayRecordingSegmentDetailsOptions(
  organization: Organization,
  project: Project,
  replayId: string,
  segmentId: string,
  query?: ProjectReplayRecordingSegmentDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/recording-segments/$segmentId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          replayId,
          segmentId,
        },
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
