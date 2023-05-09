export const getModuleBreakdown = ({transaction}) => {
  return `SELECT
  sum(exclusive_time) as sum, module
  FROM spans_experimental_starfish
  WHERE module != 'none'
  ${transaction ? `AND transaction = '${transaction}'` : ''}
  GROUP BY module
  ORDER BY -sum
 `;
};

export const getTopHttpDomains = ({transaction}) => {
  return `SELECT
 quantile(0.75)(exclusive_time) as p75, domain,
 toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval
 FROM default.spans_experimental_starfish
 WHERE domain IN (
  SELECT domain
   FROM spans_experimental_starfish
   WHERE startsWith(span_operation, 'http')
   ${transaction ? `AND transaction = '${transaction}'` : ''}
   GROUP BY domain
   ORDER BY -sum(exclusive_time)
   LIMIT 2
 ) AND startsWith(span_operation, 'http')
 ${transaction ? `AND transaction = '${transaction}'` : ''}
 GROUP BY interval, domain
 ORDER BY interval, domain
 `;
};

export const getOtherDomains = ({transaction}) => {
  return `SELECT
  quantile(0.75)(exclusive_time) as p75,
  toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval
  FROM default.spans_experimental_starfish
  WHERE domain NOT IN (
   SELECT domain
    FROM spans_experimental_starfish
    WHERE startsWith(span_operation, 'http')
    ${transaction ? `AND transaction = '${transaction}'` : ''}
    GROUP BY domain
    ORDER BY -sum(exclusive_time)
    LIMIT 2
  ) AND startsWith(span_operation, 'http')
  ${transaction ? `AND transaction = '${transaction}'` : ''}
  GROUP BY interval
  ORDER BY interval
  `;
};

export const getDatabaseTimeSpent = ({transaction}) => {
  return `SELECT
  quantile(0.75)(exclusive_time) as p75,
  toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval
  FROM default.spans_experimental_starfish
  WHERE startsWith(span_operation, 'db') and span_operation != 'db.redis'
  ${transaction ? `AND transaction = '${transaction}'` : ''}
  GROUP BY interval
  ORDER BY interval
  `;
};

export const getDbThroughput = ({transaction}) => {
  return `SELECT
  count() as count,
  toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval
  FROM default.spans_experimental_starfish
  WHERE module = 'db'
  ${transaction ? `AND transaction = '${transaction}'` : ''}
  GROUP BY interval
  ORDER BY interval
  `;
};

export const getHttpThroughput = ({transaction}) => {
  return `SELECT
  count() as count,
  toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval
  FROM default.spans_experimental_starfish
  WHERE module = 'http'
  ${transaction ? `AND transaction = '${transaction}'` : ''}
  GROUP BY interval
  ORDER BY interval
 `;
};

export const FAILURE_RATE_QUERY = `SELECT
 toStartOfInterval(start_timestamp, INTERVAL 5 MINUTE) as interval,
 countIf(greaterOrEquals(status, 200) AND less(status, 300)) as successCount,
 countIf(greaterOrEquals(status, 500)) as failureCount,
 divide(failureCount, plus(successCount, failureCount)) as failureRate
 FROM spans_experimental_starfish
 WHERE module = 'http'
 GROUP BY interval
 ORDER BY interval asc
`;

export const getTopSpansInModule = module => `SELECT
  description,
  sum(exclusive_time) as cumulative_time,
  module
  FROM spans_experimental_starfish
  WHERE module = '${module}'
  GROUP BY description, module
  ORDER BY -cumulative_time
  LIMIT 5
`;

export const getSpanDurationSeries = spans => `SELECT
  quantile(0.75)(exclusive_time) as p75,
  count() as count,
  toStartOfInterval(start_timestamp, INTERVAL 1 HOUR) as interval,
  description
  FROM spans_experimental_starfish
  WHERE description IN ('http://127.0.0.1:10006/discover/snql', 'http://127.0.0.1:10006/events/snql', 'http://127.0.0.1:10006/transactions/snql', 'http://127.0.0.1:10006/search_issues/snql', 'http://127.0.0.1:10007/api/v1/evaluation/batch')
  GROUP BY interval, description
  ORDER BY interval
`;
