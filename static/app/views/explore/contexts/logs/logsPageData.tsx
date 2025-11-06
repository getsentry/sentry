import {useMemo} from 'react';

import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import useOrganization from 'sentry/utils/useOrganization';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import type {UseInfiniteLogsQueryResult} from 'sentry/views/explore/logs/useLogsQuery';
import {
  useInfiniteLogsQuery,
  useLogsQueryHighFidelity,
} from 'sentry/views/explore/logs/useLogsQuery';

interface LogsPageData {
  infiniteLogsQueryResult: UseInfiniteLogsQueryResult;
}

const [_LogsPageDataProvider, _useLogsPageData, _ctx] =
  createDefinedContext<LogsPageData>({
    name: 'LogsPageDataContext',
  });
export const useLogsPageData = _useLogsPageData;

export function LogsPageDataProvider({
  children,
  allowHighFidelity,
  disabled,
}: {
  children: React.ReactNode;
  allowHighFidelity?: boolean;
  disabled?: boolean;
}) {
  const organization = useOrganization();
  const feature = isLogsEnabled(organization);
  const highFidelity = useLogsQueryHighFidelity();
  const infiniteLogsQueryResult = useInfiniteLogsQuery({
    disabled: disabled || !feature,
    highFidelity: allowHighFidelity && highFidelity,
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
