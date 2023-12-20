import {TrendDiscoveryChildrenProps} from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {normalizeTrends} from 'sentry/views/performance/trends/utils';

import {QUERY_LIMIT_PARAM} from '../utils';

export function transformTrendsDiscover(_: any, props: TrendDiscoveryChildrenProps) {
  const {trendsData} = props;
  const events = trendsData
    ? normalizeTrends((trendsData && trendsData.events && trendsData.events.data) || [])
    : [];
  return {
    ...props,
    data: trendsData,
    hasData: !!trendsData?.events?.data.length,
    loading: props.isLoading,
    isLoading: props.isLoading,
    isErrored: !!props.error,
    errored: props.error,
    statsData: trendsData ? trendsData.stats : {},
    transactionsList: events && events.slice ? events.slice(0, QUERY_LIMIT_PARAM) : [],
    events,
  };
}
