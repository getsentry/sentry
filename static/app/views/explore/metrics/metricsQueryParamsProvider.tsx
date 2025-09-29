import type {ReactNode} from 'react';

import {MetricsLocationQueryParamsProvider} from 'sentry/views/explore/metrics/metricsLocationQueryParamsProvider';

interface MetricsQueryParamsProviderProps {
  children: ReactNode;
  source: 'state' | 'location';
  frozenParams?: any;
}

export function MetricsQueryParamsProvider({
  children,
  source,
  frozenParams,
}: MetricsQueryParamsProviderProps) {
  // For now we only support location-based params
  // TODO: Add state-based params provider when needed
  if (source === 'location') {
    return (
      <MetricsLocationQueryParamsProvider frozenParams={frozenParams}>
        {children}
      </MetricsLocationQueryParamsProvider>
    );
  }

  // Fallback for state source (not implemented yet)
  return <>{children}</>;
}
