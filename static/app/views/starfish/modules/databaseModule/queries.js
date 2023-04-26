const DEFAULT_WHERE = `
  startsWith(span_operation, 'db') and
  span_operation != 'db.redis' and
  module = 'db' and
  action != ''
`;

const ORDERBY = `
  -power(10, floor(log10(count()))), -quantile(0.75)(exclusive_time)
`;

const getActionSubquery = date_filters => {
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

const getDomainSubquery = (date_filters, action) => {
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

const getActionQuery = action => (action !== 'ALL' ? `and action = '${action}'` : '');

export const getOperations = date_filters => {
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

export const getTables = (date_filters, action) => {
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

export const getTopOperationsChart = (date_filters, interval) => {
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

export const getTopTablesChart = (date_filters, action, interval) => {
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

export const getPanelTableQuery = (date_filters, row) => {
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
    ORDER BY count DESC
    LIMIT 10
  `;
};

export const getPanelGraphQuery = (date_filters, row, interval) => {
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

export const getPanelEventCount = (date_filters, row) => {
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
   `;
};

export const getMainTable = (
  date_filters,
  transactionFilter,
  tableFilter,
  actionFilter,
  startTime,
  endTime
) => {
  const filters = [
    DEFAULT_WHERE,
    date_filters,
    transactionFilter,
    tableFilter,
    actionFilter,
  ].filter(fil => !!fil);

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
      data_values
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
    order by ${ORDERBY}
    limit 100
  `;
};
