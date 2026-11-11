import {useLogsAutoRefreshEnabled} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {useQueryParamsSortBys} from 'sentry/views/explore/queryParams/context';

export function useLogsQueryHighFidelity() {
  const sortBys = useQueryParamsSortBys();
  const autoRefreshEnabled = useLogsAutoRefreshEnabled();

  // we can only turn on high accuracy flex time sampling when auto refresh
  // is off and the order by is exactly timestamp descending
  return (
    !autoRefreshEnabled &&
    sortBys.length === 1 &&
    sortBys[0]?.field === 'timestamp' &&
    sortBys[0]?.kind === 'desc'
  );
}
