// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: verify these types against the Python endpoint source
interface SentryAppInstallationExternalRequestsResponse {
  detail: unknown;
}

interface SentryAppInstallationExternalRequestsQueryParams {
  dependentData?: string;
  projectId?: string;
  query?: string | MutableSearch;
  uri?: string;
}

type TQueryData = ApiResponse<SentryAppInstallationExternalRequestsResponse>;
type TData = SentryAppInstallationExternalRequestsResponse;

/** @public */
export function sentryAppInstallationExternalRequestsOptions(
  uuid: string,
  query?: SentryAppInstallationExternalRequestsQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/sentry-app-installations/$uuid/external-requests/', {
      path: {uuid},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
