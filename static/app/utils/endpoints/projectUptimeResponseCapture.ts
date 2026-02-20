// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectUptimeResponseCaptureResponse {
  body: unknown;
  bodySize: number;
  headers: unknown;
  id: string | number;
}

type TQueryData = ApiResponse<ProjectUptimeResponseCaptureResponse>;
type TData = ProjectUptimeResponseCaptureResponse;

/**
 * @public
 * Retrieve the HTTP response captured during an uptime check failure.
 */
export function projectUptimeResponseCaptureOptions(
  organization: Organization,
  project: Project,
  uptimeDetectorId: string,
  captureId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/uptime/$uptimeDetectorId/response-captures/$captureId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          uptimeDetectorId,
          captureId,
        },
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
