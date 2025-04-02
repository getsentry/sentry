import type EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  useLogsBaseSearch,
  useLogsCursor,
  useLogsFields,
  useLogsProjectIds,
  useLogsSearch,
  useLogsSortBys,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  usePrefetchTraceItemDetailsOnHover,
  useTraceItemDetails,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {AlwaysPresentLogFields} from 'sentry/views/explore/logs/constants';
import {useOurlogs} from 'sentry/views/insights/common/queries/useDiscover';

export interface OurLogsTableResult {
  eventView: EventView;
  result: ReturnType<typeof useOurlogs>;
}

export type UseExploreLogsTableResult = ReturnType<typeof useExploreLogsTable>;

export function useExploreLogsTable(options: Parameters<typeof useOurlogs>[0]) {
  const _search = useLogsSearch();
  const baseSearch = useLogsBaseSearch();
  const cursor = useLogsCursor();
  const fields = useLogsFields();
  const sortBys = useLogsSortBys();
  const projectIds = useLogsProjectIds();
  const extendedFields = new Set([...AlwaysPresentLogFields, ...fields]);

  const search = baseSearch ? _search.copy() : _search;
  if (baseSearch) {
    search.tokens.push(...baseSearch.tokens);
  }
  const {data, meta, isError, isPending, pageLinks, error} = useOurlogs(
    {
      ...options,
      cursor,
      sorts: sortBys,
      fields: Array.from(extendedFields),
      search,
      projectIds,
    },
    'api.explore.logs-table'
  );

  return {data, meta, isError, isPending, pageLinks, error};
}

export function useExploreLogsTableRow(props: {
  logId: string | number;
  projectId: string;
  traceId: string;
  enabled?: boolean;
}) {
  const {isReady: pageFiltersReady} = usePageFilters();
  return useTraceItemDetails({
    traceItemId: String(props.logId),
    projectId: props.projectId,
    traceId: props.traceId,
    dataset: DiscoverDatasets.OURLOGS,
    referrer: 'api.explore.log-item-details',
    enabled: pageFiltersReady,
  });
}

export function usePrefetchLogTableRowOnHover({
  logId,
  projectId,
  traceId,
  hoverPrefetchDisabled,
  sharedHoverTimeoutRef,
}: {
  logId: string | number;
  projectId: string;
  sharedHoverTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  traceId: string;
  hoverPrefetchDisabled?: boolean;
}) {
  return usePrefetchTraceItemDetailsOnHover({
    traceItemId: String(logId),
    projectId,
    traceId,
    dataset: DiscoverDatasets.OURLOGS,
    hoverPrefetchDisabled,
    sharedHoverTimeoutRef,
    referrer: 'api.explore.log-item-details',
  });
}
