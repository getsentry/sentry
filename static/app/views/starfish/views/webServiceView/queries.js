import {datetimeToClickhouseFilterTimestamps} from 'sentry/views/starfish/utils/dates';

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

export const getTopModules = ({transaction, datetime}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `SELECT module as "span.module", sum(exclusive_time) as "sum(span.duration)"
   FROM spans_experimental_starfish
   WHERE ${transaction ? `transaction = '${transaction}' AND` : ''}
   ${start_timestamp ? `greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
   ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
   GROUP BY span.module
   ORDER BY "sum(span.duration)" desc
   LIMIT 5
 `;
};

export const getTopModulesTimeseries = ({transaction, topConditions, datetime}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `SELECT
 quantile(0.95)(exclusive_time) as "p95(span.duration)", module as "span.module",
 toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval
 FROM default.spans_experimental_starfish
 WHERE greaterOrEquals(start_timestamp, '${start_timestamp}')
 ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
 ${topConditions ? `AND (${topConditions})` : ''}
 ${transaction ? `AND transaction = '${transaction}'` : ''}
 GROUP BY interval, span.module
 ORDER BY interval, span.module
 `;
};

export const getOtherModulesTimeseries = ({transaction, topConditions, datetime}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `SELECT
 quantile(0.95)(exclusive_time) as "p95(span.duration)",
 toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval
 FROM default.spans_experimental_starfish
 WHERE greaterOrEquals(start_timestamp, '${start_timestamp}')
 ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
 ${topConditions ? `AND NOT (${topConditions})` : ''}
 ${transaction ? `AND transaction = '${transaction}'` : ''}
 GROUP BY interval
 ORDER BY interval
 `;
};

export const spanThroughput = ({transaction}) => {
  return `SELECT
  count() as count,
  toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval
  FROM default.spans_experimental_starfish
  ${transaction ? `WHERE transaction = '${transaction}'` : ''}
  GROUP BY interval
  ORDER BY interval
  `;
};

export const totalCumulativeTime = ({transaction, datetime}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `SELECT sum(exclusive_time) as "sum(span.duration)"
   FROM spans_experimental_starfish
   WHERE greaterOrEquals(start_timestamp, '${start_timestamp}')
   ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
   ${transaction ? `AND transaction = '${transaction}'` : ''}
 `;
};

export const getTopDomainsAndMethods = ({transaction}) => {
  return `SELECT domain, action
   FROM spans_experimental_starfish
   WHERE span_operation = 'http.client'
   ${transaction ? `AND transaction = '${transaction}'` : ''}
   GROUP BY domain, action
   ORDER BY -sum(exclusive_time)
   LIMIT 5
 `;
};

export const getTopHttpDomains = ({transaction}) => {
  return `SELECT
 quantile(0.95)(exclusive_time) as "p95(span.duration)", domain,
 toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval
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
  quantile(0.95)(exclusive_time) as "p95(span.duration)",
  toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval
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
  quantile(0.95)(exclusive_time) as "p95(span.duration)",
  toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval
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
  toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval
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
  toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval
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
