// TODO(release-drawer): Only used in cache/components/samplePanel
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';

type Props = {
  isLoading: boolean;
  series: DiscoverSeries;
  error?: Error | null;
};

export function CacheHitMissChart({series, isLoading, error}: Props) {
  return (
    <InsightsLineChartWidget
      title={DataTitles[`cache_miss_rate()`]}
      series={[series]}
      showLegend="never"
      isLoading={isLoading}
      error={error ?? null}
    />
  );
}
