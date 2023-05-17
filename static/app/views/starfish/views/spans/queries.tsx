import moment from 'moment';

import {DateTimeObject} from 'sentry/components/charts/utils';
import {datetimeToClickhouseFilterTimestamps} from 'sentry/views/starfish/utils/dates';

export const getTimeSpentQuery = (
  descriptionFilter: string | undefined,
  groupingColumn: string,
  conditions: string[] = []
) => {
  const validConditions = conditions.filter(Boolean);

  return `SELECT
    ${groupingColumn} AS primary_group,
    sum(exclusive_time) AS exclusive_time
    FROM spans_experimental_starfish
    WHERE 1 = 1
    ${validConditions.length > 0 ? 'AND' : ''}
    ${validConditions.join(' AND ')}
    ${descriptionFilter ? `AND match(lower(description), '${descriptionFilter}')` : ''}
    GROUP BY primary_group
  `;
};

export const getSpanListQuery = (
  descriptionFilter: string | undefined,
  datetime: DateTimeObject,
  conditions: string[] = [],
  orderBy: string,
  limit: number
) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  const validConditions = conditions.filter(Boolean);

  return `SELECT
    group_id, span_operation, description, domain,
    sum(exclusive_time) as total_exclusive_time,
    uniq(transaction) as transactions,
    quantile(0.95)(exclusive_time) as p95,
    quantile(0.75)(exclusive_time) as p75,
    quantile(0.50)(exclusive_time) as p50,
    count() as count,
    (divide(count, ${
      (moment(end_timestamp ?? undefined).unix() - moment(start_timestamp).unix()) / 60
    }) AS epm)
    FROM spans_experimental_starfish
    WHERE greaterOrEquals(start_timestamp, '${start_timestamp}')
    ${validConditions.length > 0 ? 'AND' : ''}
    ${validConditions.join(' AND ')}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    ${descriptionFilter ? `AND match(lower(description), '${descriptionFilter}')` : ''}
    GROUP BY group_id, span_operation, domain, description
    ORDER BY ${orderBy ?? 'count'} desc
    ${limit ? `LIMIT ${limit}` : ''}`;
};

export const getSpansTrendsQuery = (
  descriptionFilter: string | undefined,
  datetime: DateTimeObject,
  groupIDs: string[]
) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);

  return `
    SELECT
    group_id, span_operation,
    toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval,
    quantile(0.50)(exclusive_time) as percentile_value
    FROM spans_experimental_starfish
    WHERE greaterOrEquals(start_timestamp, '${start_timestamp}')
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    AND group_id IN (${groupIDs.map(id => `'${id}'`).join(',')})
    ${descriptionFilter ? `AND match(lower(description), '${descriptionFilter}')` : ''}
    GROUP BY group_id, span_operation, interval
    ORDER BY interval asc
  `;
};
