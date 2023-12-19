import {Series} from 'sentry/types/echarts';
import {RateUnits} from 'sentry/utils/discover/fields';
import {formatRate} from 'sentry/utils/formatters';
import {CHART_HEIGHT} from 'sentry/views/performance/database/settings';
import {THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {getThroughputChartTitle} from 'sentry/views/starfish/views/spans/types';

interface Props {
  isLoading: boolean;
  series: Series;
}

export function ThroughputChart({series, isLoading}: Props) {
  return (
    <ChartPanel title={getThroughputChartTitle('db')}>
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
        chartColors={[THROUGHPUT_COLOR]}
        isLineChart
        aggregateOutputFormat="rate"
        rateUnit={RateUnits.PER_MINUTE}
        tooltipFormatterOptions={{
          valueFormatter: value => formatRate(value, RateUnits.PER_MINUTE),
        }}
      />
    </ChartPanel>
  );
}
