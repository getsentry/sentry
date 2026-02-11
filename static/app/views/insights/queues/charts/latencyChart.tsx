import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
// Our loadable chart widgets use this to render, so this import is ok
// eslint-disable-next-line no-restricted-imports
import {InsightsAreaChartWidget} from 'sentry/views/insights/common/components/insightsAreaChartWidget';
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
  } = useFetchSpanTimeSeries(
    {
      yAxis: ['avg(messaging.message.receive.latency)', 'avg(span.duration)'],
      query: search,
      pageFilters,
    },
    referrer
  );

  const timeSeries = (data?.timeSeries || []).map(
    (possiblyIncompleteTimeSeries): TimeSeries => {
      // This is a tricky data issue. If Snuba doesn't find any data for a field,
      // it doesn't return a unit. If Discover can't guess the type based on the
      // unit, there's no entry in the meta for the field. If there's no field,
      // `TimeSeriesWidgetVisualization` dumps that data onto its own "number"
      // axis, which looks weird. This is a rare case, and I'm hoping that in the
      // future, backend will be able to determine types most of the time. For
      // now, I'll add a placeholder.

      return {
        ...possiblyIncompleteTimeSeries,
        meta: {
          ...possiblyIncompleteTimeSeries.meta,
          valueType: possiblyIncompleteTimeSeries.meta.valueType ?? 'duration',
          valueUnit:
            possiblyIncompleteTimeSeries.meta.valueUnit ?? DurationUnit.MILLISECOND,
        },
      };
    }
  );

  return (
    <InsightsAreaChartWidget
      id={id}
      queryInfo={{search, referrer}}
      title={t('Average Duration')}
      timeSeries={timeSeries}
      aliases={FIELD_ALIASES}
      error={error ?? latencyError}
      isLoading={isPending}
    />
  );
}
