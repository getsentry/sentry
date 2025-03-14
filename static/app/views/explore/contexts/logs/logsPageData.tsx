import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import useOrganization from 'sentry/utils/useOrganization';
import type {UseExploreLogsTableResult} from 'sentry/views/explore/logs/useLogsQuery';
import {useExploreLogsTable} from 'sentry/views/explore/logs/useLogsQuery';

interface LogsPageData {
  logsData: UseExploreLogsTableResult;
}

const [_LogsPageDataProvider, _useLogsPageData, _ctx] =
  createDefinedContext<LogsPageData>({
    name: 'LogsPageDataContext',
  });
export const useLogsPageData = _useLogsPageData;

export function LogsPageDataProvider({children}: {children: React.ReactNode}) {
  const organization = useOrganization();
  const feature = organization.features.includes('ourlogs-enabled');
  const data = useExploreLogsTable({enabled: feature && undefined}); // left as exercise to reader
  return (
    <_LogsPageDataProvider value={{logsData: data}}>{children}</_LogsPageDataProvider>
  );
}
