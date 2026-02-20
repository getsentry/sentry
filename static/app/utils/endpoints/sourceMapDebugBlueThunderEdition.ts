// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface SourceMapDebugBlueThunderEditionResponse {
  dist: unknown;
  exceptions: unknown;
  has_debug_ids: boolean;
  has_scraping_data: boolean;
  has_uploaded_some_artifact_with_a_debug_id: boolean;
  min_debug_id_sdk_version: string;
  project_has_some_artifact_bundle: unknown;
  release: unknown;
  release_has_some_artifact: unknown;
  sdk_debug_id_support: unknown;
  sdk_version: string;
}

type TQueryData = ApiResponse<SourceMapDebugBlueThunderEditionResponse>;
type TData = SourceMapDebugBlueThunderEditionResponse;

/**
 * @public
 * Return a list of source map errors for a given event.
 */
export function sourceMapDebugBlueThunderEditionOptions(
  organization: Organization,
  project: Project,
  eventId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/source-map-debug-blue-thunder-edition/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          eventId,
        },
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
