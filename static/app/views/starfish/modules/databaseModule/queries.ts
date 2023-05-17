import {Moment, unix} from 'moment';

import {EventTransaction, NewQuery} from 'sentry/types';
import {
  DiscoverQueryComponentProps,
  DiscoverQueryPropsWithThresholds,
  useDiscoverQuery,
} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useGenericDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {DefinedUseQueryResult, useQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DataRow} from 'sentry/views/starfish/modules/databaseModule/databaseTableView';
import {TransactionListDataRow} from 'sentry/views/starfish/modules/databaseModule/panel';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {
  datetimeToClickhouseFilterTimestamps,
  getDateFilters,
} from 'sentry/views/starfish/utils/dates';
import {
  UseSpansQueryReturnType,
  useWrappedDiscoverTimeseriesQuery,
} from 'sentry/views/starfish/utils/useSpansQuery';

export const DEFAULT_WHERE = `
  startsWith(span_operation, 'db') and
  span_operation != 'db.redis' and
  module = 'db' and
  action != ''
`;

const SPM =
  'if(duration > 0, divide(count(), (max(start_timestamp) - min(start_timestamp) as duration)/60), 0)';

const ORDERBY = `
  -power(10, floor(log10(count()))), -quantile(0.75)(exclusive_time)
`;

const getActionSubquery = (date_filters: string) => {
  return `
  select action
  from default.spans_experimental_starfish
  where
    ${DEFAULT_WHERE}
    ${date_filters}
  group by action
  order by ${ORDERBY}
  limit 5
  `;
};

const getDomainSubquery = (date_filters: string) => {
  return `
  select domain
  from default.spans_experimental_starfish
  where
    ${DEFAULT_WHERE}
    ${date_filters} and
    domain != ''
   group by domain
   order by ${ORDERBY}
   limit 5
  `;
};

const getTransactionsFromTableSubquery = (tableNames: string[], dateFilters: string) => {
  const tableFilter = `domain IN ('${tableNames.join(`', '`)}')`;

  const filters = [DEFAULT_WHERE, tableFilter];
  return `
  SELECT
    transaction
  FROM default.spans_experimental_starfish
  WHERE
    ${filters.join(' AND ')}
    ${dateFilters}
  GROUP BY transaction
  ORDER BY ${ORDERBY}
  LIMIT 5
`;
};

const SEVEN_DAYS = 7 * 24 * 60 * 60;

const getNewColumn = (duration: number, startTime: Moment, endTime: Moment) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps({
    start: unix(startTime.unix() + duration / 10).format('YYYY-MM-DD HH:mm:ss'),
    end: unix(endTime.unix() - duration / 10).format('YYYY-MM-DD HH:mm:ss'),
  });

  return duration > SEVEN_DAYS
    ? `(
        greater(min(start_timestamp), '${start_timestamp}') and
        greater(max(start_timestamp), '${end_timestamp}')
      ) as newish`
    : '0 as newish';
};

const getRetiredColumn = (duration: number, startTime: Moment, endTime: Moment) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps({
    start: unix(startTime.unix() + duration / 10).format('YYYY-MM-DD HH:mm:ss'),
    end: unix(endTime.unix() - duration / 10).format('YYYY-MM-DD HH:mm:ss'),
  });
  return duration > SEVEN_DAYS
    ? `(
        less(max(start_timestamp), '${end_timestamp}') and
        less(min(start_timestamp), '${start_timestamp}')
      ) as retired`
    : '0 as retired';
};

export const useQueryDbTables = (): DefinedUseQueryResult<
  {key: string; value: string}[]
> => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const query = `
  select
    domain as key,
    quantile(0.75)(exclusive_time) as value
  from default.spans_experimental_starfish
  where
    ${DEFAULT_WHERE}
    ${dateFilters}
  group by domain
  order by ${ORDERBY}
  `;
  return useQuery({
    queryKey: ['table', pageFilter.selection.datetime],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
};

export const useQueryTopDbOperationsChart = (
  interval: number
): DefinedUseQueryResult<
  {action: string; count: number; interval: string; p75: number}[]
> => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const query = `
  select
    floor(quantile(0.75)(exclusive_time), 5) as p75,
    action,
    count() as count,
    toStartOfInterval(start_timestamp, INTERVAL ${interval} hour) as interval
  from default.spans_experimental_starfish
  where
    ${DEFAULT_WHERE}
    ${dateFilters} and
    action in (${getActionSubquery(dateFilters)})
  group by action, interval
  order by action, interval
  `;
  return useQuery({
    queryKey: ['topGraph', pageFilter.selection.datetime],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
};

type TopTransactionData = {
  interval: string;
  transaction: string;
  epm?: number;
  p75?: number;
};

export const useGetTransactionsForTables = (
  tableNames: string[],
  interval: number
): DefinedUseQueryResult<TopTransactionData[]> => {
  const pageFilter = usePageFilters();
  const location = useLocation();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);

  const transactionNameQuery = getTransactionsFromTableSubquery(tableNames, dateFilters);

  const {start, end, period} = pageFilter.selection.datetime;

  const result1 = useQuery<{transaction: string}[]>({
    enabled: !!tableNames?.length,
    queryKey: ['topTransactionNames', tableNames.join(','), start, end],
    queryFn: () =>
      fetch(`${HOST}/?query=${transactionNameQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const query: NewQuery = {
    id: undefined,
    name: 'Db module - epm/p75 for top transactions',
    query: `transaction:[${result1.data?.map(d => d.transaction).join(',')}]`,
    projects: [1],
    fields: ['transaction', 'epm()', 'p75(transaction.duration)'],
    version: 1,
    topEvents: '5',
    start: start?.toString(),
    end: end?.toString(),
    dataset: DiscoverDatasets.METRICS_ENHANCED,
    interval: `${interval}h`,
    yAxis: ['epm()', 'p75(transaction.duration)'],
  };

  const eventView = EventView.fromNewQueryWithLocation(query, location);
  eventView.statsPeriod = period ?? undefined;

  const result2 = useDiscoverEventsStatsQuery({
    eventView,
    referrer: 'api.starfish.database.charts',
    location,
    orgSlug: 'sentry',
    queryExtras: {
      interval: `${interval}h`, // This interval isn't being propogated from eventView
      yAxis: ['epm()', 'p75(transaction.duration)'], // workaround - eventView actually doesn't support multiple yAxis
      excludeOther: '1',
      topEvents: '5',
      per_page: undefined,
    },
  });

  const data: TopTransactionData[] = [];
  if (!result2.isLoading && result2.data) {
    Object.entries(result2.data).forEach(([transactionName, result]: [string, any]) => {
      result['epm()'].data.forEach(entry => {
        data.push({
          transaction: transactionName,
          interval: unix(entry[0]).format('YYYY-MM-DDTHH:mm:ss'),
          epm: entry[1][0].count,
        });
      });
      result['p75(transaction.duration)'].data.forEach(entry => {
        data.push({
          transaction: transactionName,
          interval: unix(entry[0]).format('YYYY-MM-DDTHH:mm:ss'),
          p75: entry[1][0].count,
        });
      });
    });
  }

  return {...result2, data} as DefinedUseQueryResult<TopTransactionData[]>;
};

type TopTableQuery = {
  count: number;
  domain: string;
  interval: string;
  p75: number;
}[];

export const useQueryTopTablesChart = (
  interval: number
): DefinedUseQueryResult<TopTableQuery> => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const query = `
  select
    floor(quantile(0.75)(exclusive_time), 5) as p75,
    domain,
    divide(count(), multiply(${interval}, 60)) as count,
    toStartOfInterval(start_timestamp, INTERVAL ${interval} hour) as interval
  from default.spans_experimental_starfish
  where
    ${DEFAULT_WHERE}
    ${dateFilters} and
    domain in (${getDomainSubquery(dateFilters)})
  group by interval, domain
  order by interval, domain
  `;

  const result1 = useQuery<TopTableQuery>({
    queryKey: ['topTable', pageFilter.selection.datetime],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const tables = [...new Set(result1.data.map(d => d.domain))];

  const query2 = `
  select
  floor(quantile(0.75)(exclusive_time), 5) as p75,
  divide(count(), multiply(${interval}, 60)) as count,
  toStartOfInterval(start_timestamp, INTERVAL ${interval} hour) as interval
  from default.spans_experimental_starfish
  where
    domain not in ('${tables.join(`', '`)}')
    AND ${DEFAULT_WHERE}
    ${dateFilters}
  group by interval
  order by interval
  `;

  const result2 = useQuery<TopTableQuery>({
    enabled: !result1.isLoading && !!result1.data?.length,
    queryKey: ['topTableOther', pageFilter.selection.datetime],
    queryFn: () => fetch(`${HOST}/?query=${query2}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
  result2.data.forEach(d => (d.domain = 'other'));
  const joinedData = [...result1.data, ...result2.data];

  return {...result2, data: joinedData};
};

export const useQueryPanelTable = (
  row: DataRow,
  sortKey: string | undefined,
  sortDirection: string | undefined,
  transaction: string | undefined
): DefinedUseQueryResult<
  Pick<TransactionListDataRow, 'transaction' | 'count' | 'p75'>[]
> => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const orderBy = getOrderByFromKey(sortKey, sortDirection) ?? ORDERBY;
  const transactionFilter = transaction ? `and transaction='${transaction}'` : '';
  const query = `
    SELECT
      transaction,
      count() AS count,
      quantile(0.75)(exclusive_time) as p75,
      any(transaction_id) as example
    FROM spans_experimental_starfish
    WHERE
      ${DEFAULT_WHERE}
      ${dateFilters} AND
      group_id = '${row.group_id}'
      ${transactionFilter}
    GROUP BY transaction
    ORDER BY ${orderBy}
    LIMIT 5
  `;
  return useQuery({
    queryKey: [
      'dbQueryDetailsTable',
      row.group_id,
      pageFilter.selection.datetime,
      sortKey,
      sortDirection,
    ],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: true,
    initialData: [],
  });
};

export const useQueryExampleTransaction = (
  row: DataRow
): DefinedUseQueryResult<{first: string; latest: string}[]> => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const query = `
    SELECT
      minIf(transaction_id, equals(timestamp, '${row.lastSeen}')) as latest,
      minIf(transaction_id, equals(timestamp, '${row.firstSeen}')) as first
    FROM spans_experimental_starfish
    WHERE
      ${DEFAULT_WHERE}
      ${dateFilters} AND
      group_id = '${row.group_id}'
    HAVING latest > 0 and first > 0
    LIMIT 10
  `;
  return useQuery({
    queryKey: ['getExampleTransaction', row.group_id],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: true,
    initialData: [],
  });
};

export const useQueryPanelSparklines = (
  row: DataRow,
  sortKey: string | undefined,
  sortDirection: string | undefined,
  interval: number,
  transaction: string | undefined
): DefinedUseQueryResult<{interval: string; spm: number; transaction: string}[]> => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const orderBy = getOrderByFromKey(sortKey, sortDirection) ?? ORDERBY;
  const transactionFilter = transaction ? `and transaction='${transaction}'` : '';
  const query = `
    SELECT
      transaction,
      toStartOfInterval(start_timestamp, INTERVAL ${interval} hour) as interval,
      quantile(0.50)(exclusive_time) AS p50,
      divide(count(), multiply(${interval}, 60)) as spm
    FROM spans_experimental_starfish
    WHERE
      transaction in (
        SELECT
          transaction
        FROM spans_experimental_starfish
        WHERE
          ${DEFAULT_WHERE}
          ${dateFilters} AND
          group_id = '${row.group_id}'
          ${transactionFilter}
        GROUP BY transaction
        ORDER BY ${orderBy}
        LIMIT 5
      ) and
      ${DEFAULT_WHERE}
      ${dateFilters} AND
      group_id = '${row.group_id}'
    GROUP BY transaction, interval
    ORDER BY transaction, interval, ${orderBy}
  `;
  return useQuery({
    queryKey: [
      'dbQueryDetailsSparklines',
      row.group_id,
      pageFilter.selection.datetime,
      sortKey,
      sortDirection,
    ],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: true,
    initialData: [],
  });
};

export const useQueryPanelGraph = (row: DataRow, interval: number) => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const query = `
    SELECT
      toStartOfInterval(start_timestamp, INTERVAL ${interval} HOUR) as interval,
      quantile(0.95)(exclusive_time) as p95,
      quantile(0.50)(exclusive_time) as p50,
      divide(count(), multiply(${interval}, 60)) as count
    FROM spans_experimental_starfish
    WHERE
      ${DEFAULT_WHERE}
      ${dateFilters} AND
      group_id = '${row.group_id}'
    GROUP BY interval
    ORDER BY interval
  `;
  return useQuery({
    queryKey: ['dbQueryDetailsGraph', row.group_id, pageFilter.selection.datetime],
    queryFn: () => fetch(`${HOST}/?query=${query}&format=sql`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
};

export const useQueryPanelEventCount = (
  row: DataRow
): DefinedUseQueryResult<Pick<TransactionListDataRow, 'uniqueEvents' | 'count'>[]> => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const query = `
    SELECT
      transaction,
      count(DISTINCT transaction_id) as uniqueEvents
    FROM spans_experimental_starfish
    WHERE
      ${DEFAULT_WHERE}
      ${dateFilters} AND
      group_id = '${row.group_id}'
    GROUP BY transaction
    ORDER BY ${ORDERBY}
   `;
  return useQuery({
    queryKey: ['dbQueryDetailsEventCount', row.group_id, pageFilter.selection.datetime],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: true,
    initialData: [],
  });
};

export const useQueryMainTable = (options: {
  action?: string;
  filterNew?: boolean;
  filterOld?: boolean;
  limit?: number;
  sortDirection?: string;
  sortKey?: string;
  table?: string;
  transaction?: string;
}): DefinedUseQueryResult<DataRow[]> => {
  const {
    action,
    filterNew,
    filterOld,
    sortDirection,
    sortKey,
    table,
    transaction,
    limit,
  } = options;
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const transactionFilter = transaction ? `transaction='${transaction}'` : null;
  const tableFilter = table && table !== 'ALL' ? `domain = '${table}'` : undefined;
  const actionFilter = action && action !== 'ALL' ? `action = '${action}'` : undefined;
  const newFilter: string | undefined = filterNew ? 'newish = 1' : undefined;
  const oldFilter: string | undefined = filterOld ? 'retired = 1' : undefined;

  const filters = [DEFAULT_WHERE, transactionFilter, tableFilter, actionFilter].filter(
    fil => !!fil
  );
  const duration = endTime.unix() - startTime.unix();
  const newColumn = getNewColumn(duration, startTime, endTime);
  const retiredColumn = getRetiredColumn(duration, startTime, endTime);
  const havingFilters = [newFilter, oldFilter].filter(fil => !!fil);
  const orderBy = getOrderByFromKey(sortKey, sortDirection) ?? ORDERBY;

  const query = `
  select
    description,
    group_id, count() as count,
    ${SPM} as epm,
    quantile(0.75)(exclusive_time) as p75,
    quantile(0.50)(exclusive_time) as p50,
    quantile(0.95)(exclusive_time) as p95,
    uniq(transaction) as transactions,
    sum(exclusive_time) as total_time,
    domain,
    action,
    data_keys,
    data_values,
    min(start_timestamp) as firstSeen,
    max(start_timestamp) as lastSeen,
    ${newColumn},
    ${retiredColumn}
  from default.spans_experimental_starfish
  where
    ${filters.join(' AND ')}
    ${dateFilters}
  group by
    action,
    description,
    group_id,
    domain,
    data_keys,
    data_values
  ${havingFilters.length > 0 ? 'having' : ''}
    ${havingFilters.join(' and ')}
  order by ${orderBy}
  limit ${limit ?? 50}
`;

  return useQuery<DataRow[]>({
    queryKey: [
      'endpoints',
      transaction,
      table,
      pageFilter.selection.datetime,
      sortKey,
      sortDirection,
      newFilter,
      oldFilter,
    ],
    cacheTime: 10000,
    queryFn: () => fetch(`${HOST}/?query=${query}&format=sql`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
};

type QueryTransactionByTPMAndP75ReturnType = {
  count: number;
  interval: string;
  p75: number;
  transaction: string;
}[];
export const useQueryTransactionByTPMAndP75 = (
  transactionNames: string[],
  interval: number
): UseSpansQueryReturnType<QueryTransactionByTPMAndP75ReturnType> => {
  const {
    selection: {datetime},
  } = usePageFilters();
  return useWrappedDiscoverTimeseriesQuery({
    eventView: EventView.fromSavedQuery({
      name: '',
      fields: ['transaction', 'epm()', 'p50(transaction.duration)'],
      yAxis: ['epm()', 'p50(transaction.duration)'],
      orderby: '-count',
      query: `transaction:["${transactionNames.join('","')}"]`,
      topEvents: '5',
      start: datetime.start as string,
      end: datetime.end as string,
      range: datetime.period as string,
      dataset: DiscoverDatasets.METRICS,
      interval: `${interval}h`,
      projects: [1],
      version: 2,
    }),
    initialData: [],
  });
};

export const useQueryGetProfileIds = (transactionNames: string[]) => {
  const location = useLocation();
  const {slug: orgSlug} = useOrganization();
  const eventView = EventView.fromNewQueryWithLocation(
    {
      fields: ['transaction'],
      name: 'Db module - profile',
      query: `transaction:[${transactionNames.join(',')}] has:profile.id`,
      projects: [1],
      version: 1,
      orderby: 'id',
    },
    location
  );
  return useDiscoverQuery({eventView, location, orgSlug, queryExtras: {per_page: '10'}});
};

export const useQueryGetEvent = (
  transactionEventId?: string
): DefinedUseQueryResult<EventTransaction> => {
  const path = `/api/0/projects/sentry/sentry/events/${transactionEventId?.replaceAll(
    '-',
    ''
  )}/`;
  return useQuery({
    enabled: !!transactionEventId,
    queryKey: ['event', transactionEventId],
    queryFn: () => fetch(path).then(res => res.json()),
    retry: false,
    initialData: {},
  });
};

const getOrderByFromKey = (
  sortKey: string | undefined,
  sortDirection: string | undefined
) => {
  if (!sortDirection || !sortKey) {
    return undefined;
  }
  sortDirection ??= '';
  return `${sortKey} ${sortDirection}`;
};

export const getDateQueryFilter = (startTime: Moment, endTime: Moment) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps({
    start: startTime.format('YYYY-MM-DD HH:mm:ss'),
    end: endTime.format('YYYY-MM-DD HH:mm:ss'),
  });
  return `
  ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
  ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
  `;
};

const shouldRefetchData = (
  prevProps: DiscoverQueryPropsWithThresholds,
  nextProps: DiscoverQueryPropsWithThresholds
) => {
  return (
    prevProps.transactionName !== nextProps.transactionName ||
    prevProps.transactionThreshold !== nextProps.transactionThreshold ||
    prevProps.transactionThresholdMetric !== nextProps.transactionThresholdMetric
  );
};

// We should find a way to use this in discover
export function useDiscoverEventsStatsQuery(
  props: Omit<DiscoverQueryComponentProps, 'children'>
) {
  const afterFetch = (data, _) => {
    const {fields, ...otherMeta} = data.meta ?? {};
    return {
      ...data,
      meta: {...fields, ...otherMeta},
    };
  };

  return useGenericDiscoverQuery({
    route: 'events-stats',
    shouldRefetchData,
    afterFetch,
    ...props,
  });
}

export const getDbAggregatesQuery = ({datetime, transaction}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `
    SELECT
    description,
    toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
    divide(count(), multiply(12, 60)) as count,
    quantile(0.50)(exclusive_time) as p50,
    quantile(0.95)(exclusive_time) as p95
    FROM spans_experimental_starfish
    WHERE module = 'db'
    ${transaction ? `AND transaction = '${transaction}'` : ''}
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY description, interval
    ORDER BY interval asc
  `;
};
