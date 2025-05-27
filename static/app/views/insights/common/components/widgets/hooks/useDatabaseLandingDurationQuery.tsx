import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {DEFAULT_DURATION_AGGREGATE} from 'sentry/views/insights/database/settings';
import {SpanMetricsField} from 'sentry/views/insights/types';

type Props = {
  enabled: boolean;
  search: MutableSearch;
};

export function useDatabaseLandingDurationQuery({search, enabled}: Props) {
  return useSpanMetricsSeries(
    {
      search,
      yAxis: [`${DEFAULT_DURATION_AGGREGATE}(${SpanMetricsField.SPAN_SELF_TIME})`],
      transformAliasToInputFormat: true,
      enabled,
    },
    'api.starfish.span-landing-page-metrics-chart'
  );
}
