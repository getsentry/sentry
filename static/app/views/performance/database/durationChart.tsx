import type {Series} from 'sentry/types/echarts';
import {DurationAggregateSelector} from 'sentry/views/performance/database/durationAggregateSelector';
import {CHART_HEIGHT} from 'sentry/views/performance/database/settings';
import {AVG_COLOR} from 'sentry/views/starfish/colors';
import Chart, {ChartType} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';

interface Props {
  isLoading: boolean;
  series: Series[];
  error?: Error | null;
}

export function DurationChart({series, isLoading, error}: Props) {
  return (
    <ChartPanel title={<DurationAggregateSelector />}>
      <Chart
        height={CHART_HEIGHT}
        grid={{
          left: '0',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        data={series}
        loading={isLoading}
        error={error}
        chartColors={[AVG_COLOR]}
        type={ChartType.LINE}
      />
    </ChartPanel>
  );
}
