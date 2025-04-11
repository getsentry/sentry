import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {renameDiscoverSeries} from 'sentry/views/insights/common/utils/renameDiscoverSeries';
import {useProcessQueuesTimeSeriesQuery} from 'sentry/views/insights/queues/queries/useProcessQueuesTimeSeriesQuery';
import {usePublishQueuesTimeSeriesQuery} from 'sentry/views/insights/queues/queries/usePublishQueuesTimeSeriesQuery';
import type {Referrer} from 'sentry/views/insights/queues/referrers';
import {FIELD_ALIASES} from 'sentry/views/insights/queues/settings';

interface Props {
  referrer: Referrer;
  destination?: string;
  error?: Error | null;
}

export function ThroughputChart({error, destination, referrer}: Props) {
  const theme = useTheme();
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
            ...publishData['epm()'],
            color: theme.chart.colors[2][1],
          },
          'epm() span.op:queue.publish'
        ),
        renameDiscoverSeries(
          {
            ...processData['epm()'],
            color: theme.chart.colors[2][2],
          },
          'epm() span.op:queue.process'
        ),
      ]}
      aliases={FIELD_ALIASES}
      isLoading={isPublishDataLoading || isProcessDataLoading}
      error={error ?? processError ?? publishError}
    />
  );
}
