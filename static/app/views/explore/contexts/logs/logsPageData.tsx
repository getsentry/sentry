import {useMemo} from 'react';

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
  const value = useMemo(() => {
    return {
      logsQueryResult,
      infiniteLogsQueryResult,
    };
  }, [logsQueryResult, infiniteLogsQueryResult]);
  return <_LogsPageDataProvider value={value}>{children}</_LogsPageDataProvider>;
}

export function useLogsPageDataQueryResult() {
  const hasInfiniteFeature = useOrganization().features.includes('ourlogs-live-refresh');
  const pageData = useLogsPageData();
  return hasInfiniteFeature ? pageData.infiniteLogsQueryResult : pageData.logsQueryResult;
}
