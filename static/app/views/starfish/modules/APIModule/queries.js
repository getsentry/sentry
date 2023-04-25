export const PERIOD_REGEX = /^(\d+)([h,d])$/;
const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export const getHostListQuery = () => {
  return `SELECT
    domain,
    toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
    quantile(0.99)(exclusive_time) as p50
    FROM spans_experimental_starfish
    WHERE module = 'http'
    AND domain != ''
    GROUP BY domain, interval
    ORDER BY domain, interval asc
 `;
};

export const getEndpointListQuery = ({domain, action, datetime}) => {
  const [_, num, unit] = datetime.period?.match(PERIOD_REGEX) ?? [];
  const start_timestamp =
    (datetime.start && moment(datetime.start).format(DATE_FORMAT)) ??
    (num && unit && moment().subtract(num, unit).format(DATE_FORMAT));
  const end_timestamp = datetime.end && moment(datetime.end).format(DATE_FORMAT);
  return `SELECT
    description,
    domain,
    action,
    quantile(0.5)(exclusive_time) AS "p50(exclusive_time)",
    quantile(0.95)(exclusive_time) AS "p95(exclusive_time)",
    sum(exclusive_time) as total_exclusive_time,
    uniq(user) as user_count, uniq(transaction) as transaction_count,
    count() as count,
    countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as failure_count,
    failure_count / count as failure_rate
    FROM spans_experimental_starfish
    WHERE module = 'http'
    ${domain ? `AND domain = '${domain}'` : ''}
    ${action ? `AND action = '${action}'` : ''}
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY description, domain, action
    ORDER BY count DESC
    LIMIT 10
  `;
};

export const getEndpointDomainsQuery = () => {
  return `SELECT domain, count() as count
    FROM spans_experimental_starfish
    WHERE module = 'http'
    GROUP BY domain
    ORDER BY count DESC
  `;
};

export const getEndpointGraphQuery = ({datetime}) => {
  const [_, num, unit] = datetime.period?.match(PERIOD_REGEX) ?? [];
  const start_timestamp =
    (datetime.start && moment(datetime.start).format(DATE_FORMAT)) ??
    (num && unit && moment().subtract(num, unit).format(DATE_FORMAT));
  const end_timestamp = datetime.end && moment(datetime.end).format(DATE_FORMAT);
  return `SELECT
    toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
    quantile(0.5)(exclusive_time) as p50,
    quantile(0.75)(exclusive_time) as p75,
    quantile(0.95)(exclusive_time) as p95,
    quantile(0.99)(exclusive_time) as p99,
    count() as count,
    countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as failure_count,
    failure_count / count as failure_rate
    FROM spans_experimental_starfish
    WHERE module = 'http'
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY interval
    ORDER BY interval asc
 `;
};

export const getEndpointDetailSeriesQuery = description => {
  return `SELECT
     toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
     quantile(0.5)(exclusive_time) as p50,
     quantile(0.95)(exclusive_time) as p95,
     count() as count,
     countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as failure_count,
     failure_count / count as failure_rate
     FROM spans_experimental_starfish
     WHERE module = 'http'
     AND description = '${description}'
     GROUP BY interval
     ORDER BY interval asc
  `;
};

export const getEndpointDetailTableQuery = description => {
  return `
    SELECT transaction, count() AS count,
    quantile(0.5)(exclusive_time) as p50,
    quantile(0.95)(exclusive_time) as p95,
    countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as failure_count,
    failure_count / count() as failure_rate
    FROM spans_experimental_starfish
    WHERE module = 'http'
    AND description = '${description}'
    GROUP BY transaction
    ORDER BY count DESC
    LIMIT 5
 `;
};

export const getSpanInTransactionQuery = (spanDescription, transactionName) => {
  // TODO - add back `module = <moudle> to filter data
  return `
    SELECT count() AS count, quantile(0.5)(exclusive_time) as p50, span_operation
    FROM spans_experimental_starfish
    WHERE description = '${spanDescription}'
    AND transaction = '${transactionName}'
 `;
};
