// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface SourceMapDebugResponse {
  errors: unknown;
}

interface SourceMapDebugQueryParams {
  /** Index of the exception that should be used for source map resolution. */
  exception_idx: number;
  /** Index of the frame that should be used for source map resolution. */
  frame_idx: number;
}

type TQueryData = ApiResponse<SourceMapDebugResponse>;
type TData = SourceMapDebugResponse;

/**
 * @public
 * Return a list of source map errors for a given event.
 */
export function sourceMapDebugOptions(
  organization: Organization,
  project: Project,
  eventId: string,
  query?: SourceMapDebugQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/source-map-debug/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          eventId,
        },
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
