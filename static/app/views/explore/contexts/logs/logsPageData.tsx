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
  const infiniteScroll = organization.features.includes('ourlogs-infinite-scroll');
  const logsQueryResult = useLogsQuery({disabled: infiniteScroll || !feature});
  const infiniteLogsQueryResult = useInfiniteLogsQuery({
    disabled: !infiniteScroll || !feature,
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
  const hasInfiniteFeature = useOrganization().features.includes(
    'ourlogs-infinite-scroll'
  );
  const pageData = useLogsPageData();
  return hasInfiniteFeature ? pageData.infiniteLogsQueryResult : pageData.logsQueryResult;
}
