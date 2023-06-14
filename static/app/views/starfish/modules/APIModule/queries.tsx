import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {datetimeToClickhouseFilterTimestamps} from 'sentry/views/starfish/utils/dates';

export const getEndpointListEventView = ({domain, action, datetime, transaction}) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: [
      'description',
      'group_id',
      'domain',
      'action',
      'p50(span.self_time)',
      'p95(span.self_time)',
      'sum(span.self_time)',
      'count()',
      'count_unique(user)',
      'count_unique(transaction)',
    ],
    orderby: '-count',
    query: `module:http ${domain ? `domain:${domain}` : ''} ${
      action ? `action:${action}` : ''
    } ${transaction ? `transaction:${transaction}` : ''}`,
    start: datetime.start,
    end: datetime.end,
    range: datetime.period,
    dataset: DiscoverDatasets.SPANS_INDEXED,
    projects: [1],
    version: 2,
  });
};

export const getEndpointDomainsEventView = ({datetime}) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: [
      'domain',
      'count()',
      'sum(span.self_time)',
      'p100(span.self_time)',
      'p99(span.self_time)',
      'p95(span.self_time)',
      'p50(span.self_time)',
    ],
    orderby: '-count',
    query: 'module:http',
    start: datetime.start,
    end: datetime.end,
    range: datetime.period,
    dataset: DiscoverDatasets.SPANS_INDEXED,
    projects: [1],
    version: 2,
  });
};

export const getEndpointDetailSeriesQuery = ({
  description,
  transactionName,
  datetime,
  groupId,
}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  const interval = 12;
  return `SELECT
     toStartOfInterval(start_timestamp, INTERVAL ${interval} HOUR) as interval,
     quantile(0.5)(exclusive_time) as p50,
     quantile(0.95)(exclusive_time) as p95,
     divide(count(), multiply(${interval}, 60)) as spm,
     count() as count,
     countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as failure_count,
     failure_count / count as failure_rate
     FROM spans_experimental_starfish
     WHERE module = 'http'
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

export const getEndpointDetailTableEventView = ({
  description,
  transactionName,
  datetime,
  groupId,
}) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: [
      'transaction',
      'count()',
      'p50(span.self_time)',
      'p95(span.self_time)',
      'sum(span.self_time)',
      'count_unique(transaction)',
    ],
    orderby: '-count',
    query: `module:http ${description ? `description:${description}` : ''} ${
      transactionName ? `transaction:${transactionName}` : ''
    } ${groupId ? `group_id:${groupId}` : ''}`,
    start: datetime.start,
    end: datetime.end,
    range: datetime.period,
    dataset: DiscoverDatasets.SPANS_INDEXED,
    projects: [1],
    version: 2,
  });
};

export const getHostStatusBreakdownEventView = ({domain, datetime}) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: ['status', 'count()'],
    orderby: '-count',
    query: `module:http domain:${domain}`,
    start: datetime.start,
    end: datetime.end,
    range: datetime.period,
    dataset: DiscoverDatasets.SPANS_INDEXED,
    projects: [1],
    version: 2,
  });
};

export const getEndpointAggregatesQuery = ({datetime, transaction}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `
    SELECT
    description,
    toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
    count() AS count,
    quantile(0.5)(exclusive_time) as p50,
    quantile(0.95)(exclusive_time) as p95
    FROM spans_experimental_starfish
    WHERE module = 'http'
    ${transaction ? `AND transaction = '${transaction}'` : ''}
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY description, interval
    ORDER BY interval asc
  `;
};
