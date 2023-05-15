import {useQuery} from '@tanstack/react-query';

import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {DefinedUseQueryResult} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getDateQueryFilter} from 'sentry/views/starfish/modules/databaseModule/queries';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {
  datetimeToClickhouseFilterTimestamps,
  getDateFilters,
} from 'sentry/views/starfish/utils/dates';
import {useWrappedDiscoverTimeseriesQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export const getHostListQuery = ({datetime}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `SELECT
    domain,
    toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
    quantile(0.99)(exclusive_time) as p99,
    count() as count,
    countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as failure_count,
    failure_count / count as failure_rate
    FROM spans_experimental_starfish
    WHERE module = 'http'
    AND domain != ''
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY domain, interval
    ORDER BY domain, interval asc
 `;
};

export const getHostListEventView = ({datetime}) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: ['domain'],
    yAxis: ['p99(span.self_time)', 'count()'],
    query: 'module:http',
    topEvents: '10',
    start: datetime.start,
    end: datetime.end,
    range: datetime.period,
    dataset: DiscoverDatasets.SPANS_INDEXED,
    projects: [1],
    version: 2,
  });
};

export const getEndpointListQuery = ({domain, action, datetime, transaction}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `SELECT
    description,
    group_id,
    domain,
    action,
    quantile(0.5)(exclusive_time) AS "p50(span.self_time)",
    quantile(0.95)(exclusive_time) AS "p95(span.self_time)",
    sum(exclusive_time) AS "sum(span.self_time)",
    uniq(user) AS "count_unique(user)", uniq(transaction) AS "count_unique(transaction)",
    count() AS count,
    countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) AS failure_count,
    failure_count / count AS failure_rate
    FROM spans_experimental_starfish
    WHERE module = 'http'
    ${domain ? `AND domain = '${domain}'` : ''}
    ${action ? `AND action = '${action}'` : ''}
    ${transaction ? `AND transaction = '${transaction}'` : ''}
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY description, domain, action, group_id
    ORDER BY count DESC
    LIMIT 10
  `;
};

export const getEndpointListEventView = ({domain, action, datetime, transaction}) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: [
      'description',
      'group_id',
      'domain',
      'action',
      'p50(span.self_time)',
      'p95(span.self_time)',
      'sum(span.self_time)',
      'count()',
      'count_unique(user)',
      'count_unique(transaction)',
    ],
    orderby: '-count',
    query: `module:http ${domain ? `domain:${domain}` : ''} ${
      action ? `action:${action}` : ''
    } ${transaction ? `transaction:${transaction}` : ''}`,
    start: datetime.start,
    end: datetime.end,
    range: datetime.period,
    dataset: DiscoverDatasets.SPANS_INDEXED,
    projects: [1],
    version: 2,
  });
};

export const getEndpointDomainsQuery = ({datetime}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `SELECT domain, count(),
    sum(exclusive_time) as "sum(span.self_time)",
    max(exclusive_time) as "p100(span.self_time)",
    quantile(0.99)(exclusive_time) as "p99(span.self_time)",
    quantile(0.95)(exclusive_time) as "p95(span.self_time)",
    quantile(0.50)(exclusive_time) as "p50(span.self_time)"
    FROM spans_experimental_starfish
    WHERE module = 'http'
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY domain
    ORDER BY count() DESC
  `;
};

export const getEndpointDomainsEventView = ({datetime}) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: [
      'domain',
      'count()',
      'sum(span.self_time)',
      'p100(span.self_time)',
      'p99(span.self_time)',
      'p95(span.self_time)',
      'p50(span.self_time)',
    ],
    orderby: '-count',
    query: 'module:http',
    start: datetime.start,
    end: datetime.end,
    range: datetime.period,
    dataset: DiscoverDatasets.SPANS_INDEXED,
    projects: [1],
    version: 2,
  });
};

