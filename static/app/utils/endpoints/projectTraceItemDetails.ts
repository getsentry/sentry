// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectTraceItemDetailsResponse {
  // No response keys detected — fill in manually
}

interface ProjectTraceItemDetailsQueryParams {
  item_type: string;
  trace_id: string;
  referrer?: string;
}

type TQueryData = ApiResponse<ProjectTraceItemDetailsResponse>;
type TData = ProjectTraceItemDetailsResponse;

/**
 * @public
 * Retrieve a Trace Item for a project.
 *
 *         For example, you might ask 'give me all the details about the span/log with id 01234567'
 */
export function projectTraceItemDetailsOptions(
  organization: Organization,
  project: Project,
  itemId: string,
  query?: ProjectTraceItemDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/trace-items/$itemId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          itemId,
        },
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
