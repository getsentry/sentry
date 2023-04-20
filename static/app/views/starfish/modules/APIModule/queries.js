export const ENDPOINT_LIST_QUERY = `SELECT
 description,
 domain,
 quantile(0.5)(exclusive_time) AS "p50(exclusive_time)",
 quantile(0.95)(exclusive_time) AS "p95(exclusive_time)",
 uniq(user) as user_count, uniq(transaction) as transaction_count,
 count() as count,
 countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as failure_count
 FROM spans_experimental_starfish
 WHERE module = 'http'
 GROUP BY description, domain
 ORDER BY count DESC
 LIMIT 10
`;

export const ENDPOINT_GRAPH_QUERY = `SELECT
 toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
 quantile(0.5)(exclusive_time) as p50,
 quantile(0.75)(exclusive_time) as p75,
 quantile(0.95)(exclusive_time) as p95,
 quantile(0.99)(exclusive_time) as p99
 FROM spans_experimental_starfish
 WHERE module = 'http'
 GROUP BY interval
 ORDER BY interval asc
 `;

export const getEndpointDetailSeriesQuery = description => {
  return `SELECT
     toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
     quantile(0.5)(exclusive_time) as p50,
     quantile(0.95)(exclusive_time) as p95,
     count() as count,
     countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as failure_count
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
  return `
    SELECT count() AS count, quantile(0.5)(exclusive_time) as p50
    FROM spans_experimental_starfish
    WHERE module = 'http'
    AND description = '${spanDescription}'
    AND transaction = '${transactionName}'
 `;
};
