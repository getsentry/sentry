import keyBy from 'lodash/keyBy';
import moment from 'moment';

import {useQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {getDateQueryFilter} from 'sentry/views/starfish/utils/getDateQueryFilter';

export type SpanTransactionMetrics = {
  'p50(span.duration)': number;
  'p95(span.duration)': number;
  'spm()': number;
  'sum(span.self_time)': number;
  'time_spent_percentage()': number;
  transaction: string;
};

export const useSpanTransactionMetrics = (
  span?: Pick<IndexedSpan, 'group'>,
  transactions?: string[],
  referrer = 'span-transaction-metrics'
) => {
  const pageFilters = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilters);
  const dateFilters = getDateQueryFilter(startTime, endTime);

  const query =
    span && transactions && transactions.length > 0
      ? `
    SELECT
      transaction,
      quantile(0.5)(exclusive_time) as "p50(span.duration)",
      quantile(0.5)(exclusive_time) as "p95(span.duration)",
      sum(exclusive_time) as "sum(span.duration)",
      divide(count(), ${
        moment(endTime ?? undefined).unix() - moment(startTime).unix()
      }) as "spm()"
    FROM spans_experimental_starfish
    WHERE group_id = '${span.group}'
    ${dateFilters}
    AND transaction IN ('${transactions.join("','")}')
    GROUP BY transaction
 `
      : '';

  const {isLoading, error, data} = useQuery<SpanTransactionMetrics[]>({
    queryKey: [
      'span-transactions-metrics',
      span?.group,
      transactions?.join(',') || '',
      dateFilters,
    ],
    queryFn: () =>
      fetch(`${HOST}/?query=${query}&referrer=${referrer}`).then(res => res.json()),
    retry: false,
    initialData: [],
    enabled: Boolean(query),
  });

  const parsedData = keyBy(data, 'transaction');

  return {isLoading, error, data: parsedData};
};