export const getEndpointGraphQuery = ({datetime}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `SELECT
    toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
    quantile(0.5)(exclusive_time) as "p50(span.self_time)",
    quantile(0.75)(exclusive_time) as "p75(span.self_time)",
    quantile(0.95)(exclusive_time) as "p95(span.self_time)",
    quantile(0.99)(exclusive_time) as "p99(span.self_time)",
    count() as "count()",
    countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as "failure_count()",
    "failure_count()" / "count()" as "failure_rate()"
    FROM spans_experimental_starfish
    WHERE module = 'http'
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY interval
    ORDER BY interval asc
 `;
};

export const getEndpointGraphEventView = ({datetime}) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: [
      'count()',
      'p50(span.self_time)',
      'p75(span.self_time)',
      'p95(span.self_time)',
      'p99(span.self_time)',
    ],
    yAxis: [
      'count()',
      'p50(span.self_time)',
      'p75(span.self_time)',
      'p95(span.self_time)',
      'p99(span.self_time)',
    ],
    query: 'module:http',
    start: datetime.start,
    end: datetime.end,
    range: datetime.period,
    dataset: DiscoverDatasets.SPANS_INDEXED,
    projects: [1],
    version: 2,
  });
};

export const getEndpointDetailSeriesQuery = ({
  description,
  transactionName,
  datetime,
  groupId,
}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `SELECT
     toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
     quantile(0.5)(exclusive_time) as p50,
     quantile(0.95)(exclusive_time) as p95,
     count() as count,
     countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as failure_count,
     failure_count / count as failure_rate
     FROM spans_experimental_starfish
     WHERE module = 'http'
     ${description ? `AND description = '${description}'` : ''}
     ${groupId ? `AND group_id = '${groupId}'` : ''}
     ${transactionName ? `AND transaction = '${transactionName}'` : ''}
     ${
       start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''
     }
     ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
     GROUP BY interval
     ORDER BY interval asc
  `;
};

export const getEndpointDetailTableQuery = ({
  description,
  transactionName,
  datetime,
  groupId,
}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `
    SELECT transaction,
    count(),
    quantile(0.5)(exclusive_time) as "p50(span.self_time)",
    quantile(0.95)(exclusive_time) as "p95(span.self_time)",
    countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as failure_count,
    failure_count / count() as failure_rate,
    sum(exclusive_time) as "sum(span.self_time)",
    count(DISTINCT transaction_id) as "count_unique(transaction)"
    FROM spans_experimental_starfish
    WHERE module = 'http'
    ${description ? `AND description = '${description}'` : ''}
    ${groupId ? `AND group_id = '${groupId}'` : ''}
    ${transactionName ? `AND transaction = '${transactionName}'` : ''}
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY transaction
    ORDER BY count() DESC
    LIMIT 5
 `;
};

export const getEndpointDetailTableEventView = ({
  description,
  transactionName,
  datetime,
  groupId,
}) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: [
      'transaction',
      'count()',
      'p50(span.self_time)',
      'p95(span.self_time)',
      'sum(span.self_time)',
      'count_unique(transaction)',
    ],
    orderby: '-count',
    query: `module:http ${description ? `description:${description}` : ''} ${
      transactionName ? `transaction:${transactionName}` : ''
    } ${groupId ? `group_id:${groupId}` : ''}`,
    start: datetime.start,
    end: datetime.end,
    range: datetime.period,
    dataset: DiscoverDatasets.SPANS_INDEXED,
    projects: [1],
    version: 2,
  });
};

export const getSpanInTransactionQuery = ({groupId, datetime}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  // TODO - add back `module = <moudle> to filter data
  return `
    SELECT count() AS count, quantile(0.5)(exclusive_time) as p50, span_operation
    FROM spans_experimental_starfish
    WHERE group_id = '${groupId}'
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY span_operation
 `;
};

