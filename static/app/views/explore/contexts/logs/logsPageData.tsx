import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import useOrganization from 'sentry/utils/useOrganization';
import type {
  UseInfiniteLogsQueryResult,
  UseLogsQueryResult,
} from 'sentry/views/explore/logs/useLogsQuery';
import {useInfiniteLogsQuery, useLogsQuery} from 'sentry/views/explore/logs/useLogsQuery';

interface LogsPageData {
  infiniteLogsQueryResult: UseInfiniteLogsQueryResult;
  logsQueryResult: UseLogsQueryResult;
}

const [_LogsPageDataProvider, _useLogsPageData, _ctx] =
  createDefinedContext<LogsPageData>({
    name: 'LogsPageDataContext',
  });
export const useLogsPageData = _useLogsPageData;

export function LogsPageDataProvider({children}: {children: React.ReactNode}) {
  const organization = useOrganization();
  const feature = organization.features.includes('ourlogs-enabled');
  const liveRefresh = organization.features.includes('ourlogs-live-refresh');
  const logsQueryResult = useLogsQuery({disabled: liveRefresh || !feature});
  const infiniteLogsQueryResult = useInfiniteLogsQuery({
    disabled: !liveRefresh || !feature,
  });
  return (
    <_LogsPageDataProvider value={{logsQueryResult, infiniteLogsQueryResult}}>
      {children}
    </_LogsPageDataProvider>
  );
}
