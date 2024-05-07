import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {CHART_HEIGHT} from 'sentry/views/performance/database/settings';
import {useQueuesTimeSeriesQuery} from 'sentry/views/performance/queues/queries/useQueuesTimeSeriesQuery';
import Chart, {ChartType} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';

interface Props {
  error?: Error | null;
}

export function LatencyChart({error}: Props) {
  const {query} = useLocation();
  const destination = decodeScalar(query.destination);
  const pageFilters = usePageFilters();
  const period = pageFilters.selection.datetime.period;
  const chartSubtext = (period && DEFAULT_RELATIVE_PERIODS[period]) ?? '';
  const {data, isLoading} = useQueuesTimeSeriesQuery({destination});
  return (
    <ChartPanel title={t('Avg Latency')} subtitle={chartSubtext}>
      <Chart
        height={CHART_HEIGHT}
        grid={{
          left: '0',
          right: '0',
          top: '12px',
          bottom: '0',
        }}
        data={
          [
            {
              seriesName: t('Average Processing Latency'),
              data: data['avg_if(span.self_time,span.op,queue.process)'].data,
            },
          ] ?? []
        }
        loading={isLoading}
        error={error}
        chartColors={CHART_PALETTE[2].slice(1)}
        type={ChartType.AREA}
      />
    </ChartPanel>
  );
}
