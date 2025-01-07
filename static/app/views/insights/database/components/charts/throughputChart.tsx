import type {Series} from 'sentry/types/echarts';
import {RateUnit} from 'sentry/utils/discover/fields';
import {formatRate} from 'sentry/utils/formatters';
import {THROUGHPUT_COLOR} from 'sentry/views/insights/colors';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {CHART_HEIGHT} from 'sentry/views/insights/database/settings';

interface Props {
  isLoading: boolean;
  series: Series;
  error?: Error | null;
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
        type={ChartType.LINE}
        aggregateOutputFormat="rate"
        rateUnit={RateUnit.PER_MINUTE}
        tooltipFormatterOptions={{
          valueFormatter: value => formatRate(value, RateUnit.PER_MINUTE),
        }}
      />
    </ChartPanel>
  );
}
