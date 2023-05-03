import {Moment, unix} from 'moment';

import {useQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DataRow} from 'sentry/views/starfish/modules/databaseModule/databaseTableView';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {
  datetimeToClickhouseFilterTimestamps,
  getDateFilters,
} from 'sentry/views/starfish/utils/dates';

const DEFAULT_WHERE = `
  startsWith(span_operation, 'db') and
  span_operation != 'db.redis' and
  module = 'db' and
  action != ''
`;

const INTERVAL = 12;

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

export const getOperations = (date_filters: string) => {
  return `
  select
    action as key,
    uniq(description) as value
  from default.spans_experimental_starfish
  where
    ${DEFAULT_WHERE}
    ${date_filters}
  group by action
  order by ${ORDERBY}
  `;
};

export const getTables = (date_filters: string, action: string) => {
  return `
  select
    domain as key,
    quantile(0.75)(exclusive_time) as value
  from default.spans_experimental_starfish
  where
    ${DEFAULT_WHERE}
    ${date_filters}
    ${getActionQuery(action)}
  group by domain
  order by ${ORDERBY}
  `;
};

export const getTopOperationsChart = (date_filters: string, interval: number) => {
  return `
  select
    floor(quantile(0.75)(exclusive_time), 5) as p75,
    action,
    count() as count,
    toStartOfInterval(start_timestamp, INTERVAL ${interval} hour) as interval
  from default.spans_experimental_starfish
  where
    ${DEFAULT_WHERE}
    ${date_filters} and
    action in (${getActionSubquery(date_filters)})
  group by action, interval
  order by action, interval
  `;
};

export const getTopTablesChart = (
  date_filters: string,
  action: string,
  interval: number
) => {
  return `
  select
    floor(quantile(0.75)(exclusive_time), 5) as p75,
    domain,
    count() as count,
    toStartOfInterval(start_timestamp, INTERVAL ${interval} hour) as interval
  from default.spans_experimental_starfish
  where
    ${DEFAULT_WHERE}
    ${date_filters} and
    domain in (${getDomainSubquery(date_filters, action)})
    ${getActionQuery(action)}
  group by interval, domain
  order by interval, domain
  `;
};

export const getPanelTableQuery = (
  startTime: Moment,
  endTime: Moment,
  row: DataRow,
  sortKey: string | undefined,
  sortDirection: string | undefined
) => {
  const orderBy = getOrderByFromKey(sortKey, sortDirection) ?? ORDERBY;
  return `
    SELECT
      transaction,
      count() AS count,
      quantile(0.75)(exclusive_time) as p75
    FROM spans_experimental_starfish
    WHERE
      ${DEFAULT_WHERE}
      ${getDateQueryFilter(startTime, endTime)} AND
      group_id = '${row.group_id}'
    GROUP BY transaction
    ORDER BY ${orderBy}
    LIMIT 10
  `;
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

export const getPanelGraphQuery = (
  startTime: Moment,
  endTime: Moment,
  row: {
    group_id: string;
    action?: string;
    count?: number;
    data_keys?: string[];
    data_values?: string[];
    description?: string;
    domain?: string;
    epm?: number;
    firstSeen?: string;
    formatted_desc?: string;
    lastSeen?: string;
    newish?: number;
    p75?: number;
    retired?: number;
    total_time?: number;
    transactions?: number;
  },
  interval: number
) => {
  const dateFilters = getDateQueryFilter(startTime, endTime);
  return `
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
};

export const getPanelEventCount = (
  date_filters: string,
  row: {
    group_id: string;
    action?: string;
    count?: number;
    data_keys?: string[];
    data_values?: string[];
    description?: string;
    domain?: string;
    epm?: number;
    firstSeen?: string;
    formatted_desc?: string;
    lastSeen?: string;
    newish?: number;
    p75?: number;
    retired?: number;
    total_time?: number;
    transactions?: number;
  }
) => {
  return `
    SELECT
      transaction,
      count(DISTINCT transaction_id) as uniqueEvents
    FROM spans_experimental_starfish
    WHERE
      ${DEFAULT_WHERE}
      ${date_filters} AND
      group_id = '${row.group_id}'
    GROUP BY transaction
    ORDER BY ${ORDERBY}
   `;
};

export const getMainTable = (
  startTime: Moment,
  endTime: Moment,
  transactionFilter: string | null,
  tableFilter?: string,
  actionFilter?: string,
  sortKey?: string,
  sortDirection?: string,
  newFilter?: string,
  oldFilter?: string
) => {
  const filters = [DEFAULT_WHERE, transactionFilter, tableFilter, actionFilter].filter(
    fil => !!fil
  );
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const duration = endTime.unix() - startTime.unix();
  const newColumn = getNewColumn(duration, startTime, endTime);
  const retiredColumn = getRetiredColumn(duration, startTime, endTime);
  const havingFilters = [newFilter, oldFilter].filter(fil => !!fil);

  const orderBy = getOrderByFromKey(sortKey, sortDirection) ?? ORDERBY;

  return `
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
    limit 100
  `;
};

export const useQueryTransactionByTPM = (row: DataRow) => {
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const queryFilter = `group_id = '${row.group_id}'`;

  const query = `
  select
    count() as count,
    transaction,
    toStartOfInterval(start_timestamp, INTERVAL ${INTERVAL} hour) as interval
  FROM default.spans_experimental_starfish
  where
    ${DEFAULT_WHERE}
    ${dateFilters} and
    ${queryFilter}
    and transaction IN (
      SELECT
        transaction
      FROM default.spans_experimental_starfish
      WHERE ${queryFilter}
      GROUP BY transaction
      ORDER BY count() desc
      LIMIT 5
    )
  group by transaction, interval
  order by transaction, interval
  `;

  return useQuery({
    queryKey: ['p75PerTransaction', pageFilter.selection.datetime, row.group_id],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
};

const getDateQueryFilter = (startTime: Moment, endTime: Moment) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps({
    start: startTime.format('YYYY-MM-DD HH:mm:ss'),
    end: endTime.format('YYYY-MM-DD HH:mm:ss'),
  });
  return `
  ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
  ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
  `;
};
