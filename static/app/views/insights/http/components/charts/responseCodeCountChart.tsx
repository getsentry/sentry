import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {CHART_HEIGHT} from 'sentry/views/insights/http/settings';

interface Props {
  isLoading: boolean;
  series: Series[];
  error?: Error | null;
}

export function ResponseCodeCountChart({series, isLoading, error}: Props) {
  return (
    <ChartPanel title={t('Top 5 Response Codes')}>
      <Chart
        showLegend
        height={CHART_HEIGHT}
        grid={{
          left: '4px',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        data={series}
        loading={isLoading}
        error={error}
        type={ChartType.LINE}
        aggregateOutputFormat="number"
      />
    </ChartPanel>
  );
}
