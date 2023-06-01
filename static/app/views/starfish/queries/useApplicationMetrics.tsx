import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {getDateQueryFilter} from 'sentry/views/starfish/utils/getDateQueryFilter';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export type ApplicationMetrics = {
  count: number;
  'sum(span.duration)': number;
};

export const useApplicationMetrics = (_referrer = 'application-metrics') => {
  const pageFilters = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilters);
  const dateFilters = getDateQueryFilter(startTime, endTime);

  const query = getQuery(dateFilters);
  const eventView = getEventView();

  // TODO: Add referrer
  const {isLoading, data} = useSpansQuery<ApplicationMetrics[]>({
    eventView,
    queryString: query,
    initialData: [],
    enabled: Boolean(query),
  });

  return {isLoading, data: data[0] ?? {}};
};

function getQuery(dateFilters: string) {
  return `
    SELECT
    count() as count,
    sum(exclusive_time) as "sum(span.duration)"
    FROM spans_experimental_starfish
    WHERE 1 = 1
    ${dateFilters}
`;
}

function getEventView() {
  return EventView.fromSavedQuery({
    name: '',
    fields: ['sum(span.duration)'],
    dataset: DiscoverDatasets.SPANS_METRICS,
    projects: [1],
    version: 2,
  });
}
