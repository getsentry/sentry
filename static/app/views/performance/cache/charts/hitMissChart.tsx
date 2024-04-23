import type {Series} from 'sentry/types/echarts';
import {formatPercentage} from 'sentry/utils/formatters';
import {CHART_HEIGHT} from 'sentry/views/performance/cache/settings';
import {AVG_COLOR} from 'sentry/views/starfish/colors';
import Chart, {ChartType} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Props = {
  isLoading: boolean;
  series: Series;
  error?: Error | null;
};

export function CacheHitMissChart({series, isLoading, error}: Props) {
  return (
    <ChartPanel title={DataTitles.cacheMissRate}>
      <Chart
        showLegend
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
