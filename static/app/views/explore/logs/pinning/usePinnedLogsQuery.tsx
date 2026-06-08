import {useEffect, useMemo} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

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

  const shouldFetch = missingIds.length > 0 && pageFiltersReady && !!logsPinning;

  const queryResult = useQuery(
    apiOptions.as<EventsLogsResult>()('/organizations/$organizationIdOrSlug/events/', {
      path: shouldFetch ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        dataset: DiscoverDatasets.OURLOGS,
        field: fields,
        query: missingIds.length > 0 ? `id:[${missingIds.join(',')}]` : '',
        project: selection.projects,
        statsPeriod: '9999d',
        environment: selection.environments,
        per_page: missingIds.length,
        sampling: SAMPLING_MODE.HIGH_ACCURACY,
        referrer: 'api.explore.logs-pinned',
      },
      staleTime: 0,
    })
  );

  const {removePinnedRows} = logsPinning ?? {};

  useEffect(() => {
    if (
      !queryResult.data ||
      queryResult.data.meta?.dataScanned === 'partial' ||
      !queryResult.isSuccess ||
      !removePinnedRows
    ) {
      return;
    }

    const foundIds = new Set(
      queryResult.data.data.map(row => row[OurLogKnownFieldKey.ID])
    );

    const idsToRemove = missingIds.filter(id => !foundIds.has(id));
    if (idsToRemove.length > 0) {
      removePinnedRows(idsToRemove);
    }
  }, [queryResult.isSuccess, queryResult.data, missingIds, removePinnedRows]);

  return {
    fetchedRows: queryResult.data?.data ?? [],
    isPending: queryResult.isPending && missingIds.length > 0,
  };
}
