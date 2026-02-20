// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface RelocationPublicKeyResponse {
  detail: unknown;
  public_key: string;
}

type TQueryData = ApiResponse<RelocationPublicKeyResponse>;
type TData = RelocationPublicKeyResponse;

/**
 * @public
 * Get your public key for relocation encryption.
 *         ``````````````````````````````````````````````
 *
 *         Returns a public key which can be used to create an encrypted export tarball.
 *
 *         :auth: required
 */
export function relocationPublicKeyOptions() {
  return queryOptions({
    queryKey: getQueryKey('/publickeys/relocations/'),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
