import type {Series} from 'sentry/types/echarts';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {CHART_HEIGHT} from 'sentry/views/insights/cache/settings';
import {AVG_COLOR} from 'sentry/views/insights/colors';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';

type Props = {
  isLoading: boolean;
  series: Series;
  error?: Error | null;
};

export function CacheHitMissChart({series, isLoading, error}: Props) {
  return (
    <ChartPanel title={DataTitles[`cache_miss_rate()`]}>
      <Chart
        height={CHART_HEIGHT}
        grid={{
          left: '4px',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        data={[series]}
        loading={isLoading}
        error={error}
        chartColors={[AVG_COLOR]}
        type={ChartType.LINE}
        aggregateOutputFormat="percentage"
        tooltipFormatterOptions={{
          valueFormatter: value => formatPercentage(value),
        }}
      />
    </ChartPanel>
  );
}
