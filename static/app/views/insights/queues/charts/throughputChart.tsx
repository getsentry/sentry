import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {useProcessQueuesTimeSeriesQuery} from 'sentry/views/insights/queues/queries/useProcessQueuesTimeSeriesQuery';
import {usePublishQueuesTimeSeriesQuery} from 'sentry/views/insights/queues/queries/usePublishQueuesTimeSeriesQuery';
import type {Referrer} from 'sentry/views/insights/queues/referrers';

import {InsightsLineChartWidget} from '../../common/components/insightsLineChartWidget';
import {renameDiscoverSeries} from '../../common/utils/renameDiscoverSeries';
import {FIELD_ALIASES} from '../settings';

interface Props {
  referrer: Referrer;
  destination?: string;
  error?: Error | null;
}

export function ThroughputChart({error, destination, referrer}: Props) {
  const {
    data: publishData,
    error: publishError,
    isPending: isPublishDataLoading,
  } = usePublishQueuesTimeSeriesQuery({
    destination,
    referrer,
  });

  const {
    data: processData,
    error: processError,
    isPending: isProcessDataLoading,
  } = useProcessQueuesTimeSeriesQuery({
    destination,
    referrer,
  });

  return (
    <InsightsLineChartWidget
      title={t('Published vs Processed')}
      series={[
        renameDiscoverSeries(
          {
            ...publishData['spm()'],
            color: CHART_PALETTE[2][1],
          },
          'spm() span.op:queue.publish'
        ),
        renameDiscoverSeries(
          {
            ...processData['spm()'],
            color: CHART_PALETTE[2][2],
          },
          'spm() span.op:queue.process'
        ),
      ]}
      aliases={FIELD_ALIASES}
      isLoading={isPublishDataLoading || isProcessDataLoading}
      error={error ?? processError ?? publishError}
    />
  );
}
