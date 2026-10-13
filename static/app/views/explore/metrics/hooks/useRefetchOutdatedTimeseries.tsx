import {useLayoutEffect} from 'react';
import {matchQuery, useQueryClient, type Query} from '@tanstack/react-query';

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

  // A layout effect subscribes before the charts' passive effects start their first fetches.
  useLayoutEffect(() => {
    const intervalMs = intervalToMilliseconds(interval);
    if (!isRelativeRange || !intervalMs) {
      return;
    }

    const queryKeyPrefix = makeEventsTimeSeriesQueryKeyPrefix(organization.slug);
    // Not filtered by sampling mode: charts that escalated to high accuracy display that tier's data.
    const timeseriesFilters = {
      queryKey: [...queryKeyPrefix, {query: {referrer: METRIC_TIMESERIES_REFERRER}}],
    };
    const triggerFilters = {
      queryKey: [
        ...queryKeyPrefix,
        {query: {referrer: METRIC_TIMESERIES_REFERRER, sampling: SAMPLING_MODE.NORMAL}},
      ],
    };

    // The server resolves the relative range when the request arrives, which can be
    // an interval earlier than dataUpdatedAt for responses that span a boundary.
    const fetchStartedAt = new WeakMap<Query, number>();
    const dataRequestedAt = new WeakMap<Query, number>();

    return queryClient.getQueryCache().subscribe(event => {
      if (event.type !== 'updated' || !matchQuery(timeseriesFilters, event.query)) {
        return;
      }

      if (event.action.type === 'success') {
        const startedAt = fetchStartedAt.get(event.query);
        if (startedAt !== undefined) {
          dataRequestedAt.set(event.query, startedAt);
        }
        return;
      }

      if (event.action.type !== 'fetch') {
        return;
      }

      fetchStartedAt.set(event.query, Date.now());

      if (!matchQuery(triggerFilters, event.query)) {
        return;
      }

      const bucketStart = Math.floor(Date.now() / intervalMs) * intervalMs;

      queryClient.refetchQueries(
        {
          ...timeseriesFilters,
          type: 'active',
          predicate: query =>
            query.state.status === 'success' &&
            query.state.fetchStatus === 'idle' &&
            (dataRequestedAt.get(query) ?? query.state.dataUpdatedAt) < bucketStart,
        },
        {cancelRefetch: false}
      );
    });
  }, [interval, isRelativeRange, organization.slug, queryClient]);
}
