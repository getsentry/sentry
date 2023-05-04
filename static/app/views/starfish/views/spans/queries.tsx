import {DateTimeObject} from 'sentry/components/charts/utils';
import {datetimeToClickhouseFilterTimestamps} from 'sentry/views/starfish/utils/dates';

export const getSpanListQuery = ({
  datetime,
  orderBy,
  limit,
}: {
  datetime: DateTimeObject;
  limit?: number;
  orderBy?: string;
}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `SELECT
    group_id, span_operation, description,
    count() as count,
    count(DISTINCT transaction) as transaction_count,
    count / transaction_count as count_per_transaction,
    sum(exclusive_time) as total_exclusive_time,
    quantile(0.999)(exclusive_time) as p999,
    quantile(0.95)(exclusive_time) as p95,
    quantile(0.50)(exclusive_time) as p50
    FROM spans_experimental_starfish
    WHERE greaterOrEquals(start_timestamp, '${start_timestamp}')
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY group_id, span_operation, description
    ORDER BY ${orderBy ?? 'count'} desc
    ${limit ? `LIMIT ${limit}` : ''}`;
};

export const getSpansTrendsQuery = ({datetime, group_ids}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `
    SELECT
    group_id, span_operation,
    toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
    quantile(0.95)(exclusive_time) as p95
    FROM spans_experimental_starfish
    WHERE greaterOrEquals(start_timestamp, '${start_timestamp}')
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    AND group_id IN (${group_ids.map(id => `'${id}'`).join(',')})
    GROUP BY group_id, span_operation, interval
    ORDER BY interval asc
  `;
};
