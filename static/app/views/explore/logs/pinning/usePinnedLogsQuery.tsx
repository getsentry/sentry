import {useCallback, useMemo} from 'react';
import type {UseQueryResult} from '@tanstack/react-query';
import {useQueries, useQueryClient} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiFetch} from 'sentry/utils/api/apiFetch';
import {batchedQueryOptions} from 'sentry/utils/api/batching/batchedQueryOptions';
import {createBatcher} from 'sentry/utils/api/batching/createBatcher';
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

type BatchedQueryStatus = 'error' | 'pending' | 'success';

/**
 * Practically-infinite period so we find any pin still in retention, regardless of
 * the selected range. The backend clamps it to the org's retention. Only used as a
 * fallback when a pin's timestamp can't be derived from its id.
 */
const WIDE_STATS_PERIOD = '9999d';

/**
 * Padding around the timestamps decoded from pin ids, to absorb clock skew
 * between when the SDK minted the id and when the log was ingested.
 */
const WINDOW_BUFFER_MS = 5 * 60 * 1000;

interface PinnedLogsQueryContext {
  baseQuery: Record<string, unknown>;
  organizationSlug: string;
}

const pinnedLogBatcher = createBatcher<OurLogsResponseItem, PinnedLogsQueryContext>(
  async (client, {organizationSlug, baseQuery}, ids: string[]) => {
    const url = getApiUrl('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: organizationSlug},
    });

    const rowsById = new Map<string, OurLogsResponseItem | Error>();
    try {
      const {json} = await apiFetch<EventsLogsResult>({
        client,
        queryKey: [
          url,
          {
            query: {
              ...baseQuery,
              ...dateParamsFromIds(ids),
              query: `id:[${ids.join(',')}]`,
              per_page: ids.length,
            },
          },
          {infinite: false},
        ],
        signal: new AbortController().signal,
        meta: undefined,
      });
      for (const row of json.data) {
        rowsById.set(row[OurLogKnownFieldKey.ID], row);
      }
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      for (const id of ids) {
        rowsById.set(id, failure);
      }
    }

    return rowsById;
  }
);

export function usePinnedLogsQuery({allRows, logsPinning}: PinnedLogsOptions) {
  const organization = useOrganization();
  const {selection, isReady: pageFiltersReady} = usePageFilters();
  const userFields = useQueryParamsFields();

  const fields = useMemo(
    () => Array.from(new Set([...AlwaysPresentLogFields, ...userFields])),
    [userFields]
  );

  const allRowIds = new Set(allRows.map(row => row[OurLogKnownFieldKey.ID]));
  const missingIds = (logsPinning?.getPinnedRowIds() ?? []).filter(
    id => !allRowIds.has(id)
  );

  const queryContext = useMemo<PinnedLogsQueryContext>(
    () => ({
      organizationSlug: organization.slug,
      baseQuery: {
        dataset: DiscoverDatasets.OURLOGS,
        field: fields,
        project: selection.projects,
        environment: selection.environments,
        sampling: SAMPLING_MODE.HIGH_ACCURACY,
        referrer: 'api.explore.logs-pinned',
      },
    }),
    [fields, organization.slug, selection.environments, selection.projects]
  );

  const enabled = pageFiltersReady && !!logsPinning;
  const queryClient = useQueryClient();

  const {fetchedRows, isError, isPending, statusById} = useQueries({
    queries: batchedQueryOptions({
      batcher: pinnedLogBatcher,
      context: queryContext,
      ids: missingIds,
      keyPrefix: PINNED_LOG_ROW_QUERY_KEY,
    }).map(options => ({...options, enabled, staleTime: Infinity})),
    combine: results => combinePinnedRows(results, missingIds),
  });

  const refetch = useCallback(() => {
    queryClient.refetchQueries({queryKey: [PINNED_LOG_ROW_QUERY_KEY], type: 'active'});
  }, [queryClient]);

  return {fetchedRows, isError, isPending, statusById, refetch};
}

function combinePinnedRows(
  results: Array<UseQueryResult<OurLogsResponseItem | null>>,
  ids: string[]
) {
  const fetchedRows: OurLogsResponseItem[] = [];
  const statusById = new Map<string, BatchedQueryStatus>();
  let isPending = false;
  let isError = false;

  results.forEach((result, index) => {
    const id = ids[index];
    if (result.isPending) {
      isPending = true;
      if (id !== undefined) {
        statusById.set(id, 'pending');
      }
    } else if (result.isError) {
      isError = true;
      if (id !== undefined) {
        statusById.set(id, 'error');
      }
    } else {
      if (id !== undefined) {
        statusById.set(id, 'success');
      }
      if (result.data) {
        fetchedRows.push(result.data);
      }
    }
  });

  return {fetchedRows, isPending, isError, statusById};
}

/**
 * Pin ids are UUIDv7, so we derive a tight window from their timestamps to keep
 * the scan small instead of covering the org's full retention. HIGHEST_ACCURACY
 * already guarantees no rows are dropped regardless of window width, so this is
 * purely to avoid a slow, timeout-prone wide scan. Fall back to the wide period
 * if any id isn't a decodable timestamp.
 */
function dateParamsFromIds(ids: string[]): Record<string, unknown> {
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
