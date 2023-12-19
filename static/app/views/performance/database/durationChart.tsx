import {Series} from 'sentry/types/echarts';
import {DurationAggregateSelector} from 'sentry/views/performance/database/durationAggregateSelector';
import {CHART_HEIGHT} from 'sentry/views/performance/database/settings';
import {AVG_COLOR} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';

interface Props {
  isLoading: boolean;
  series: Series;
}

export function DurationChart({series, isLoading}: Props) {
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
        data={[series]}
        loading={isLoading}
        chartColors={[AVG_COLOR]}
        isLineChart
      />
    </ChartPanel>
  );
}
