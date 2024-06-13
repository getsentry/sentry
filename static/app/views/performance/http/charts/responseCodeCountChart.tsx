import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {CHART_HEIGHT} from 'sentry/views/performance/http/settings';
import Chart, {ChartType} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';

interface Props {
  isLoading: boolean;
  series: Series[];
  error?: Error | null;
}

export function ResponseCodeCountChart({series, isLoading, error}: Props) {
  return (
    <ChartPanel title={t('Response Codes')}>
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
