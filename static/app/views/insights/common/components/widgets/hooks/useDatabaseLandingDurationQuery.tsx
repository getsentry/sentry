import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {Referrer} from 'sentry/views/insights/database/referrers';
import {DEFAULT_DURATION_AGGREGATE} from 'sentry/views/insights/database/settings';
import {SpanMetricsField} from 'sentry/views/insights/types';

type Props = {
  search: MutableSearch;
  enabled?: boolean;
};

export function useDatabaseLandingDurationQuery({search, enabled}: Props) {
  return useSpanMetricsSeries(
    {
      search,
      yAxis: [`${DEFAULT_DURATION_AGGREGATE}(${SpanMetricsField.SPAN_SELF_TIME})`],
      transformAliasToInputFormat: true,
      enabled,
    },
    Referrer.LANDING_DURATION_CHART
  );
}
