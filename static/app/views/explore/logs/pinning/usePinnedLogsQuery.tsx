import {useEffect, useMemo} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  SAMPLING_MODE,
  type SamplingMode,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {AlwaysPresentLogFields} from 'sentry/views/explore/logs/constants';
import type {LogsPinning} from 'sentry/views/explore/logs/pinning/useLogsPinning';
import {
  OurLogKnownFieldKey,
  type EventsLogsResult,
} from 'sentry/views/explore/logs/types';
import type {LogTableRowItem} from 'sentry/views/explore/logs/utils';
import {useQueryParamsFields} from 'sentry/views/explore/queryParams/context';

interface PinnedLogsOptions {
  allRows: LogTableRowItem[];
  logsPinning: LogsPinning | undefined;
}

/**
 * Practically-infinite period so the wide step finds any log still in retention,
 * regardless of the selected range. The backend clamps it to the org's retention.
 */
const WIDE_STATS_PERIOD = '9999d';

export function usePinnedLogsQuery({allRows, logsPinning}: PinnedLogsOptions) {
  const {selection, isReady: pageFiltersReady} = usePageFilters();
  const userFields = useQueryParamsFields();

  const missingIds = useMemo(() => {
    const allRowIds = new Set(allRows.map(row => row[OurLogKnownFieldKey.ID]));
    const pinnedIds = logsPinning?.getPinnedRowIds() ?? [];
    return pinnedIds.filter(id => !allRowIds.has(id));
  }, [logsPinning, allRows]);

  const baseQuery = useMemo(
    () => ({
      dataset: DiscoverDatasets.OURLOGS,
      field: Array.from(new Set([...AlwaysPresentLogFields, ...userFields])),
      project: selection.projects,
      environment: selection.environments,
      sampling: SAMPLING_MODE.HIGH_ACCURACY,
      referrer: 'api.explore.logs-pinned',
    }),
    [userFields, selection.projects, selection.environments]
  );

  const canFetch = pageFiltersReady && !!logsPinning;

  // Step 1: Search in the parent selected range for pins that are not loaded yet.
  // Start with this smaller range so we don't have to scan the org's full retention period.
  const inRangeQuery = useQuery({
    ...usePinnedLogsEventsQueryOptions({
      ids: missingIds,
      dateParams: normalizeDateTimeParams(selection.datetime),
      baseQuery,
      canFetch,
      staleTime: 0,
    }),
    select: selectJsonWithHeaders,
  });

  // Step 2: Any IDs not found in the parent selected range escalate to a wide window.
  // Only populated if there are IDs still missing after the in-range query succeeds.
  const stillMissingIds = useMemo(() => {
    if (!inRangeQuery.isSuccess && !inRangeQuery.isError) {
      return [];
    }
    const foundIds = new Set(
      (inRangeQuery.data?.json.data ?? []).map(row => row[OurLogKnownFieldKey.ID])
    );
    return missingIds.filter(id => !foundIds.has(id));
  }, [inRangeQuery.isSuccess, inRangeQuery.isError, inRangeQuery.data?.json, missingIds]);

  const wideQuery = useQuery({
    ...usePinnedLogsEventsQueryOptions({
      ids: stillMissingIds,
      dateParams: {statsPeriod: WIDE_STATS_PERIOD},
      baseQuery,
      canFetch,
      staleTime: Infinity,
    }),
    select: selectJsonWithHeaders,
  });

  const {removePinnedRows} = logsPinning ?? {};

  useEffect(() => {
    if (
      !removePinnedRows ||
      !wideQuery.isSuccess ||
      wideQuery.data.json.meta?.dataScanned === 'partial'
    ) {
      return;
    }

    const foundIds = new Set(
      wideQuery.data.json.data.map(row => row[OurLogKnownFieldKey.ID])
    );

    const idsToRemove = stillMissingIds.filter(id => !foundIds.has(id));
    if (idsToRemove.length > 0) {
      removePinnedRows(idsToRemove);
    }
  }, [wideQuery.isSuccess, wideQuery.data, stillMissingIds, removePinnedRows]);

  const fetchedRows = useMemo(
    () => [...(inRangeQuery.data?.json.data ?? []), ...(wideQuery.data?.json.data ?? [])],
    [inRangeQuery.data, wideQuery.data]
  );

  return {
    fetchedRows,
    isPending:
      missingIds.length > 0 &&
      (inRangeQuery.isPending || (stillMissingIds.length > 0 && wideQuery.isPending)),
  };
}

type PinnedLogsBaseQuery = {
  dataset: DiscoverDatasets;
  environment: string[];
  field: string[];
  project: number[];
  referrer: string;
  sampling: SamplingMode;
};

function usePinnedLogsEventsQueryOptions({
  ids,
  dateParams,
  baseQuery,
  canFetch,
  staleTime,
}: {
  baseQuery: PinnedLogsBaseQuery;
  canFetch: boolean;
  dateParams: ReturnType<typeof normalizeDateTimeParams>;
  ids: string[];
  staleTime: number;
}) {
  const organization = useOrganization();

  return useMemo(
    () =>
      apiOptions.as<EventsLogsResult>()('/organizations/$organizationIdOrSlug/events/', {
        path:
          canFetch && ids.length > 0
            ? {organizationIdOrSlug: organization.slug}
            : skipToken,
        query: {
          ...baseQuery,
          ...dateParams,
          query: `id:[${ids.join(',')}]`,
          per_page: ids.length,
        },
        staleTime,
      }),
    [baseQuery, canFetch, dateParams, ids, organization.slug, staleTime]
  );
}
