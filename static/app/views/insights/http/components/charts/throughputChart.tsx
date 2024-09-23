import type {Series} from 'sentry/types/echarts';
import {RateUnit} from 'sentry/utils/discover/fields';
import {formatRate} from 'sentry/utils/formatters';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {THROUGHPUT_COLOR} from 'sentry/views/insights/colors';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {getThroughputChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {ALERTS} from 'sentry/views/insights/http/alerts';
import {CHART_HEIGHT} from 'sentry/views/insights/http/settings';
import type {SpanMetricsQueryFilters} from 'sentry/views/insights/types';

interface Props {
  isLoading: boolean;
  series: Series;
  error?: Error | null;
  filters?: SpanMetricsQueryFilters;
}

export function ThroughputChart({series, isLoading, error, filters}: Props) {
  const filterString = filters && MutableSearch.fromQueryObject(filters).formatString();
  const alertConfig = {...ALERTS.spm, query: filterString ?? ALERTS.spm.query};
  return (
    <ChartPanel title={getThroughputChartTitle('http')} alertConfigs={[alertConfig]}>
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
