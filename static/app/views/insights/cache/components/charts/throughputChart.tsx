import type {Series} from 'sentry/types/echarts';
import {RateUnit} from 'sentry/utils/discover/fields';
import {formatRate} from 'sentry/utils/formatters';
import {CHART_HEIGHT} from 'sentry/views/insights/cache/settings';
import {THROUGHPUT_COLOR} from 'sentry/views/insights/colors';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';

interface Props {
  isLoading: boolean;
  series: Series;
  error?: Error | null;
}

export function ThroughputChart({series, isLoading, error}: Props) {
  return (
    <ChartPanel title={getThroughputChartTitle('cache.get_item')}>
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
