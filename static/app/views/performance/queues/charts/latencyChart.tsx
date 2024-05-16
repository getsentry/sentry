import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {CHART_HEIGHT} from 'sentry/views/performance/database/settings';
import {useQueuesTimeSeriesQuery} from 'sentry/views/performance/queues/queries/useQueuesTimeSeriesQuery';
import type {Referrer} from 'sentry/views/performance/queues/referrers';
import Chart, {ChartType} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';

interface Props {
  destination?: string;
  error?: Error | null;
  referrer?: Referrer;
}

export function LatencyChart({error, destination, referrer}: Props) {
  const {data, isLoading} = useQueuesTimeSeriesQuery({destination, referrer});
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
