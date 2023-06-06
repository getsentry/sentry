import moment, {unix} from 'moment';

import {DateTimeObject} from 'sentry/components/charts/utils';
import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  datetimeToClickhouseFilterTimestamps,
  getDateFilters,
} from 'sentry/views/starfish/utils/dates';
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

export const getSpanListQuery = (
  datetime: DateTimeObject,
  conditions: string[] = [],
  orderBy: string,
  limit: number
) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  const validConditions = conditions.filter(Boolean);

  return `SELECT
    group_id, span_operation, description, domain,
    sum(exclusive_time) as total_exclusive_time,
    uniq(transaction) as transactions,
    quantile(0.95)(exclusive_time) as p95,
    quantile(0.75)(exclusive_time) as p75,
    quantile(0.50)(exclusive_time) as p50,
    count() as count,
    (divide(count, ${
      moment(end_timestamp ?? undefined).unix() - moment(start_timestamp).unix()
    }) AS spans_per_second)
    FROM spans_experimental_starfish
    WHERE greaterOrEquals(start_timestamp, '${start_timestamp}')
    ${validConditions.length > 0 ? 'AND' : ''}
    ${validConditions.join(' AND ')}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY group_id, span_operation, domain, description
    ORDER BY ${orderBy ?? 'count'} desc
    ${limit ? `LIMIT ${limit}` : ''}`;
};

export const getSpansTrendsQuery = (datetime: DateTimeObject, groupIDs: string[]) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);

  return `
    SELECT
    group_id, span_operation,
    toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval,
    quantile(0.50)(exclusive_time) as p50_trend,
    quantile(0.95)(exclusive_time) as p95_trend,
    divide(count(), multiply(24, 60)) as throughput
    FROM spans_experimental_starfish
    WHERE greaterOrEquals(start_timestamp, '${start_timestamp}')
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    AND group_id IN (${groupIDs.map(id => `'${id}'`).join(',')})
    GROUP BY group_id, span_operation, interval
    ORDER BY interval asc
  `;
};

export const useErrorRateQuery = (queryString: string) => {
  const location = useLocation();
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);

  const interval = 12;
  const discoverQuery: NewQuery = {
    id: undefined,
    name: 'HTTP Module - HTTP error rate',
    projects: [1],
    fields: ['http_error_count()'],
    query: queryString,
    version: 1,
    topEvents: '5',
    dataset: DiscoverDatasets.SPANS_METRICS,
    interval: `${interval}h`,
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
