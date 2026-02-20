// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectReplayDetailsResponse {
  data: unknown;
}

interface ProjectReplayDetailsQueryParams {
  end?: string;
  environment?: string;
  field?: string[];
  project?: string;
  start?: string;
  statsPeriod?: string;
}

type TQueryData = ApiResponse<ProjectReplayDetailsResponse>;
type TData = ProjectReplayDetailsResponse;

/** @public */
export function projectReplayDetailsOptions(
  organization: Organization,
  project: Project,
  replayId: string,
  query?: ProjectReplayDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/',
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
