import {DateTimeObject} from 'sentry/components/charts/utils';
import {DefinedUseQueryResult, useQueries, useQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getEndpointDetailSeriesQuery} from 'sentry/views/starfish/modules/APIModule/queries';
import {getDateQueryFilter} from 'sentry/views/starfish/modules/databaseModule/queries';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {
  datetimeToClickhouseFilterTimestamps,
  getDateFilters,
} from 'sentry/views/starfish/utils/dates';

export enum SamplePopulationType {
  FASTEST = 'fastest',
  MEDIAN = 'median',
  SLOWEST = 'slowest',
}

export const useQueryGetSpanSamples = (options: {
  groupId: string;
  transactionName: string;
  user: string;
  p50?: number;
}) => {
  const {groupId, transactionName, user, p50} = options;

  const pageFilter = usePageFilters();

  const commonQueryOptions = {
    queryKey: [
      groupId,
      transactionName,
      user,
      pageFilter.selection.datetime,
      'spanSamples',
    ],
    retry: false,
    initialData: [],
  };

  const commonSamplesQueryOptions = {
    groupId,
    transactionName,
    user,
    datetime: pageFilter.selection.datetime,
    p50,
  };

  const results = useQueries({
    queries: [
      {
        ...commonQueryOptions,
        queryKey: [...commonQueryOptions.queryKey, 'spanSamplesSlowest'],
        queryFn: () =>
          fetch(
            `${HOST}/?query=${getSpanSamplesQuery({
              ...commonSamplesQueryOptions,
              populationType: SamplePopulationType.SLOWEST,
            })}`
          ).then(res => res.json()),
      },
      {
        ...commonQueryOptions,
        queryKey: [...commonQueryOptions.queryKey, 'spanSamplesMedian'],
        queryFn: () =>
          fetch(
            `${HOST}/?query=${getSpanSamplesQuery({
              ...commonSamplesQueryOptions,
              populationType: SamplePopulationType.MEDIAN,
            })}`
          ).then(res => res.json()),
      },
      {
        ...commonQueryOptions,
        queryKey: [...commonQueryOptions.queryKey, 'spanSamplesFastest'],
        queryFn: () =>
          fetch(
            `${HOST}/?query=${getSpanSamplesQuery({
              ...commonSamplesQueryOptions,
              populationType: SamplePopulationType.FASTEST,
            })}`
          ).then(res => res.json()),
      },
    ],
  });

  return results;
};

