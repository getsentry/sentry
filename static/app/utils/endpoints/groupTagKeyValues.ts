// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface GroupTagKeyValuesResponse {
  // No response keys detected — fill in manually
}

interface GroupTagKeyValuesQueryParams {
  /** The name of environments to filter by. */
  environment?: string[];
  /** Sort order of the resulting tag values. Prefix with '-' for descending order. Default is '-id'. */
  sort?: Sort;
}

type TQueryData = ApiResponse<GroupTagKeyValuesResponse>;
type TData = GroupTagKeyValuesResponse;

/**
 * @public
 * List a Tag's Values
 */
export function groupTagKeyValuesOptions(
  issueId: string,
  key: string,
  query?: GroupTagKeyValuesQueryParams
) {
  const {sort, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(sort === undefined ? {} : {sort: encodeSort(sort)}),
  };

  return queryOptions({
    queryKey: getQueryKey('/issues/$issueId/tags/$key/values/', {
      path: {issueId, key},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
