import {DateTimeObject} from 'sentry/components/charts/utils';
import {datetimeToClickhouseFilterTimestamps} from 'sentry/views/starfish/utils/dates';

export const getSpanSamplesQuery = ({
  groupId,
  transactionName,
  datetime,
}: {
  groupId;
  transactionName;
  datetime?: DateTimeObject;
}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `
    SELECT description, transaction_id, span_id, exclusive_time, count() as count, domain
    FROM spans_experimental_starfish
    WHERE group_id = '${groupId}'
    ${transactionName ? `AND transaction = '${transactionName}'` : ''}
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY description, transaction_id, span_id, exclusive_time, domain
    ORDER BY exclusive_time desc
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
    SELECT transaction,
    count() AS count,
    quantile(0.5)(exclusive_time) as p50,
    quantile(0.95)(exclusive_time) as p95,
    countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as failure_count,
    failure_count / count() as failure_rate,
    sum(exclusive_time) as total_exclusive_time,
    count(DISTINCT transaction_id) as count_unique_transaction_id
    FROM spans_experimental_starfish
     WHERE module = '${module}'
    ${description ? `AND description = '${description}'` : ''}
    ${groupId ? `AND group_id = '${groupId}'` : ''}
    ${transactionName ? `AND transaction = '${transactionName}'` : ''}
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY transaction
    ORDER BY count DESC
    LIMIT 5
 `;
};
