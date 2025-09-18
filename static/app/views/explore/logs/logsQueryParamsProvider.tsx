import type {ReactNode} from 'react';

import {
  LogsFrozenContextProvider,
  type LogsFrozenContextProviderProps,
} from 'sentry/views/explore/logs/logsFrozenContext';
import {LogsLocationQueryParamsProvider} from 'sentry/views/explore/logs/logsLocationQueryParamsProvider';
import {LogsStateQueryParamsProvider} from 'sentry/views/explore/logs/logsStateQueryParamsProvider';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';

interface LogsQueryParamsProviderProps {
  children: ReactNode;
  source: 'location' | 'state';
  freeze?: LogsFrozenContextProviderProps;
  frozenParams?: Partial<ReadableQueryParams>;
}

export function LogsQueryParamsProvider({
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

  return (
    <LogsFrozenContextProvider {...freeze}>
      <LogsQueryParamsProviderComponent frozenParams={frozenParams}>
        {children}
      </LogsQueryParamsProviderComponent>
    </LogsFrozenContextProvider>
  );
}
