export const ENDPOINT_LIST_QUERY = `SELECT description, count() AS count, domain
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
    count() as count
    FROM spans_experimental_starfish
    WHERE module = 'http'
    AND description = '${description}'
    GROUP BY interval
    ORDER BY interval asc
 `;
};

export const getEndpointDetailQuery = description => {
  return `
    SELECT transaction, count() AS count, quantile(0.5)(exclusive_time) as p50
    FROM spans_experimental_starfish
    WHERE module = 'http'
    AND description = '${description}'
    GROUP BY transaction
    ORDER BY count DESC
    LIMIT 10
 `;
};
