import {useCallback, useEffect, useMemo} from 'react';
import type {QueryClient} from '@tanstack/react-query';
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

interface PinnedLogEntry {
  /** True only when a complete (non-partial) scan proved the id absent. */
  definitivelyAbsent: boolean;
  row: OurLogsResponseItem | null;
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

  const missingIds = useMissingPinnedLogIds(allRows, logsPinning);

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
  const {fetchedRows, absentIds, isPending, isError} = useQueries({
    queries: missingIds.map(id => ({
      queryKey: [PINNED_LOG_ROW_QUERY_KEY, id, queryContext],
      queryFn: ({client}) => loadPinnedLog(client, queryContext, id),
      enabled,
      staleTime: Infinity,
    })),
    combine: results => {
      const rows: OurLogsResponseItem[] = [];
      const absent: string[] = [];
      let pending = false;
      let error = false;
      results.forEach((result, index) => {
        if (result.isLoading) {
          pending = true;
        }
        if (result.isError) {
          error = true;
        }
        const entry = result.data;
        if (entry?.row) {
          rows.push(entry.row);
        } else if (entry?.definitivelyAbsent) {
          absent.push(missingIds[index]!);
        }
      });
      return {fetchedRows: rows, absentIds: absent, isPending: pending, isError: error};
    },
  });

  const removePinnedRows = logsPinning?.removePinnedRows;
  const absentSignature = absentIds.join(' ');
  useEffect(() => {
    if (removePinnedRows && absentSignature) {
      removePinnedRows(absentSignature.split(' '));
    }
  }, [removePinnedRows, absentSignature]);

  const refetch = useCallback(() => {
    queryClient.refetchQueries({queryKey: [PINNED_LOG_ROW_QUERY_KEY], type: 'active'});
  }, [queryClient]);

  return {fetchedRows, isPending, isError, refetch};
}

function useMissingPinnedLogIds(
  allRows: LogTableRowItem[],
  logsPinning: LogsPinning | undefined
) {
  return useMemo(() => {
    const allRowIds = new Set(allRows.map(row => row[OurLogKnownFieldKey.ID]));
    const pinnedIds = logsPinning?.getPinnedRowIds() ?? [];
    return pinnedIds.filter(id => !allRowIds.has(id));
  }, [logsPinning, allRows]);
}

const pinnedLogBatches = new Map<
  string,
  {ids: string[]; result: Promise<Map<string, PinnedLogEntry>>}
>();

function loadPinnedLog(
  client: QueryClient,
  context: QueryContext,
  id: string
): Promise<PinnedLogEntry> {
  const batchKey = JSON.stringify([
    context.organizationSlug,
    context.baseQuery,
    context.dateParams,
  ]);

  let batch = pinnedLogBatches.get(batchKey);
  if (!batch) {
    const ids: string[] = [];
    const result = Promise.resolve().then(() => {
      pinnedLogBatches.delete(batchKey);
      return fetchPinnedLogBatch(client, context, ids);
    });
    batch = {ids, result};
    pinnedLogBatches.set(batchKey, batch);
  }

  batch.ids.push(id);
  return batch.result.then(
    entries => entries.get(id) ?? {row: null, definitivelyAbsent: false}
  );
}

async function fetchPinnedLogBatch(
  client: QueryClient,
  {organizationSlug, baseQuery, dateParams}: QueryContext,
  ids: string[]
): Promise<Map<string, PinnedLogEntry>> {
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
  const stillMissing = ids.filter(id => !foundInRange.has(id));
  let partialScan = false;
  if (stillMissing.length > 0) {
    const wide = await fetchByIds(stillMissing, wideDateParams(stillMissing));
    collect(wide.json);
    // A partial scan didn't prove the unfound ids absent, so don't unpin them.
    partialScan = wide.json.meta?.dataScanned === 'partial';
  }

  const entries = new Map<string, PinnedLogEntry>();
  for (const id of ids) {
    const row = rowsById.get(id) ?? null;
    entries.set(id, {row, definitivelyAbsent: !row && !partialScan});
  }
  return entries;
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
