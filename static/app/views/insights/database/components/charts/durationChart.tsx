import type {Series} from 'sentry/types/echarts';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {AVG_COLOR} from 'sentry/views/insights/colors';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {ALERTS} from 'sentry/views/insights/database/alerts';
import {CHART_HEIGHT} from 'sentry/views/insights/database/settings';
import type {SpanMetricsQueryFilters} from 'sentry/views/insights/types';

interface Props {
  isLoading: boolean;
  series: Series[];
  error?: Error | null;
  filters?: SpanMetricsQueryFilters;
}

export function DurationChart({series, isLoading, error, filters}: Props) {
  const filterString = filters && MutableSearch.fromQueryObject(filters).formatString();
  const alertConfig = {...ALERTS.duration, query: filterString ?? ALERTS.duration.query};
  return (
    <ChartPanel title={getDurationChartTitle('db')} alertConfigs={[alertConfig]}>
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
