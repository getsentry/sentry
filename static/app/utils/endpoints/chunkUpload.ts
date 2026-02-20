// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ChunkUploadResponse {
  accept: unknown;
  chunkSize: number;
  chunksPerRequest: unknown;
  compression: unknown;
  concurrency: unknown;
  hashAlgorithm: boolean;
  maxFileSize: number;
  maxRequestSize: number;
  url: string;
}

type TQueryData = ApiResponse<ChunkUploadResponse>;
type TData = ChunkUploadResponse;

/**
 * @public
 * Return chunk upload parameters
 *         ``````````````````````````````
 *         :auth: required
 */
export function chunkUploadOptions(organization: Organization) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/chunk-upload/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
