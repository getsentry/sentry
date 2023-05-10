import {Moment, unix} from 'moment';

import {EventTransaction} from 'sentry/types';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
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

const getDomainSubquery = (date_filters: string, action: string) => {
  return `
  select domain
  from default.spans_experimental_starfish
  where
    ${DEFAULT_WHERE}
    ${date_filters} and
    domain != ''
    ${getActionQuery(action)}
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

const getActionQuery = (action: string) =>
  action !== 'ALL' ? `and action = '${action}'` : '';

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

export const useQueryDbOperations = (): DefinedUseQueryResult<
  {key: string; value: string}[]
> => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const query = `
  select
    action as key,
    uniq(description) as value
  from default.spans_experimental_starfish
  where
    ${DEFAULT_WHERE}
    ${dateFilters}
  group by action
  order by ${ORDERBY}
  `;
  return useQuery({
    queryKey: ['operation', pageFilter.selection.datetime],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
};

export const useQueryDbTables = (
  action: string
): DefinedUseQueryResult<{key: string; value: string}[]> => {
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
    ${getActionQuery(action)}
  group by domain
  order by ${ORDERBY}
  `;
  return useQuery({
    queryKey: ['table', action, pageFilter.selection.datetime],
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

export const useGetTransactionsForTables = (tableNames: string[], interval: number) => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const transactionFilter = `transaction IN (${getTransactionsFromTableSubquery(
    tableNames,
    dateFilters
  )})`;

  const filters = [transactionFilter];

  const query = `
    SELECT
      transaction,
      floor(quantile(0.75)(exclusive_time), 5) as p75,
      count() as count,
      toStartOfInterval(start_timestamp, INTERVAL ${interval} hour) as interval
    FROM default.spans_experimental_starfish
    WHERE
      ${filters.join(' AND ')}
      ${dateFilters}
    GROUP BY interval, transaction
    ORDER BY interval
  `;

  const {start, end} = pageFilter.selection.datetime;

  return useQuery({
    enabled: !!tableNames?.length,
    queryKey: ['topTable', tableNames.join(','), start, end],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
};

type TopTableQuery = {
  count: number;
  domain: string;
  interval: string;
  p75: number;
}[];

export const useQueryTopTablesChart = (
  action: string,
  interval: number
): DefinedUseQueryResult<TopTableQuery> => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const query = `
  select
    floor(quantile(0.75)(exclusive_time), 5) as p75,
    domain,
    count() as count,
    toStartOfInterval(start_timestamp, INTERVAL ${interval} hour) as interval
  from default.spans_experimental_starfish
  where
    ${DEFAULT_WHERE}
    ${dateFilters} and
    domain in (${getDomainSubquery(dateFilters, action)})
    ${getActionQuery(action)}
  group by interval, domain
  order by interval, domain
  `;

  const result1 = useQuery<TopTableQuery>({
    queryKey: ['topTable', action, pageFilter.selection.datetime],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const tables = [...new Set(result1.data.map(d => d.domain))];

  const query2 = `
  select
  floor(quantile(0.75)(exclusive_time), 5) as p75,
  count() as count,
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
    queryKey: ['topTableOther', action, pageFilter.selection.datetime],
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
  sortDirection: string | undefined
): DefinedUseQueryResult<
  Pick<TransactionListDataRow, 'transaction' | 'count' | 'p75'>[]
> => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const orderBy = getOrderByFromKey(sortKey, sortDirection) ?? ORDERBY;
  const query = `
    SELECT
      transaction,
      count() AS count,
      quantile(0.75)(exclusive_time) as p75
    FROM spans_experimental_starfish
    WHERE
      ${DEFAULT_WHERE}
      ${dateFilters} AND
      group_id = '${row.group_id}'
    GROUP BY transaction
    ORDER BY ${orderBy}
    LIMIT 10
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

export const useQueryPanelGraph = (row: DataRow, interval: number) => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const query = `
    SELECT
      toStartOfInterval(start_timestamp, INTERVAL ${interval} HOUR) as interval,
      quantile(0.75)(exclusive_time) as p75,
      count() as count
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

  const filters = [
    DEFAULT_WHERE,
    transactionFilter,
    tableFilter,
    actionFilter,
    newFilter,
    oldFilter,
  ].filter(fil => !!fil);
  const duration = endTime.unix() - startTime.unix();
  const newColumn = getNewColumn(duration, startTime, endTime);
  const retiredColumn = getRetiredColumn(duration, startTime, endTime);
  const havingFilters = [newFilter, oldFilter].filter(fil => !!fil);
  const orderBy = getOrderByFromKey(sortKey, sortDirection) ?? ORDERBY;

  const query = `
  select
    description,
    group_id, count() as count,
    (divide(count, ${(endTime.unix() - startTime.unix()) / 60}) AS epm),
    quantile(0.75)(exclusive_time) as p75,
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
  limit ${limit ?? 100}
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
  transactionNames: string[]
): UseSpansQueryReturnType<QueryTransactionByTPMAndP75ReturnType> => {
  const {
    selection: {datetime},
  } = usePageFilters();
  return useWrappedDiscoverTimeseriesQuery(
    EventView.fromSavedQuery({
      name: '',
      fields: ['transaction', 'count()', 'p75(transaction.duration)'],
      yAxis: ['count()', 'p75(transaction.duration)'],
      orderby: '-count',
      query: `transaction:["${transactionNames.join('","')}"]`,
      topEvents: '5',
      start: datetime.start as string,
      end: datetime.end as string,
      range: datetime.period as string,
      dataset: DiscoverDatasets.METRICS,
      projects: [1],
      version: 2,
    }),
    []
  );
};

export const useQueryGetProfileIds = (
  transactionNames: string[],
  spanHash: string
): DefinedUseQueryResult<{transaction_id: string}[]> => {
  const location = useLocation();
  const {slug: orgSlug} = useOrganization();
  const eventView = EventView.fromNewQueryWithLocation(
    {
      fields: ['transaction'],
      name: 'Db module - profile',
      query: `transaction:[${transactionNames.join(',')}] has:profile.id`,
      projects: [1],
      version: 1,
    },
    location
  );
  const discoverResult = useDiscoverQuery({eventView, location, orgSlug});

  const transactionIds = discoverResult?.data?.data?.map(d => d.id);

  const query = `
    SELECT
      transaction_id
    FROM
      default.spans_experimental_starfish
    WHERE
      group_id = '${spanHash}' AND
      transaction_id IN ('${transactionIds?.join(`','`)}')
  `;

  return useQuery({
    enabled: !!transactionIds?.length,
    queryKey: ['transactionsWithProfiles', transactionIds?.join(',')],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
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
