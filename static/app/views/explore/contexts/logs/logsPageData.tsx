import {useMemo} from 'react';

import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import useOrganization from 'sentry/utils/useOrganization';
import type {UseInfiniteLogsQueryResult} from 'sentry/views/explore/logs/useLogsQuery';
import {useInfiniteLogsQuery} from 'sentry/views/explore/logs/useLogsQuery';
import {isLogsEnabled} from 'sentry/views/explore/logs/utils';

interface LogsPageData {
  infiniteLogsQueryResult: UseInfiniteLogsQueryResult;
}

const [_LogsPageDataProvider, _useLogsPageData, _ctx] =
  createDefinedContext<LogsPageData>({
    name: 'LogsPageDataContext',
  });
export const useLogsPageData = _useLogsPageData;

export function LogsPageDataProvider({children}: {children: React.ReactNode}) {
  const organization = useOrganization();
  const feature = isLogsEnabled(organization);
  const infiniteLogsQueryResult = useInfiniteLogsQuery({
    disabled: !feature,
  });
  const value = useMemo(() => {
    return {
      infiniteLogsQueryResult,
    };
  }, [infiniteLogsQueryResult]);
  return <_LogsPageDataProvider value={value}>{children}</_LogsPageDataProvider>;
}

export function useLogsPageDataQueryResult() {
  const pageData = useLogsPageData();
  return pageData.infiniteLogsQueryResult;
}
