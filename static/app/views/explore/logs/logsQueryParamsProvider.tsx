import type {ReactNode} from 'react';

import {LogsLocationQueryParamsProvider} from 'sentry/views/explore/logs/logsLocationQueryParamsProvider';
import type {QueryExtrasContextValue} from 'sentry/views/explore/logs/logsQueryExtrasProvider';
import {QueryExtrasContextProvider} from 'sentry/views/explore/logs/logsQueryExtrasProvider';
import {LogsStateQueryParamsProvider} from 'sentry/views/explore/logs/logsStateQueryParamsProvider';

interface LogsQueryParamsProviderProps extends QueryExtrasContextValue {
  children: ReactNode;
  source: 'location' | 'state';
}

export function LogsQueryParamsProvider({
  children,
  source,
  projectIds,
  spanId,
  traceId,
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

  return (
    <QueryExtrasContextProvider projectIds={projectIds} spanId={spanId} traceId={traceId}>
      <LogsQueryParamsProviderComponent>{children}</LogsQueryParamsProviderComponent>
    </QueryExtrasContextProvider>
  );
}
