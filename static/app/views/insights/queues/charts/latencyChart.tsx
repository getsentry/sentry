import cloneDeep from 'lodash/cloneDeep';

import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
// Our loadable chart widgets use this to render, so this import is ok
// eslint-disable-next-line no-restricted-imports
import {InsightsAreaChartWidget} from 'sentry/views/insights/common/components/insightsAreaChartWidget';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
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
  const search = new MutableSearch('span.op:queue.process');
  if (destination) {
    search.addFilterValue('messaging.destination.name', destination, false);
  }

  const {
    data,
    isPending,
    error: latencyError,
  } = useSpanMetricsSeries(
    {
      yAxis: ['avg(span.duration)', 'avg(messaging.message.receive.latency)'],
      search,
      transformAliasToInputFormat: true,
    },
    referrer,
    pageFilters
  );

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
      queryInfo={{search, referrer}}
      title={t('Average Duration')}
      series={[messageReceiveLatencySeries, data['avg(span.duration)']]}
      aliases={FIELD_ALIASES}
      error={error ?? latencyError}
      isLoading={isPending}
    />
  );
}
