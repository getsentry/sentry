import {unix} from 'moment';

import {getInterval} from 'sentry/components/charts/utils';
import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {getDateQueryFilter} from 'sentry/views/starfish/utils/getDateQueryFilter';
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
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);

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

  const FAILURE_RATE_QUERY = `SELECT
    toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
    countIf(greaterOrEquals(status, 500)) as "http_error_count()"
    FROM spans_experimental_starfish
    WHERE module = 'http'
    ${dateFilters}
    GROUP BY interval
    ORDER BY interval asc
  `;

  const eventView = EventView.fromNewQueryWithLocation(discoverQuery, location);

  const result = useSpansQuery<{'http_error_count()': number; interval: number}[]>({
    eventView,
    queryString: FAILURE_RATE_QUERY,
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
