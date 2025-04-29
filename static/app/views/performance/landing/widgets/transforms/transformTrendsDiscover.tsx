import type {TrendDiscoveryChildrenProps} from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {QUERY_LIMIT_PARAM} from 'sentry/views/performance/landing/widgets/utils';
import {normalizeTrends} from 'sentry/views/performance/trends/utils';

export function transformTrendsDiscover(_: any, props: TrendDiscoveryChildrenProps) {
  const {trendsData} = props;
  const events = trendsData ? normalizeTrends(trendsData?.events?.data || []) : [];
  return {
    ...props,
    data: trendsData,
    hasData: !!trendsData?.events?.data.length,
    loading: props.isLoading,
    isLoading: props.isLoading,
    isErrored: !!props.error,
    errored: props.error,
    statsData: trendsData ? trendsData.stats : {},
    transactionsList: events?.slice ? events.slice(0, QUERY_LIMIT_PARAM) : [],
    events,
  };
}
