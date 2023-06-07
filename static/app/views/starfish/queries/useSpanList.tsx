import {Location} from 'history';
import moment, {Moment} from 'moment';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ModuleName} from 'sentry/views/starfish/types';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {getDateQueryFilter} from 'sentry/views/starfish/utils/getDateQueryFilter';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const SPAN_FILTER_KEYS = ['span_operation', 'domain', 'action'];

export type SpanMetrics = {
  count: number;
  description: string;
  domain: string;
  epm: number;
  formatted_desc: string;
  group_id: string;
  p50: number;
  p95: number;
  span_operation: string;
  spans_per_second: number;
  total_exclusive_time: number;
};

export const useSpanList = (
  moduleName: ModuleName,
  transaction?: string,
  orderBy?: string,
  limit?: number,
  _referrer = 'span-metrics'
) => {
  const location = useLocation();
  const pageFilters = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilters);
  const dateFilters = getDateQueryFilter(startTime, endTime);

  const query = getQuery(
    moduleName,
    location,
    startTime,
    endTime,
    dateFilters,
    transaction,
    orderBy,
    limit
  );
  const eventView = undefined;

  // TODO: Add referrer
  const {isLoading, data} = useSpansQuery<SpanMetrics[]>({
    eventView,
    queryString: query,
    initialData: [],
    enabled: Boolean(query),
  });

  return {isLoading, data};
};

const getQuery = (
  moduleName: ModuleName,
  location: Location,
  startTime: Moment,
  endTime: Moment,
  dateFilters: string,
  transaction?: string,
  orderBy?: string,
  limit?: number
) => {
  const conditions = buildQueryConditions(moduleName, location).filter(Boolean);

  return `SELECT
    group_id, span_operation, description, domain,
    sum(exclusive_time) as total_exclusive_time,
    uniq(transaction) as transactions,
    quantile(0.95)(exclusive_time) as p95,
    quantile(0.75)(exclusive_time) as p75,
    quantile(0.50)(exclusive_time) as p50,
    count() as count,
    divide(count(), ${
      moment(endTime ?? undefined).unix() - moment(startTime).unix()
    }) as spans_per_second
    FROM spans_experimental_starfish
    WHERE 1 = 1
    ${conditions.length > 0 ? 'AND' : ''}
    ${conditions.join(' AND ')}
    ${transaction ? `AND transaction = '${transaction}'` : ''}
    ${dateFilters}
    GROUP BY group_id, span_operation, domain, description
    ORDER BY ${orderBy ?? 'count'} desc
    ${limit ? `LIMIT ${limit}` : ''}`;
};

const buildQueryConditions = (moduleName: ModuleName, location: Location) => {
  const {query} = location;
  const result = Object.keys(query)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    .filter(key => Boolean(query[key]))
    .map(key => {
      return `${key} = '${query[key]}'`;
    });

  if (moduleName !== ModuleName.ALL) {
    result.push(`module = '${moduleName}'`);
  }

  return result;
};
