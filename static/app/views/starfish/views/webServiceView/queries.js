export const TOP_DOMAINS = `SELECT
 quantile(0.75)(exclusive_time) as p75, domain,
 toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval
 FROM default.spans_experimental_starfish
 WHERE domain IN (
  SELECT domain
   FROM spans_experimental_starfish
   WHERE startsWith(span_operation, 'http')
   GROUP BY domain
   ORDER BY -sum(exclusive_time)
   LIMIT 2
 ) AND startsWith(span_operation, 'http')
 GROUP BY interval, domain
 ORDER BY interval, domain
 `;

export const OTHER_DOMAINS = `SELECT
 quantile(0.75)(exclusive_time) as p75,
 toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval
 FROM default.spans_experimental_starfish
 WHERE domain NOT IN (
  SELECT domain
   FROM spans_experimental_starfish
   WHERE startsWith(span_operation, 'http')
   GROUP BY domain
   ORDER BY -sum(exclusive_time)
   LIMIT 2
 ) AND startsWith(span_operation, 'http')
 GROUP BY interval
 ORDER BY interval
 `;

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
