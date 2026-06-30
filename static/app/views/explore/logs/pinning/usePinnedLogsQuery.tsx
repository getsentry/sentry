import {useCallback, useMemo} from 'react';
import {AsyncBatcher} from '@tanstack/react-pacer';
import type {QueryClient, UseQueryResult} from '@tanstack/react-query';
import {useQueries, useQueryClient} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiFetch} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getUtcDateString} from 'sentry/utils/dates';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {AlwaysPresentLogFields} from 'sentry/views/explore/logs/constants';
import {logItemIdToTimestamp} from 'sentry/views/explore/logs/pinning/logItemId';
import type {LogsPinning} from 'sentry/views/explore/logs/pinning/useLogsPinning';
import {
  OurLogKnownFieldKey,
  type EventsLogsResult,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import type {LogTableRowItem} from 'sentry/views/explore/logs/utils';
import {useQueryParamsFields} from 'sentry/views/explore/queryParams/context';

interface PinnedLogsOptions {
  allRows: LogTableRowItem[];
  logsPinning: LogsPinning | undefined;
}

const PINNED_LOG_ROW_QUERY_KEY = 'pinned-log-row';

/**
 * Practically-infinite period so the wide step finds any log still in retention,
 * regardless of the selected range. The backend clamps it to the org's retention.
 * Only used as a fallback when a pin's timestamp can't be derived from its id.
 */
const WIDE_STATS_PERIOD = '9999d';

/**
 * Padding around the timestamps decoded from pin ids, to absorb clock skew
 * between when the SDK minted the id and when the log was ingested.
 */
const WINDOW_BUFFER_MS = 5 * 60 * 1000;

interface QueryContext {
  baseQuery: Record<string, unknown>;
  dateParams: Record<string, unknown>;
  organizationSlug: string;
}

export function usePinnedLogsQuery({allRows, logsPinning}: PinnedLogsOptions) {
  const organization = useOrganization();
  const {selection, isReady: pageFiltersReady} = usePageFilters();
  const userFields = useQueryParamsFields();
  const queryClient = useQueryClient();

  const fields = useMemo(
    () => Array.from(new Set([...AlwaysPresentLogFields, ...userFields])),
    [userFields]
  );

  const allRowIds = new Set(allRows.map(row => row[OurLogKnownFieldKey.ID]));
  const missingIds = (logsPinning?.getPinnedRowIds() ?? []).filter(
    id => !allRowIds.has(id)
  );

  const baseQuery = useMemo(
    () => ({
      dataset: DiscoverDatasets.OURLOGS,
      field: fields,
      project: selection.projects,
      environment: selection.environments,
      sampling: SAMPLING_MODE.HIGH_ACCURACY,
      referrer: 'api.explore.logs-pinned',
    }),
    [fields, selection.projects, selection.environments]
  );

  const queryContext = useMemo<QueryContext>(
    () => ({
      organizationSlug: organization.slug,
      baseQuery,
      dateParams: normalizeDateTimeParams(selection.datetime),
    }),
    [organization.slug, baseQuery, selection.datetime]
  );

  const enabled = pageFiltersReady && !!logsPinning;
  const {fetchedRows, isPending, isError} = useQueries({
    queries: missingIds.map(id => ({
      queryKey: [PINNED_LOG_ROW_QUERY_KEY, id, queryContext],
      queryFn: ({client}) => loadPinnedLog(client, queryContext, id),
      enabled,
      staleTime: Infinity,
    })),
    combine: combineResults,
  });

  const refetch = useCallback(() => {
    queryClient.refetchQueries({queryKey: [PINNED_LOG_ROW_QUERY_KEY], type: 'active'});
  }, [queryClient]);

  return {fetchedRows, isPending, isError, refetch};
}

function combineResults(results: Array<UseQueryResult<OurLogsResponseItem | null>>) {
  const fetchedRows: OurLogsResponseItem[] = [];
  let isPending = false;
  let isError = false;
  for (const result of results) {
    if (result.isLoading) {
      isPending = true;
    } else if (result.isError) {
      isError = true;
    } else if (result.data) {
      fetchedRows.push(result.data);
    }
  }
  return {fetchedRows, isPending, isError};
}

interface PinnedLogRequest {
  client: QueryClient;
  context: QueryContext;
  deferred: PromiseWithResolvers<OurLogsResponseItem | null>;
  id: string;
}

/**
 * Coalesces every pinned-log query that fires in the same tick into a single
 * `/events/` request, so N pins cost one fetch instead of N. Each pin still has
 * its own per-id query key, so unpinning one never refetches the rest. All
 * requests in a tick share the same context (org, filters, time range), so we
 * fetch with the first one's.
 */
const pinnedLogBatcher = new AsyncBatcher<PinnedLogRequest>(
  requests => {
    const {client, context} = requests[0]!;
    const ids = [...new Set(requests.map(request => request.id))];
    return fetchPinnedLogBatch(client, context, ids);
  },
  {
    wait: 0,
    onSuccess: (rowsById: Map<string, OurLogsResponseItem>, requests) => {
      for (const {deferred, id} of requests) {
        deferred.resolve(rowsById.get(id) ?? null);
      }
    },
    onError: (error, requests) => {
      for (const {deferred} of requests) {
        deferred.reject(error);
      }
    },
  }
);

function loadPinnedLog(
  client: QueryClient,
  context: QueryContext,
  id: string
): Promise<OurLogsResponseItem | null> {
  const deferred = Promise.withResolvers<OurLogsResponseItem | null>();
  pinnedLogBatcher.addItem({client, context, deferred, id});
  return deferred.promise;
}

async function fetchPinnedLogBatch(
  client: QueryClient,
  {organizationSlug, baseQuery, dateParams}: QueryContext,
  ids: string[]
): Promise<Map<string, OurLogsResponseItem>> {
  const url = getApiUrl('/organizations/$organizationIdOrSlug/events/', {
    path: {organizationIdOrSlug: organizationSlug},
  });

  const fetchByIds = (idsForFetch: string[], dp: Record<string, unknown>) =>
    apiFetch<EventsLogsResult>({
      client,
      queryKey: [
        url,
        {
          query: {
            ...baseQuery,
            ...dp,
            query: `id:[${idsForFetch.join(',')}]`,
            per_page: idsForFetch.length,
          },
        },
        {infinite: false},
      ],
      signal: new AbortController().signal,
      meta: undefined,
    });

  const rowsById = new Map<string, OurLogsResponseItem>();
  const collect = (result: EventsLogsResult) => {
    for (const row of result.data) {
      rowsById.set(row[OurLogKnownFieldKey.ID], row);
    }
  };

  // Step 1: Search in the parent selected range for pins that are not loaded yet.
  // Start with this smaller range so we don't have to scan the org's full retention period.
  let foundInRange = new Set<string>();
  try {
    const inRange = (await fetchByIds(ids, dateParams)).json;
    collect(inRange);
    foundInRange = new Set(inRange.data.map(row => row[OurLogKnownFieldKey.ID]));
  } catch {
    // The selected range failed; let the wide window resolve everything instead.
  }

  // Step 2: Any IDs not found in the parent selected range escalate to a wider window.
  // Anything still unfound stays pinned and surfaces as an unavailable row in the UI.
  const stillMissing = ids.filter(id => !foundInRange.has(id));
  if (stillMissing.length > 0) {
    const wide = await fetchByIds(stillMissing, wideDateParams(stillMissing));
    collect(wide.json);
  }

  return rowsById;
}

/**
 * Pin ids are UUIDv7, so we can derive a tight window from their timestamps and
 * avoid scanning the org's full retention (which gets downsampled to a partial
 * scan for high-volume orgs, missing the pinned log). Falls back to the wide
 * period if any id isn't a decodable timestamp.
 */
function wideDateParams(ids: string[]): Record<string, unknown> {
  const timestamps = ids.map(logItemIdToTimestamp);
  if (timestamps.length === 0 || timestamps.includes(null)) {
    return {statsPeriod: WIDE_STATS_PERIOD};
  }
  const decoded = timestamps as number[];
  return {
    start: getUtcDateString(moment(Math.min(...decoded) - WINDOW_BUFFER_MS)),
    end: getUtcDateString(moment(Math.max(...decoded) + WINDOW_BUFFER_MS)),
  };
}