export const getSpanFacetBreakdownQuery = ({groupId, datetime}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  // TODO - add back `module = <moudle> to filter data
  return `
    SELECT transaction, user, domain
    FROM spans_experimental_starfish
    WHERE group_id = '${groupId}'
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
 `;
};

export const getHostStatusBreakdownQuery = ({domain, datetime}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `
    SELECT count() as count, status
    FROM spans_experimental_starfish
    WHERE module = 'http'
    AND domain = '${domain}'
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY status
    ORDER BY count DESC
  `;
};

export const getHostStatusBreakdownEventView = ({domain, datetime}) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: ['status', 'count()'],
    orderby: '-count',
    query: `module:http domain:${domain}`,
    start: datetime.start,
    end: datetime.end,
    range: datetime.period,
    dataset: DiscoverDatasets.SPANS_INDEXED,
    projects: [1],
    version: 2,
  });
};

export const getEndpointAggregatesQuery = ({datetime, transaction}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `
    SELECT
    description,
    toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
    count() AS count,
    quantile(0.5)(exclusive_time) as p50
    FROM spans_experimental_starfish
    WHERE module = 'http'
    ${transaction ? `AND transaction = '${transaction}'` : ''}
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY description, interval
    ORDER BY interval asc
  `;
};

const ORDERBY = `
  -power(10, floor(log10(count()))), -quantile(0.75)(exclusive_time)
`;

const getTransactionsFromHostSubquery = (hostNames: string[], dateFilters: string) => {
  const hostFilter = `domain IN ('${hostNames.join(`', '`)}')`;

  return `
  SELECT
    transaction
  FROM default.spans_experimental_starfish
  WHERE
    startsWith(span_operation, 'http')
    AND ${hostFilter}
    ${dateFilters}
  GROUP BY transaction
  ORDER BY ${ORDERBY}
  LIMIT 5
`;
};

type TopTransactionData = {
  interval: string;
  transaction: string;
  epm?: number;
  p75?: number;
};

export const useGetTransactionsForHosts = (
  hostNames: string[],
  interval: string
): DefinedUseQueryResult<TopTransactionData[]> => {
  const pageFilter = usePageFilters();
  const location = useLocation();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);

  const transactionNameQuery = getTransactionsFromHostSubquery(hostNames, dateFilters);

  const {start, end, period} = pageFilter.selection.datetime;

  const {isLoading: isTopTransactionNamesLoading, data: topTransactionNamesData} =
    useQuery<{transaction: string}[]>({
      enabled: !!hostNames?.length,
      queryKey: ['topTransactionNames', hostNames.join(','), start, end],
      queryFn: () =>
        fetch(`${HOST}/?query=${transactionNameQuery}`).then(res => res.json()),
      retry: false,
      refetchOnWindowFocus: false,
      initialData: [],
    });

  const query: NewQuery = {
    id: undefined,
    name: '',
    query: `transaction:[${topTransactionNamesData
      ?.map(d => `"${d.transaction}"`)
      .join(',')}]`,
    projects: [1],
    fields: ['transaction', 'epm()', 'p75(transaction.duration)'],
    version: 1,
    topEvents: '5',
    start: start?.toString(),
    end: end?.toString(),
    dataset: DiscoverDatasets.METRICS_ENHANCED,
    interval,
    yAxis: ['epm()', 'p75(transaction.duration)'],
  };

  const eventView = EventView.fromNewQueryWithLocation(query, location);
  eventView.statsPeriod = period ?? undefined;

  const {
    isLoading: isTopTransactionSeriesLoading,
    data: topTransactionSeriesData,
    ...rest
  } = useWrappedDiscoverTimeseriesQuery({
    eventView,
    initialData: [],
    enabled: !isTopTransactionNamesLoading && !!topTransactionNamesData.length,
  });

  return {
    ...rest,
    isLoading: isTopTransactionSeriesLoading,
    data: topTransactionSeriesData,
  } as DefinedUseQueryResult<TopTransactionData[]>;
};