export const useQueryGetFacetsBreakdown = (options: {
  groupId: string;
  transactionName: string;
}): DefinedUseQueryResult<{domain: string; user: string}[]> => {
  const {groupId, transactionName} = options;
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);

  const query = `
      SELECT
      user, domain
    FROM spans_experimental_starfish
    WHERE
    group_id = '${groupId}'
    AND transaction = '${transactionName}'
    ${dateFilters}
  `;

  return useQuery({
    queryKey: ['facetBreakdown', groupId, transactionName],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
};

export const useQuerySpansInTransaction = (options: {
  groupId: string;
}): DefinedUseQueryResult<
  {
    action: string;
    count: number;
    description: string;
    formatted_desc: string;
    module: 'http' | 'db' | 'cache' | 'none';
    p50: number;
    span_operation: string;
  }[]
> => {
  const {groupId} = options;
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const dateFilters = getDateQueryFilter(startTime, endTime);

  const query = `
      SELECT
      count() AS count,
      quantile(0.5)(exclusive_time) as p50,
      span_operation,
      action,
      module,
      description
    FROM
      spans_experimental_starfish
    WHERE
    group_id = '${groupId}'
    ${dateFilters}
    GROUP BY
      span_operation,
      description,
      action,
      module
  `;

  return useQuery({
    queryKey: ['spansInTransaction', groupId],
    queryFn: () => fetch(`${HOST}/?query=${query}&format=sql`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
};

export const useQueryGetSpanAggregatesQuery = (options: {
  groupId: string;
  transactionName: string;
  description?: string;
  module?: string;
}): DefinedUseQueryResult<
  {
    count: number;
    count_unique_transaction: number;
    count_unique_transaction_id: number;
    failure_rate: number;
    faiure_count: number;
    first_seen: string;
    last_seen: string;
    p50: number;
    p95: number;
    total_exclusive_time: number;
  }[]
> => {
  const {description, groupId, transactionName, module} = options;
  const pageFilter = usePageFilters();

  const aggregatesQuery = getSidebarAggregatesQuery({
    description,
    transactionName,
    datetime: pageFilter.selection.datetime,
    groupId,
    module,
  });

  return useQuery({
    queryKey: ['span-aggregates', transactionName, groupId, description],
    queryFn: () =>
      fetch(`${HOST}/?query=${aggregatesQuery}&referrer=sidebar-aggregates`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: [],
  });
};

export const useQueryGetSpanSeriesData = (options: {
  groupId: string;
  spanGroupOperation: string;
  transactionName: string;
  description?: string;
  module?: string;
}): DefinedUseQueryResult<
  {
    count: number;
    failure_count: number;
    failure_rate: number;
    interval: string;
    p50: number;
    p95: number;
    spm: number;
  }[]
> => {
  const {description, groupId, spanGroupOperation, transactionName, module} = options;
  const pageFilter = usePageFilters();
  const {getSeriesQuery} = getQueries(spanGroupOperation);

  const aggregatesQuery = getSeriesQuery({
    datetime: pageFilter.selection.datetime,
    groupId,
    module,
    description,
    interval: 12,
    transactionName,
  });

  return useQuery({
    queryKey: [
      'seriesdata',
      transactionName,
      module,
      pageFilter.selection.datetime,
      groupId,
    ],
    queryFn: () =>
      fetch(`${HOST}/?query=${aggregatesQuery}&referrer=sidebar-aggregates`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: [],
  });
};

const getSpanSamplesQuery = ({
  groupId,
  transactionName,
  user,
  populationType,
  datetime,
  p50,
}: {
  groupId;
  transactionName;
  user;
  datetime?: DateTimeObject;
  p50?: number;
  populationType?: SamplePopulationType;
}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);

  return `
    SELECT transaction_id, transaction, description, user, domain, span_id, sum(exclusive_time) as exclusive_time, abs(minus(exclusive_time, ${p50})) as diff
    FROM spans_experimental_starfish
    WHERE group_id = '${groupId}'
    ${transactionName ? `AND transaction = '${transactionName}'` : ''}
    ${user ? `AND user = '${user}'` : ''}
    ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    GROUP BY transaction_id, transaction, description, user, domain, span_id
    ORDER BY ${
      populationType === SamplePopulationType.SLOWEST || !populationType
        ? 'exclusive_time desc'
        : populationType === SamplePopulationType.FASTEST
        ? 'exclusive_time asc'
        : 'diff asc'
    }
    LIMIT 3
 `;
};

// Metrics request to get total count of events for a transaction
export const useQueryGetUniqueTransactionCount = (options: {transactionName: string}) => {
  const {transactionName} = options;
  const {
    selection: {datetime},
  } = usePageFilters();

  const query = `?field=count%28%29&query=transaction%3A${encodeURIComponent(
    transactionName
  )}${
    datetime
      ? datetime.period
        ? `&statsPeriod=${datetime.period}`
        : datetime.start && datetime.end
        ? `&start=${encodeURIComponent(
            (datetime.start as Date).toISOString()
          )}&end=${encodeURIComponent((datetime.end as Date).toISOString())}`
        : null
      : null
  }&dataset=metricsEnhanced&project=1`;

  return useQuery({
    queryKey: ['uniqueTransactionCount', transactionName],
    queryFn: () =>
      fetch(`/api/0/organizations/sentry/events/${query}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
};

export const getSidebarSeriesQuery = ({
  description,
  transactionName,
  datetime,
  groupId,
  module,
  interval,
}) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(datetime);
  return `SELECT
     toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
     quantile(0.5)(exclusive_time) as p50,
     quantile(0.95)(exclusive_time) as p95,
     count() as count,
     divide(count(), multiply(${interval}, 60)) as spm,
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

export function getQueries(spanGroupOperation: string) {
  switch (spanGroupOperation) {
    case 'db':
    case 'cache':
      return {
        getSeriesQuery: getSidebarSeriesQuery,
        getAggregatesQuery: getSidebarAggregatesQuery,
      };
    case 'http.client':
      return {
        getSeriesQuery: getEndpointDetailSeriesQuery,
        getAggregatesQuery: getSidebarAggregatesQuery,
      };
    default:
      return {
        getSeriesQuery: getSidebarSeriesQuery,
        getAggregatesQuery: getSidebarAggregatesQuery,
      };
  }
}
