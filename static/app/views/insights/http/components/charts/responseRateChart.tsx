import type {Series} from 'sentry/types/echarts';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {
  HTTP_RESPONSE_3XX_COLOR,
  HTTP_RESPONSE_4XX_COLOR,
  HTTP_RESPONSE_5XX_COLOR,
} from 'sentry/views/insights/colors';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {getAxisMaxForPercentageSeries} from 'sentry/views/insights/common/utils/getAxisMaxForPercentageSeries';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {CHART_HEIGHT} from 'sentry/views/insights/http/settings';

interface Props {
  isLoading: boolean;
  series: [Series, Series, Series];
  error?: Error | null;
}

export function ResponseRateChart({series, isLoading, error}: Props) {
  return (
    <ChartPanel title={DataTitles.unsuccessfulHTTPCodes}>
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
        chartColors={[
          HTTP_RESPONSE_3XX_COLOR,
          HTTP_RESPONSE_4XX_COLOR,
          HTTP_RESPONSE_5XX_COLOR,
        ]}
        type={ChartType.LINE}
        aggregateOutputFormat="percentage"
        dataMax={getAxisMaxForPercentageSeries(series)}
        tooltipFormatterOptions={{
          valueFormatter: value => formatPercentage(value),
        }}
      />
    </ChartPanel>
  );
}
