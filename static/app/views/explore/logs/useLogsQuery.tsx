import * as Sentry from '@sentry/react';

import type EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
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

const {warn, fmt} = Sentry._experiment_log;

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
  const {data, meta, isError, isPending, pageLinks} = useOurlogs(
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

  if (!meta) {
    warn(fmt`meta is 'undefined' for useExploreLogsTable`);
  }

  return {data, meta, isError, isPending, pageLinks};
}

export function useExploreLogsTableRow(props: {
  log_id: string | number;
  project_id: string;
  enabled?: boolean;
}) {
  return useTraceItemDetails({
    traceItemId: String(props.log_id),
    projectId: props.project_id,
    dataset: DiscoverDatasets.OURLOGS,
    referrer: 'api.explore.log-item-details',
  });
}

export function usePrefetchLogTableRowOnHover({
  logId,
  projectId,
  hoverPrefetchDisabled,
  sharedHoverTimeoutRef,
}: {
  logId: string | number;
  projectId: string;
  sharedHoverTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  hoverPrefetchDisabled?: boolean;
}) {
  return usePrefetchTraceItemDetailsOnHover({
    traceItemId: String(logId),
    projectId,
    dataset: DiscoverDatasets.OURLOGS,
    hoverPrefetchDisabled,
    sharedHoverTimeoutRef,
    referrer: 'api.explore.log-item-details',
  });
}
