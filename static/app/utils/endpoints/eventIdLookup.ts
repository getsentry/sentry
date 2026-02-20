// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface EventIdLookupResponse {
  detail: unknown;
  event: unknown;
  eventId: string | number;
  groupId: string | number;
  organizationSlug: string;
  projectSlug: string;
}

type TQueryData = ApiResponse<EventIdLookupResponse>;
type TData = EventIdLookupResponse;

/**
 * @public
 * This resolves an event ID to the project slug and internal issue ID and internal event ID.
 */
export function eventIdLookupOptions(organization: Organization, eventId: string) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/eventids/$eventId/', {
      path: {organizationIdOrSlug: organization.slug, eventId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
