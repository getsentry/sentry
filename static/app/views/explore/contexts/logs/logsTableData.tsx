import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {
  useLogsCursor,
  useLogsSearch,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  useExploreLogsTable,
  type UseExploreLogsTableResult,
} from 'sentry/views/explore/logs/useLogsQuery';

interface LogsTableData {
  tableData: UseExploreLogsTableResult;
}

const [_LogsTableDataProvider, _useLogsTableData, LogsTableDataContext] =
  createDefinedContext<LogsTableData>({
    name: 'LogsTableDataContext',
  });

export function LogsTableDataProvider({
  children,
  perPage = 100,
}: {
  children: React.ReactNode;
  perPage?: number;
}) {
  const search = useLogsSearch();
  const cursor = useLogsCursor();
  const tableData = useExploreLogsTable({
    limit: perPage,
    search,
    cursor,
  });

  return (
    <LogsTableDataContext.Provider value={{tableData}}>
      {children}
    </LogsTableDataContext.Provider>
  );
}

export function useLogsTableData() {
  return _useLogsTableData();
}
