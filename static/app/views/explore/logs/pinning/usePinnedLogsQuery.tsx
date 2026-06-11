import {useEffect, useMemo} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
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
  const organization = useOrganization();
  const {selection, isReady: pageFiltersReady} = usePageFilters();
  const userFields = useQueryParamsFields();

  const allRowIds = useMemo(
    () => new Set(allRows.map(row => row[OurLogKnownFieldKey.ID])),
    [allRows]
  );

  const missingIds = useMemo(() => {
    const pinnedIds = logsPinning?.getPinnedRowIds() ?? [];
    return pinnedIds.filter(id => !allRowIds.has(id));
  }, [logsPinning, allRowIds]);

  const fields = useMemo(
    () => Array.from(new Set([...AlwaysPresentLogFields, ...userFields])),
    [userFields]
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

  const canFetch = pageFiltersReady && !!logsPinning;

  // Step 1: Search in the parent selected range for pins that are not loaded yet.
  // Start with this smaller range so we don't have to scan the org's full retention period.
  const inRangeQuery = useQuery(
    apiOptions.as<EventsLogsResult>()('/organizations/$organizationIdOrSlug/events/', {
      path:
        canFetch && missingIds.length > 0
          ? {organizationIdOrSlug: organization.slug}
          : skipToken,
      query: {
        ...baseQuery,
        ...normalizeDateTimeParams(selection.datetime),
        query: `id:[${missingIds.join(',')}]`,
        per_page: missingIds.length,
      },
      staleTime: 0,
    })
  );

  // Step 2: Any IDs not found in the parent selected range escalate to a wide window.
  // Only populated if there are IDs still missing after the in-range query succeeds.
  const stillMissingIds = useMemo(() => {
    if (!inRangeQuery.isSuccess && !inRangeQuery.isError) {
      return [];
    }
    const foundIds = new Set(
      (inRangeQuery.data?.data ?? []).map(row => row[OurLogKnownFieldKey.ID])
    );
    return missingIds.filter(id => !foundIds.has(id));
  }, [inRangeQuery.isSuccess, inRangeQuery.isError, inRangeQuery.data?.data, missingIds]);

  const wideQuery = useQuery(
    apiOptions.as<EventsLogsResult>()('/organizations/$organizationIdOrSlug/events/', {
      path:
        canFetch && stillMissingIds.length > 0
          ? {organizationIdOrSlug: organization.slug}
          : skipToken,
      query: {
        ...baseQuery,
        statsPeriod: WIDE_STATS_PERIOD,
        query: `id:[${stillMissingIds.join(',')}]`,
        per_page: stillMissingIds.length,
      },
      staleTime: 0,
    })
  );

  const {removePinnedRows} = logsPinning ?? {};

  useEffect(() => {
    if (
      !removePinnedRows ||
      !wideQuery.isSuccess ||
      wideQuery.data.meta?.dataScanned === 'partial'
    ) {
      return;
    }

    const foundIds = new Set(wideQuery.data.data.map(row => row[OurLogKnownFieldKey.ID]));

    const idsToRemove = stillMissingIds.filter(id => !foundIds.has(id));
    if (idsToRemove.length > 0) {
      removePinnedRows(idsToRemove);
    }
  }, [wideQuery.isSuccess, wideQuery.data, stillMissingIds, removePinnedRows]);

  const fetchedRows = useMemo(
    () => [...(inRangeQuery.data?.data ?? []), ...(wideQuery.data?.data ?? [])],
    [inRangeQuery.data, wideQuery.data]
  );

  return {
    fetchedRows,
    isPending:
      missingIds.length > 0 &&
      (inRangeQuery.isPending || (stillMissingIds.length > 0 && wideQuery.isPending)),
  };
}
