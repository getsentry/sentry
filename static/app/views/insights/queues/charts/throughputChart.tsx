import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {renameDiscoverSeries} from 'sentry/views/insights/common/utils/renameDiscoverSeries';
import {useProcessQueuesTimeSeriesQuery} from 'sentry/views/insights/queues/queries/useProcessQueuesTimeSeriesQuery';
import {usePublishQueuesTimeSeriesQuery} from 'sentry/views/insights/queues/queries/usePublishQueuesTimeSeriesQuery';
import type {Referrer} from 'sentry/views/insights/queues/referrers';
import {FIELD_ALIASES} from 'sentry/views/insights/queues/settings';

interface Props {
  id: string;
  referrer: Referrer;
  destination?: string;
  error?: Error | null;
  pageFilters?: PageFilters;
}

export function ThroughputChart({id, error, destination, pageFilters, referrer}: Props) {
  const theme = useTheme();
  const {
    data: publishData,
    error: publishError,
    isPending: isPublishDataLoading,
  } = usePublishQueuesTimeSeriesQuery({
    destination,
    referrer,
    pageFilters,
  });

  const {
    data: processData,
    error: processError,
    isPending: isProcessDataLoading,
  } = useProcessQueuesTimeSeriesQuery({
    destination,
    referrer,
    pageFilters,
  });

  const colors = theme.chart.getColorPalette(2);
  return (
    <InsightsLineChartWidget
      id={id}
      title={t('Published vs Processed')}
      series={[
        renameDiscoverSeries(
          {
            ...publishData['epm()'],
            color: colors[1],
          },
          'epm() span.op:queue.publish'
        ),
        renameDiscoverSeries(
          {
            ...processData['epm()'],
            color: colors[2],
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
