import type {Series} from 'sentry/types/echarts';
import {RateUnit} from 'sentry/utils/discover/fields';
import {formatRate} from 'sentry/utils/formatters';
import {CHART_HEIGHT} from 'sentry/views/performance/database/settings';
import {THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {getThroughputChartTitle} from 'sentry/views/starfish/views/spans/types';

interface Props {
  isLoading: boolean;
  series: Series;
  error?: Error | null;
}

export function ThroughputChart({series, isLoading, error}: Props) {
  return (
    <ChartPanel title={getThroughputChartTitle('http')}>
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
        chartColors={[THROUGHPUT_COLOR]}
        isLineChart
        aggregateOutputFormat="rate"
        rateUnit={RateUnit.PER_MINUTE}
        tooltipFormatterOptions={{
          valueFormatter: value => formatRate(value, RateUnit.PER_MINUTE),
        }}
      />
    </ChartPanel>
  );
}
