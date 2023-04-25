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
    SELECT description, transaction_id, span_id, exclusive_time, count() as count
    FROM spans_experimental_starfish
    WHERE group_id = '${groupId}'
    AND transaction = '${transactionName}'
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY description, transaction_id, span_id, exclusive_time
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
