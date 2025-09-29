import {useMemo} from 'react';

import {createDefinedContext} from 'sentry/utils/context';
import useOrganization from 'sentry/utils/useOrganization';
import {isMetricsEnabled} from 'sentry/views/explore/metrics/isMetricsEnabled';
import {useInfiniteTraceMetricsQuery} from 'sentry/views/explore/metrics/useTraceMetricsQuery';

interface MetricsPageData {
  infiniteMetricsQueryResult: ReturnType<typeof useInfiniteTraceMetricsQuery>;
}

const [_MetricsPageDataProvider, _useMetricsPageData, _ctx] =
  createDefinedContext<MetricsPageData>({
    name: 'MetricsPageDataContext',
  });
export const useMetricsPageData = _useMetricsPageData;

export function MetricsPageDataProvider({
  children,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const organization = useOrganization();
  const feature = isMetricsEnabled(organization);
  const infiniteMetricsQueryResult = useInfiniteTraceMetricsQuery({
    disabled: !feature,
  });
  const value = useMemo(() => {
    return {
      infiniteMetricsQueryResult,
    };
  }, [infiniteMetricsQueryResult]);
  return <_MetricsPageDataProvider value={value}>{children}</_MetricsPageDataProvider>;
}

export function useMetricsPageDataQueryResult() {
  const pageData = useMetricsPageData();
  return pageData.infiniteMetricsQueryResult;
}
