// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface AcceptProjectTransferResponse {
  detail: unknown;
  organizations: unknown;
  project: unknown;
}

type TQueryData = ApiResponse<AcceptProjectTransferResponse>;
type TData = AcceptProjectTransferResponse;

/** @public */
export function acceptProjectTransferOptions() {
  return queryOptions({
    queryKey: getQueryKey('/accept-transfer/'),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
