import type {ReactNode} from 'react';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {LogsAutoRefreshProvider} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {
  LogsFrozenContextProvider,
  type LogsFrozenContextProviderProps,
} from 'sentry/views/explore/logs/logsFrozenContext';
import {LogsLocationQueryParamsProvider} from 'sentry/views/explore/logs/logsLocationQueryParamsProvider';
import {LogsStateQueryParamsProvider} from 'sentry/views/explore/logs/logsStateQueryParamsProvider';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';

const [
  _LogsAnalyticsPageSourceProvider,
  _useLogsAnalyticsPageSource,
  LogsAnalyticsPageSourceContext,
] = createDefinedContext<LogsAnalyticsPageSource>({
  name: 'LogsAnalyticsPageSourceContext',
});

export const useLogsAnalyticsPageSource = _useLogsAnalyticsPageSource;

interface LogsQueryParamsProviderProps {
  analyticsPageSource: LogsAnalyticsPageSource;
  children: ReactNode;
  source: 'location' | 'state';
  freeze?: LogsFrozenContextProviderProps;
  frozenParams?: Partial<ReadableQueryParams>;
}

export function LogsQueryParamsProvider({
  analyticsPageSource,
  children,
  source,
  freeze,
  frozenParams,
}: LogsQueryParamsProviderProps) {
  const LogsQueryParamsProviderComponent =
    source === 'location'
      ? LogsLocationQueryParamsProvider
      : source === 'state'
        ? LogsStateQueryParamsProvider
        : null;

  if (!LogsQueryParamsProviderComponent) {
    throw new Error(`Unknown source for LogsQueryParamsProvider: ${source}`);
  }

  const isTableFrozen = source === 'state';

  return (
    <LogsAnalyticsPageSourceContext value={analyticsPageSource}>
      <LogsFrozenContextProvider {...freeze}>
        <LogsQueryParamsProviderComponent frozenParams={frozenParams}>
          <LogsAutoRefreshProvider isTableFrozen={isTableFrozen}>
            {children}
          </LogsAutoRefreshProvider>
        </LogsQueryParamsProviderComponent>
      </LogsFrozenContextProvider>
    </LogsAnalyticsPageSourceContext>
  );
}
