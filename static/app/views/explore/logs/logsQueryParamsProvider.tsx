import type {ReactNode} from 'react';

import {LogsLocationQueryParamsProvider} from 'sentry/views/explore/logs/logsLocationQueryParamsProvider';
import {LogsStateQueryParamsProvider} from 'sentry/views/explore/logs/logsStateQueryParamsProvider';

interface LogsQueryParamsProviderProps {
  children: ReactNode;
  source: 'location' | 'state';
}

export function LogsQueryParamsProvider({
  children,
  source,
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

  return <LogsQueryParamsProviderComponent>{children}</LogsQueryParamsProviderComponent>;
}
