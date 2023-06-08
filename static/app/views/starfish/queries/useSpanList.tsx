import {Location} from 'history';
import moment, {Moment} from 'moment';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ModuleName} from 'sentry/views/starfish/types';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {getDateQueryFilter} from 'sentry/views/starfish/utils/getDateQueryFilter';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const SPAN_FILTER_KEYS = ['span.op', 'span.domain', 'span.action'];
const SPAN_FILTER_KEY_TO_LOCAL_FIELD = {
  'span.op': 'span_operation',
  'span.domain': 'domain',
  'span.action': 'action',
};

export type SpanMetrics = {
  'p95(span.duration)': number;
  'span.description': string;
  'span.domain': string;
  'span.group': string;
  'span.op': string;
  'spm()': number;
  'sum(span.duration)': number;
  'time_spent_percentage()': number;
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
  const eventView = getEventView(moduleName, location, transaction, orderBy);

  // TODO: Add referrer
  const {isLoading, data} = useSpansQuery<SpanMetrics[]>({
    eventView,
    queryString: query,
    initialData: [],
    enabled: Boolean(query),
    limit,
  });

  return {isLoading, data};
};

function getQuery(
  moduleName: ModuleName,
  location: Location,
  startTime: Moment,
  endTime: Moment,
  dateFilters: string,
  transaction?: string,
  orderBy?: string,
  limit?: number
) {
  const conditions = buildQueryConditions(moduleName, location).filter(Boolean);

  return `SELECT
    group_id as "span.group",
    span_operation as "span.operation",
    description as "span.description",
    domain as "span.domain",
    sum(exclusive_time) as "sum(span.duration)",
    quantile(0.95)(exclusive_time) as "p95(span.duration)",
    divide(count(), ${
      moment(endTime ?? undefined).unix() - moment(startTime).unix()
    }) as "spm()"
    FROM spans_experimental_starfish
    WHERE 1 = 1
    ${conditions.length > 0 ? 'AND' : ''}
    ${conditions.join(' AND ')}
    ${transaction ? `AND transaction = '${transaction}'` : ''}
    ${dateFilters}
    GROUP BY group_id, span_operation, domain, description
    ORDER BY ${(orderBy && !orderBy.includes('time_spent_percentage')) ?? 'count'} desc
    ${limit ? `LIMIT ${limit}` : ''}`;
}

function buildQueryConditions(moduleName: ModuleName, location: Location) {
  const {query} = location;
  const result = Object.keys(query)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    .filter(key => Boolean(query[key]))
    .map(key => {
      return `${SPAN_FILTER_KEY_TO_LOCAL_FIELD[key]} = '${query[key]}'`;
    });

  if (moduleName !== ModuleName.ALL) {
    result.push(`module = '${moduleName}'`);
  }

  return result;
}

function getEventView(
  moduleName: ModuleName,
  location: Location,
  transaction?: string,
  orderBy?: string
) {
  const query = buildEventViewQuery(moduleName, location, transaction)
    .filter(Boolean)
    .join(' ');

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query,
      fields: [
        'span.op',
        'span.group',
        'span.description',
        'span.domain',
        'spm()',
        'sum(span.duration)',
        'p95(span.duration)',
        'time_spent_percentage()',
      ],
      orderby: orderBy,
      dataset: DiscoverDatasets.SPANS_METRICS,
      projects: [1],
      version: 2,
    },
    location
  );
}

function buildEventViewQuery(
  moduleName: ModuleName,
  location: Location,
  transaction?: string
) {
  const {query} = location;
  const result = Object.keys(query)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    .filter(key => Boolean(query[key]))
    .map(key => {
      return `${key}:${query[key]}`;
    });

  if (moduleName !== ModuleName.ALL) {
    result.push(`span.module:${moduleName}`);
  }

  if (transaction) {
    result.push(`transaction:${transaction}`);
  }

  return result;
}
