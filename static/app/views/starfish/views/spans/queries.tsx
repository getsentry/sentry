import {unix} from 'moment';

import {getInterval} from 'sentry/components/charts/utils';
import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export const getTimeSpentQuery = (
  descriptionFilter: string | undefined,
  groupingColumn: string,
  conditions: string[] = []
) => {
  const validConditions = conditions.filter(Boolean);

  return `SELECT
    ${groupingColumn} AS primary_group,
    sum(exclusive_time) AS exclusive_time
    FROM spans_experimental_starfish
    WHERE 1 = 1
    ${validConditions.length > 0 ? 'AND' : ''}
    ${validConditions.join(' AND ')}
    ${descriptionFilter ? `AND match(lower(description), '${descriptionFilter}')` : ''}
    GROUP BY primary_group
  `;
};

export const useErrorRateQuery = (queryString: string) => {
  const location = useLocation();
  const pageFilter = usePageFilters();

  const discoverQuery: NewQuery = {
    id: undefined,
    name: 'HTTP Module - HTTP error rate',
    projects: [1],
    fields: ['http_error_count()'],
    query: queryString,
    version: 1,
    topEvents: '5',
    dataset: DiscoverDatasets.SPANS_METRICS,
    interval: getInterval(pageFilter.selection.datetime, 'low'),
    yAxis: ['http_error_count()'],
  };

  const eventView = EventView.fromNewQueryWithLocation(discoverQuery, location);

  const result = useSpansQuery<{'http_error_count()': number; interval: number}[]>({
    eventView,
    initialData: [],
  });

  const formattedData = result?.data?.map(entry => {
    return {
      interval: unix(entry.interval).format('YYYY-MM-DDTHH:mm:ss'),
      'http_error_count()': entry['http_error_count()'],
    };
  });

  return {...result, formattedData};
};
