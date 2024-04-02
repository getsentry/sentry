import type {Series} from 'sentry/types/echarts';
import {CHART_HEIGHT} from 'sentry/views/performance/database/settings';
import {COUNT_COLOUR} from 'sentry/views/starfish/colours';
import Chart, {ChartType} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

interface Props {
  isLoading: boolean;
  series: Series;
  error?: Error | null;
}

export function ResponseCodeBarChart({series, isLoading, error}: Props) {
  return (
    <ChartPanel title={DataTitles.httpCodeBreakdown}>
      <Chart
        height={CHART_HEIGHT}
        grid={{
          left: '0',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        aggregateOutputFormat="number"
        data={[series]}
        loading={isLoading}
        error={error}
        preserveIncompletePoints
        chartColors={[COUNT_COLOUR]}
        type={ChartType.BAR}
      />
    </ChartPanel>
  );
}
