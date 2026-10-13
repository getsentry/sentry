import {useEffect} from 'react';
import {matchQuery, useQueryClient} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {makeEventsTimeSeriesQueryKeyPrefix} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {METRIC_TIMESERIES_REFERRER} from 'sentry/views/explore/metrics/hooks/useMetricTimeseries';

export function useRefetchOutdatedTimeseries() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {selection} = usePageFilters();
  const [interval] = useChartInterval();
  const isRelativeRange = Boolean(selection.datetime.period);

  useEffect(() => {
    const intervalMs = intervalToMilliseconds(interval);
    if (!isRelativeRange || !intervalMs) {
      return;
    }

    const queryKeyPrefix = makeEventsTimeSeriesQueryKeyPrefix(organization.slug);
    const triggerFilters = {
      queryKey: [
        ...queryKeyPrefix,
        {query: {referrer: METRIC_TIMESERIES_REFERRER, sampling: SAMPLING_MODE.NORMAL}},
      ],
    };

    return queryClient.getQueryCache().subscribe(event => {
      if (
        event.type !== 'updated' ||
        event.action.type !== 'fetch' ||
        !matchQuery(triggerFilters, event.query)
      ) {
        return;
      }

      const bucketStart = Math.floor(Date.now() / intervalMs) * intervalMs;

      // Not filtered by sampling mode: charts that escalated to high accuracy display that tier's data.
      queryClient.refetchQueries(
        {
          queryKey: [...queryKeyPrefix, {query: {referrer: METRIC_TIMESERIES_REFERRER}}],
          type: 'active',
          predicate: query =>
            query.state.status === 'success' &&
            query.state.fetchStatus === 'idle' &&
            query.state.dataUpdatedAt < bucketStart,
        },
        {cancelRefetch: false}
      );
    });
  }, [interval, isRelativeRange, organization.slug, queryClient]);
}
