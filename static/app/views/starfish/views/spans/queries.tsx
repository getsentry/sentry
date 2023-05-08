import {DateTimeObject} from 'sentry/components/charts/utils';
import {datetimeToClickhouseFilterTimestamps} from 'sentry/views/starfish/utils/dates';

export const getTimeSpentQuery = (groupingColumn: string, conditions: string[] = []) => {
  const validConditions = conditions.filter(Boolean);

  return `SELECT
    ${groupingColumn} AS primary_group,
    sum(exclusive_time) AS exclusive_time
    FROM spans_experimental_starfish
    ${validConditions.length > 0 ? 'WHERE' : ''}
    ${validConditions.join(' AND ')}
    GROUP BY primary_group
  `;
};

export const getSpanListQuery = (
  datetime: DateTimeObject,
  conditions: string[] = [],
  orderBy: string,
  limit: number
) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  const validConditions = conditions.filter(Boolean);

  return `SELECT
    group_id, span_operation, description,
    sum(exclusive_time) as total_exclusive_time,
    quantile(0.95)(exclusive_time) as p95,
    quantile(0.50)(exclusive_time) as p50
    FROM spans_experimental_starfish
    WHERE greaterOrEquals(start_timestamp, '${start_timestamp}')
    ${validConditions.length > 0 ? 'AND' : ''}
    ${validConditions.join(' AND ')}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY group_id, span_operation, description
    ORDER BY ${orderBy ?? 'count'} desc
    ${limit ? `LIMIT ${limit}` : ''}`;
};

export const getSpansTrendsQuery = (datetime: DateTimeObject, groupIDs: string[]) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);

  return `
    SELECT
    group_id, span_operation,
    toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
    quantile(0.95)(exclusive_time) as p95
    FROM spans_experimental_starfish
    WHERE greaterOrEquals(start_timestamp, '${start_timestamp}')
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    AND group_id IN (${groupIDs.map(id => `'${id}'`).join(',')})
    GROUP BY group_id, span_operation, interval
    ORDER BY interval asc
  `;
};
