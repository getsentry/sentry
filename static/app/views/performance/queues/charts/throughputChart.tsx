import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {RateUnit} from 'sentry/utils/discover/fields';
import {formatRate} from 'sentry/utils/formatters';
import {CHART_HEIGHT} from 'sentry/views/performance/database/settings';
import {useProcessQueuesTimeSeriesQuery} from 'sentry/views/performance/queues/queries/useProcessQueuesTimeSeriesQuery';
import {usePublishQueuesTimeSeriesQuery} from 'sentry/views/performance/queues/queries/usePublishQueuesTimeSeriesQuery';
import type {Referrer} from 'sentry/views/performance/queues/referrers';
import Chart, {ChartType} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';

interface Props {
  referrer: Referrer;
  destination?: string;
  error?: Error | null;
}

export function ThroughputChart({error, destination, referrer}: Props) {
  const {data: publishData, isLoading: isPublishDataLoading} =
    usePublishQueuesTimeSeriesQuery({
      destination,
      referrer,
    });
  const {data: processData, isLoading: isProcessDataLoading} =
    useProcessQueuesTimeSeriesQuery({
      destination,
      referrer,
    });
  return (
    <ChartPanel title={t('Published vs Processed')}>
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
              seriesName: t('Published'),
              data: publishData['spm()'].data,
            },
            {
              seriesName: t('Processed'),
              data: processData['spm()'].data,
            },
          ] ?? []
        }
        loading={isPublishDataLoading || isProcessDataLoading}
        error={error}
        chartColors={CHART_PALETTE[2].slice(1, 3)}
        type={ChartType.LINE}
        aggregateOutputFormat="rate"
        rateUnit={RateUnit.PER_MINUTE}
        tooltipFormatterOptions={{
          valueFormatter: value => formatRate(value, RateUnit.PER_MINUTE),
        }}
        showLegend
      />
    </ChartPanel>
  );
}
