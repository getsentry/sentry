// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface EventAppleCrashReportResponse {
  message: string;
}

interface EventAppleCrashReportQueryParams {
  download?: string;
  minified?: string;
}

type TQueryData = ApiResponse<EventAppleCrashReportResponse>;
type TData = EventAppleCrashReportResponse;

/**
 * @public
 * Retrieve an Apple Crash Report from an event
 *         `````````````````````````````````````````````
 *
 *         This endpoint returns the an apple crash report for a specific event.
 *         This works only if the event.platform == cocoa
 */
export function eventAppleCrashReportOptions(
  organization: Organization,
  project: Project,
  eventId: string,
  query?: EventAppleCrashReportQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/apple-crash-report',
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
