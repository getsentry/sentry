// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface EventAttachmentsResponse {
  // No response keys detected — fill in manually
}

interface EventAttachmentsQueryParams {
  query?: string | MutableSearch;
}

type TQueryData = ApiResponse<EventAttachmentsResponse>;
type TData = EventAttachmentsResponse;

/**
 * @public
 * Retrieve attachments for an event
 *         `````````````````````````````````
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           issues belong to.
 *         :pparam string project_id_or_slug: the id or slug of the project the event
 *                                      belongs to.
 *         :pparam string event_id: the id of the event.
 *         :auth: required
 */
export function eventAttachmentsOptions(
  organization: Organization,
  project: Project,
  eventId: string,
  query?: EventAttachmentsQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/attachments/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          eventId,
        },
        query: serializedQuery,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
