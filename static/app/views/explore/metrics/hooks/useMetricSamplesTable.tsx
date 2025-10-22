import {useMemo} from 'react';
import moment from 'moment-timezone';

import type {PageFilters} from 'sentry/types/core';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {
  useQueryParamsSearch,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {
  DATE_FORMAT,
  useSpansQuery,
} from 'sentry/views/insights/common/queries/useSpansQuery';
import {INGESTION_DELAY} from 'sentry/views/insights/settings';

const MILLISECONDS_PER_SECOND = 1000;

interface UseMetricSamplesTableOptions {
  enabled: boolean;
  fields: string[];
  limit: number;
  metricName: string;
  ingestionDelaySeconds?: number;
}

interface MetricSamplesTableResult {
  eventView: EventView;
  fields: string[];
  result: ReturnType<typeof useSpansQuery<any[]>>;
}

export function useMetricSamplesTable({
  enabled,
  limit,
  metricName,
  fields,
  ingestionDelaySeconds,
}: UseMetricSamplesTableOptions) {
  return useMetricSamplesTableImp({
    enabled,
    limit,
    metricName,
    fields,
    ingestionDelaySeconds,
  });
}

function useMetricSamplesTableImp({
  enabled,
  limit,
  metricName,
  fields,
  ingestionDelaySeconds = INGESTION_DELAY,
}: UseMetricSamplesTableOptions): MetricSamplesTableResult {
  const {selection} = usePageFilters();
  const searchQuery = useQueryParamsSearch();
  const sortBys = useQueryParamsSortBys();

  const query = useMemo(() => {
    const currentSearch = new MutableSearch(`metric.name:${metricName}`);
    if (!searchQuery.isEmpty()) {
      currentSearch.addStringFilter(searchQuery.formatString());
    }
    return currentSearch.formatString();
  }, [metricName, searchQuery]);

  // Calculate adjusted datetime values with ingestion delay applied
  // This is memoized separately to prevent recalculating on every render
  const adjustedDatetime: PageFilters['datetime'] = useMemo(() => {
    const {start, end, period, utc} = selection.datetime;

    // Only apply delay for relative time periods (statsPeriod), not absolute timestamps
    // because absolute timestamps are explicitly set by the user
    const periodMs = period ? intervalToMilliseconds(period) : 0;
    if (period && periodMs > ingestionDelaySeconds * MILLISECONDS_PER_SECOND && !end) {
      const startTime = moment().subtract(periodMs, 'milliseconds');
      const delayedEndTime = moment().subtract(ingestionDelaySeconds, 'seconds');

      return {
        start: startTime.format(DATE_FORMAT),
        end: delayedEndTime.format(DATE_FORMAT),
        period: null, // Clear period since we now have explicit timestamps
        utc,
      };
    }

    return {start, end, period, utc};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.datetime.period, ingestionDelaySeconds]); // Only recalc when period or delay changes

  const eventView = useMemo(() => {
    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Metric Samples',
      fields,
      orderby: sortBys.map(formatSort),
      query,
      version: 2,
      dataset: DiscoverDatasets.TRACEMETRICS,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, {
      ...selection,
      datetime: adjustedDatetime,
    });
  }, [fields, query, selection, adjustedDatetime, sortBys]);

  const result = useSpansQuery({
    enabled: enabled && Boolean(metricName),
    eventView,
    initialData: [],
    limit,
    referrer: 'api.explore.metric-samples-table',
    trackResponseAnalytics: false,
  });

  return useMemo(() => {
    return {eventView, fields, result};
  }, [eventView, fields, result]);
}
