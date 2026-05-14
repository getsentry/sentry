import {createContext, useContext, useMemo} from 'react';

import {useOrganization} from 'sentry/utils/useOrganization';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import type {UseInfiniteLogsQueryResult} from 'sentry/views/explore/logs/useLogsQuery';
import {
  useInfiniteLogsQuery,
  useLogsQueryHighFidelity,
} from 'sentry/views/explore/logs/useLogsQuery';

interface LogsPageData {
  infiniteLogsQueryResult: UseInfiniteLogsQueryResult;
}

const LogsPageDataContext = createContext<LogsPageData | undefined>(undefined);

export function useLogsPageData(): LogsPageData {
  const context = useContext(LogsPageDataContext);
  if (context === undefined) {
    throw new Error(
      'useContext for "LogsPageDataContext" must be inside a Provider with a value'
    );
  }
  return context;
}

export function LogsPageDataProvider({
  children,
  allowHighFidelity,
  disabled,
  staleTime,
}: {
  children: React.ReactNode;
  allowHighFidelity?: boolean;
  disabled?: boolean;
  staleTime?: number;
}) {
  const organization = useOrganization();
  const feature = isLogsEnabled(organization);
  const highFidelity = useLogsQueryHighFidelity();
  const infiniteLogsQueryResult = useInfiniteLogsQuery({
    disabled: disabled || !feature,
    highFidelity: allowHighFidelity && highFidelity,
    staleTime,
  });
  const value = useMemo(() => {
    return {
      infiniteLogsQueryResult,
    };
  }, [infiniteLogsQueryResult]);
  return <LogsPageDataContext value={value}>{children}</LogsPageDataContext>;
}

export function useLogsPageDataQueryResult() {
  const pageData = useLogsPageData();
  return pageData.infiniteLogsQueryResult;
}
