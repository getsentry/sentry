import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {ALERTS} from 'sentry/views/insights/queues/alerts';
import {useProcessQueuesTimeSeriesQuery} from 'sentry/views/insights/queues/queries/useProcessQueuesTimeSeriesQuery';
import type {Referrer} from 'sentry/views/insights/queues/referrers';
import {CHART_HEIGHT} from 'sentry/views/insights/queues/settings';

interface Props {
  referrer: Referrer;
  destination?: string;
  error?: Error | null;
}

export function LatencyChart({error, destination, referrer}: Props) {
  const {data, isPending} = useProcessQueuesTimeSeriesQuery({
    destination,
    referrer,
  });

  let {latency, duration} = ALERTS;
  if (destination) {
    latency = {
      ...latency,
      query: `${latency.query} messaging.destination.name:${destination}`,
    };
    duration = {
      ...duration,
      query: `${duration.query} messaging.destination.name:${destination}`,
    };
  }

  return (
    <ChartPanel title={t('Avg Latency')} alertConfigs={[latency, duration]}>
      <Chart
        height={CHART_HEIGHT}
        grid={{
          left: '0',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        data={[
          {
            seriesName: t('Average Time in Queue'),
            data: data['avg(messaging.message.receive.latency)'].data,
          },
          {
            seriesName: t('Average Processing Time'),
            data: data['avg(span.duration)'].data,
          },
        ]}
        loading={isPending}
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
