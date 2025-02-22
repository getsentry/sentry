import type EventView from 'sentry/utils/discover/eventView';
import {
  useLogsFields,
  useLogsSearch,
  useLogsSortBys,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useOurlogs} from 'sentry/views/insights/common/queries/useDiscover';

export interface SpansTableResult {
  eventView: EventView;
  result: ReturnType<typeof useOurlogs>;
}

export function useExploreLogsTable(options: Parameters<typeof useOurlogs>[0]) {
  const search = useLogsSearch();
  const fields = useLogsFields();
  const sortBys = useLogsSortBys();

  const {data, isError, isPending} = useOurlogs(
    {
      ...options,
      sorts: sortBys,
      fields,
      search,
    },
    'api.logs-tab.view'
  );

  return {data, isError, isPending};
}
