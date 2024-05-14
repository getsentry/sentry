import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
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
  const {data, isLoading} = useQueuesTimeSeriesQuery({destination});
  return (
    <ChartPanel title={t('Avg Latency')}>
      <Chart
        height={CHART_HEIGHT}
        grid={{
          left: '0',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        data={
          [
            {
              seriesName: t('Average Time in Queue'),
              data: data['avg(messaging.message.receive.latency)'].data,
            },
            {
              seriesName: t('Average Processing Time'),
              data: data['avg_if(span.duration,span.op,queue.process)'].data,
            },
          ] ?? []
        }
        loading={isLoading}
        error={error}
        chartColors={CHART_PALETTE[2].slice(1)}
        type={ChartType.AREA}
        showLegend
        stacked
        aggregateOutputFormat="duration"
      />
    </ChartPanel>
  );
}
