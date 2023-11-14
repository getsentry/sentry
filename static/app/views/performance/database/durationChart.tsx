import {Series} from 'sentry/types/echarts';
import {DurationAggregateSelector} from 'sentry/views/performance/database/durationAggregateSelector';
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
        data={[series]}
        loading={isLoading}
        utc={false}
        chartColors={[AVG_COLOR]}
        isLineChart
        definedAxisTicks={4}
      />
    </ChartPanel>
  );
}

const CHART_HEIGHT = 160;
