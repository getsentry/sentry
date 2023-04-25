import moment from 'moment';

import {DateTimeObject} from 'sentry/components/charts/utils';
import {DATE_FORMAT, PERIOD_REGEX} from 'sentry/views/starfish/modules/APIModule/queries';

export const getSpanSamplesQuery = ({
  groupId,
  transactionName,
  datetime,
}: {
  spanDescription;
  transactionName;
  datetime?: DateTimeObject;
}) => {
  const [_, num, unit] = datetime?.period?.match(PERIOD_REGEX) ?? [];
  const start_timestamp =
    (datetime?.start && moment(datetime?.start).format(DATE_FORMAT)) ??
    (num &&
      unit &&
      moment()
        .subtract(num, unit as 'h' | 'd')
        .format(DATE_FORMAT));
  const end_timestamp = datetime?.end && moment(datetime?.end).format(DATE_FORMAT);
  return `
    SELECT description, transaction_id, span_id, exclusive_time, count() as count
    FROM spans_experimental_starfish
    WHERE group_id = '${groupId}'
    AND transaction = '${transactionName}'
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY transaction_id, span_id, exclusive_time
    ORDER BY exclusive_time desc
    LIMIT 10
 `;
};

// Metrics request to get total count of events for a transaction
export const getUniqueTransactionCountQuery = transactionName => {
  return `?field=count%28%29&query=transaction%3A${encodeURIComponent(
    transactionName
  )}&statsPeriod=14d&dataset=metricsEnhanced&project=1`;
};
