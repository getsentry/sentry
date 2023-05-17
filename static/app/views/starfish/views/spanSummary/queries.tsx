import {DateTimeObject} from 'sentry/components/charts/utils';
import {datetimeToClickhouseFilterTimestamps} from 'sentry/views/starfish/utils/dates';

export const getSpanSamplesQuery = ({
  groupId,
  transactionName,
  user,
  sortBy,
  datetime,
  p50,
}: {
  groupId;
  transactionName;
  user;
  datetime?: DateTimeObject;
  p50?: number;
  sortBy?: string;
}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);

  if (sortBy === 'median_samples') {
    return `
      SELECT transaction_id, transaction, description, user, domain, span_id, sum(exclusive_time) as exclusive_time, abs(minus(exclusive_time, ${p50})) as diff
        FROM spans_experimental_starfish
        WHERE group_id = '${groupId}'
        ${transactionName ? `AND transaction = '${transactionName}'` : ''}
        ${user ? `AND user = '${user}'` : ''}
        ${
          start_timestamp
            ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')`
            : ''
        }
        ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
        GROUP BY transaction_id, transaction, description, user, domain, span_id
        HAVING lessOrEquals(divide(diff, ${p50}), 0.05)
        ORDER BY diff desc
        LIMIT 10
    `;
  }

  return `
    SELECT transaction_id, transaction, description, user, domain, span_id, sum(exclusive_time) as exclusive_time
    FROM spans_experimental_starfish
    WHERE group_id = '${groupId}'
    ${transactionName ? `AND transaction = '${transactionName}'` : ''}
    ${user ? `AND user = '${user}'` : ''}
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY transaction_id, transaction, description, user, domain, span_id
    ORDER BY exclusive_time ${sortBy === 'slowest_samples' || !sortBy ? 'desc' : 'asc'}
    LIMIT 10
 `;
};

// Metrics request to get total count of events for a transaction
export const getUniqueTransactionCountQuery = ({transactionName, datetime}) => {
  return `?field=count%28%29&query=transaction%3A${encodeURIComponent(transactionName)}${
    datetime
      ? datetime.period
        ? `&statsPeriod=${datetime.period}`
        : datetime.start && datetime.end
        ? `&start=${encodeURIComponent(
            datetime.start.toISOString()
          )}&end=${encodeURIComponent(datetime.end.toISOString())}`
        : null
      : null
  }&dataset=metricsEnhanced&project=1`;
};

export const getSidebarSeriesQuery = ({
  description,
  transactionName,
  datetime,
  groupId,
  module,
}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `SELECT
     toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
     quantile(0.5)(exclusive_time) as p50,
     quantile(0.95)(exclusive_time) as p95,
     count() as count,
     countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as failure_count,
     failure_count / count as failure_rate
     FROM spans_experimental_starfish
     WHERE module = '${module}'
     ${description ? `AND description = '${description}'` : ''}
     ${groupId ? `AND group_id = '${groupId}'` : ''}
     ${transactionName ? `AND transaction = '${transactionName}'` : ''}
     ${
       start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''
     }
     ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
     GROUP BY interval
     ORDER BY interval asc
  `;
};

export const getSidebarAggregatesQuery = ({
  description,
  transactionName,
  datetime,
  groupId,
  module,
}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `
    SELECT
    count() AS count,
    quantile(0.5)(exclusive_time) as p50,
    quantile(0.95)(exclusive_time) as p95,
    countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as failure_count,
    failure_count / count() as failure_rate,
    sum(exclusive_time) as total_exclusive_time,
    count(DISTINCT transaction_id) as count_unique_transaction_id,
    count(DISTINCT transaction) as count_unique_transaction,
    min(timestamp) as first_seen,
    max(timestamp) as last_seen
    FROM spans_experimental_starfish
    WHERE 1 == 1
    ${module ? `AND module = '${module}'` : ''}
    ${description ? `AND description = '${description}'` : ''}
    ${groupId ? `AND group_id = '${groupId}'` : ''}
    ${transactionName ? `AND transaction = '${transactionName}'` : ''}
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    ORDER BY count DESC
    LIMIT 5
 `;
};

export function getOverallAggregatesQuery(datetime) {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);

  return `
    SELECT
    count(DISTINCT transaction) AS count_overall_unique_transactions,
    sum(exclusive_time) AS overall_total_exclusive_time
    FROM spans_experimental_starfish
    WHERE 1 == 1
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
  `;
}
