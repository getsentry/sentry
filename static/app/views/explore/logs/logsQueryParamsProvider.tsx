import type {ReactNode} from 'react';

import {
  LogsFrozenContextProvider,
  type LogsFrozenContextProviderProps,
} from 'sentry/views/explore/logs/logsFrozenContext';
import {LogsLocationQueryParamsProvider} from 'sentry/views/explore/logs/logsLocationQueryParamsProvider';
import {LogsStateQueryParamsProvider} from 'sentry/views/explore/logs/logsStateQueryParamsProvider';

interface LogsQueryParamsProviderProps {
  children: ReactNode;
  source: 'location' | 'state';
  freeze?: LogsFrozenContextProviderProps;
}

export function LogsQueryParamsProvider({
  children,
  source,
  freeze,
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
    <LogsFrozenContextProvider {...freeze}>
      <LogsQueryParamsProviderComponent>{children}</LogsQueryParamsProviderComponent>
    </LogsFrozenContextProvider>
  );
}
