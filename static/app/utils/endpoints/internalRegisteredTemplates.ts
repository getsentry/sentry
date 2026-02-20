// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface InternalRegisteredTemplatesResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<InternalRegisteredTemplatesResponse>;
type TData = InternalRegisteredTemplatesResponse;

/** @public */
export function internalRegisteredTemplatesOptions() {
  return queryOptions({
    queryKey: getQueryKey('/internal/notifications/registered-templates/'),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
