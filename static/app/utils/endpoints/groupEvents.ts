// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: verify these types against the Python endpoint source
interface GroupEventsResponse {
  detail: unknown;
}

interface GroupEventsQueryParams {
  /** The end of the period of time for the query, expected in ISO-8601 format. For example, `2001-12-14T12:34:56.7890`. */
  end?: string;
  /** The name of environments to filter by. */
  environment?: string[];
  /** Specify true to include the full event body, including the stacktrace, in the event payload. */
  full?: boolean;
  /** An optional search query for filtering events. */
  query?: string | MutableSearch;
  /** Return events in pseudo-random order. This is deterministic so an identical query will always return the same events in  */
  sample?: boolean;
  /** The start of the period of time for the query, expected in ISO-8601 format. For example, `2001-12-14T12:34:56.7890`. */
  start?: string;
  /** The period of time for the query, will override the start & end parameters, a number followed by one of: - `d` for days  */
  statsPeriod?: string;
}

type TQueryData = ApiResponse<GroupEventsResponse>;
type TData = GroupEventsResponse;

/**
 * @public
 * Return a list of error events bound to an issue
 */
export function groupEventsOptions(issueId: string, query?: GroupEventsQueryParams) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/issues/$issueId/events/', {
      path: {issueId},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
