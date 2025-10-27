import type {ReactNode} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {getReadableQueryParamsFromLocation} from 'sentry/views/explore/spans/spansQueryParams';

export function MockMetricQueryParamsContext({children}: {children: ReactNode}) {
  const location = useLocation();
  const organization = useOrganization();
  const queryParams = getReadableQueryParamsFromLocation(location, organization);
  return (
    <MetricsQueryParamsProvider
      queryParams={queryParams}
      setQueryParams={() => {}}
      setTraceMetric={() => {}}
      removeMetric={() => {}}
    >
      {children}
    </MetricsQueryParamsProvider>
  );
}
