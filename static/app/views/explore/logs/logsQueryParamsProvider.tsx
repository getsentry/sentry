import type {ReactNode} from 'react';
import {Fragment} from 'react';

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
  children = <Fragment>{children}</Fragment>;

  switch (source) {
    case 'location':
      return (
        <LogsLocationQueryParamsProvider>{children}</LogsLocationQueryParamsProvider>
      );
    case 'state':
      return <LogsStateQueryParamsProvider>{children}</LogsStateQueryParamsProvider>;
    default:
      throw new Error(`Unknown source for LogsQueryParamsProvider: ${source}`);
  }
}
