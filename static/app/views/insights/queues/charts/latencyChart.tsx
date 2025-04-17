import cloneDeep from 'lodash/cloneDeep';

import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {InsightsAreaChartWidget} from 'sentry/views/insights/common/components/insightsAreaChartWidget';
import {useProcessQueuesTimeSeriesQuery} from 'sentry/views/insights/queues/queries/useProcessQueuesTimeSeriesQuery';
import type {Referrer} from 'sentry/views/insights/queues/referrers';
import {FIELD_ALIASES} from 'sentry/views/insights/queues/settings';

interface Props {
  id: string;
  referrer: Referrer;
  destination?: string;
  error?: Error | null;
  pageFilters?: PageFilters;
}

export function LatencyChart({id, error, destination, referrer, pageFilters}: Props) {
  const {
    data,
    isPending,
    error: latencyError,
  } = useProcessQueuesTimeSeriesQuery({
    destination,
    referrer,
    pageFilters,
  });

  const messageReceiveLatencySeries = cloneDeep(
    data['avg(messaging.message.receive.latency)']
  );

  if (
    !isPending &&
    !error &&
    defined(messageReceiveLatencySeries.data) &&
    defined(messageReceiveLatencySeries.meta) &&
    !defined(
      messageReceiveLatencySeries.meta?.fields['avg(messaging.message.receive.latency)']
    )
  ) {
    // This is a tricky data issue. If Snuba doesn't find any data for a field,
    // it doesn't return a unit. If Discover can't guess the type based on the
    // unit, there's no entry in the meta for the field. If there's no field,
    // `TimeSeriesWidgetVisualization` dumps that data onto its own "number"
    // axis, which looks weird. This is a rare case, and I'm hoping that in the
    // future, backend will be able to determine types most of the time. For
    // now, backfill the type, since we know it.
    messageReceiveLatencySeries.meta.fields['avg(messaging.message.receive.latency)'] =
      'duration';
    messageReceiveLatencySeries.meta.units['avg(messaging.message.receive.latency)'] =
      'millisecond';
  }

  return (
    <InsightsAreaChartWidget
      id={id}
      title={t('Average Duration')}
      series={[messageReceiveLatencySeries, data['avg(span.duration)']]}
      aliases={FIELD_ALIASES}
      error={error ?? latencyError}
      isLoading={isPending}
    />
  );
}
