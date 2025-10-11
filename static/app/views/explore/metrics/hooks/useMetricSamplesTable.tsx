import {useMemo} from 'react';

import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {
  useQueryParamsSearch,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

interface UseMetricSamplesTableOptions {
  enabled: boolean;
  fields: string[];
  limit: number;
  metricName: string;
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
}: UseMetricSamplesTableOptions) {
  return useMetricSamplesTableImp({enabled, limit, metricName, fields});
}

function useMetricSamplesTableImp({
  enabled,
  limit,
  metricName,
  fields,
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

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [fields, query, selection, sortBys]);

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
