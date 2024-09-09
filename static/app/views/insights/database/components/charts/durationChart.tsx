import type {Series} from 'sentry/types/echarts';
import {AVG_COLOR} from 'sentry/views/insights/colors';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {ALERTS} from 'sentry/views/insights/database/alerts';
import {CHART_HEIGHT} from 'sentry/views/insights/database/settings';

interface Props {
  isLoading: boolean;
  series: Series[];
  error?: Error | null;
  groupId?: string;
}

export function DurationChart({series, isLoading, error, groupId}: Props) {
  let alertConfig = ALERTS.duration;
  if (groupId) {
    alertConfig = {...alertConfig, query: `${alertConfig.query} span.group:${groupId}`};
  }
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
