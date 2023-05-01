import {Moment} from 'moment';

const DEFAULT_WHERE = `
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
    ${DEFAULT_WHERE} and
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
    ${DEFAULT_WHERE} and
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

const getNewColumn = (
  duration: number,
  startTime: {unix: () => number},
  endTime: {unix: () => number}
) =>
  duration > SEVEN_DAYS
    ? `(
        greater(min(start_timestamp), fromUnixTimestamp(${
          startTime.unix() + duration / 10
        })) and
        greater(max(start_timestamp), fromUnixTimestamp(${
          endTime.unix() - duration / 10
        }))
      ) as newish`
    : '0 as newish';
const getRetiredColumn = (
  duration: number,
  startTime: {unix: () => number},
  endTime: {unix: () => number}
) =>
  duration > SEVEN_DAYS
    ? `(
        less(max(start_timestamp), fromUnixTimestamp(${
          endTime.unix() - duration / 10
        })) and
        less(min(start_timestamp), fromUnixTimestamp(${startTime.unix() + duration / 10}))
      ) as retired`
    : '0 as retired';

export const getOperations = (date_filters: string) => {
  return `
  select
    action as key,
    uniq(description) as value
  from default.spans_experimental_starfish
  where
    ${DEFAULT_WHERE} and
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
    ${DEFAULT_WHERE} and
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
    ${DEFAULT_WHERE} and
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
    ${DEFAULT_WHERE} and
    ${date_filters} and
    domain in (${getDomainSubquery(date_filters, action)})
    ${getActionQuery(action)}
  group by interval, domain
  order by interval, domain
  `;
};

export const getPanelTableQuery = (
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
  },
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
      ${DEFAULT_WHERE} and
      ${date_filters} and
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
  },
  interval: number
) => {
  return `
    SELECT
      toStartOfInterval(start_timestamp, INTERVAL ${interval} HOUR) as interval,
      quantile(0.75)(exclusive_time) as p75,
      count() as count
    FROM spans_experimental_starfish
    WHERE
      ${DEFAULT_WHERE} and
      ${date_filters} and
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
      ${DEFAULT_WHERE} and
      ${date_filters} and
      group_id = '${row.group_id}'
    GROUP BY transaction
    ORDER BY ${ORDERBY}
   `;
};

export const getMainTable = (
  startTime: Moment,
  date_filters: string,
  endTime: Moment,
  transactionFilter: string | null,
  tableFilter?: string,
  actionFilter?: string,
  newFilter?: string,
  oldFilter?: string
) => {
  const filters = [
    DEFAULT_WHERE,
    date_filters,
    transactionFilter,
    tableFilter,
    actionFilter,
  ].filter(fil => !!fil);
  const duration = endTime.unix() - startTime.unix();
  const newColumn = getNewColumn(duration, startTime, endTime);
  const retiredColumn = getRetiredColumn(duration, startTime, endTime);
  const havingFilters = [newFilter, oldFilter].filter(fil => !!fil);

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
      ${filters.join(' and ')}
    group by
      action,
      description,
      group_id,
      domain,
      data_keys,
      data_values
    ${havingFilters.length > 0 ? 'having' : ''}
      ${havingFilters.join(' and ')}
    order by ${ORDERBY}
    limit 100
  `;
};
