import type {Series} from 'sentry/types/echarts';
import {CHART_HEIGHT} from 'sentry/views/performance/database/settings';
import {AVG_COLOR} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {getDurationChartTitle} from 'sentry/views/starfish/views/spans/types';

interface Props {
  isLoading: boolean;
  series: Series;
  error?: Error | null;
}

export function DurationChart({series, isLoading, error}: Props) {
  return (
    <ChartPanel title={getDurationChartTitle('http')}>
      <Chart
        height={CHART_HEIGHT}
        grid={{
          left: '0',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        data={[series]}
        loading={isLoading}
        error={error}
        chartColors={[AVG_COLOR]}
        isLineChart
      />
    </ChartPanel>
  );
}
