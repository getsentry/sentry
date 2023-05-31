import keyBy from 'lodash/keyBy';

import {useQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {Span} from 'sentry/views/starfish/queries/types';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {getDateQueryFilter} from 'sentry/views/starfish/utils/getDateQueryFilter';

const INTERVAL = 12;

type Metric = {
  p50: number;
  spm: number;
  total_time: number;
};

export const useSpanTransactionMetrics = (
  span?: Pick<Span, 'group_id'>,
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
      quantile(0.5)(exclusive_time) as p50,
      sum(exclusive_time) as "sum(span.self_time)",
      sum(exclusive_time) as total_time,
      divide(count(), multiply(${INTERVAL}, 60)) as spm
    FROM spans_experimental_starfish
    WHERE group_id = '${span.group_id}'
    ${dateFilters}
    AND transaction IN ('${transactions.join("','")}')
    GROUP BY transaction
 `
      : '';

  const {isLoading, error, data} = useQuery<Metric[]>({
    queryKey: [
      'span-transactions-metrics',
      span?.group_id,
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
