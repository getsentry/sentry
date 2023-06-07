import {useQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {Span} from 'sentry/views/starfish/queries/types';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {getDateQueryFilter} from 'sentry/views/starfish/utils/getDateQueryFilter';

type Transaction = {
  count: number;
  transaction: string;
};

export const useSpanTransactions = (span?: Span, referrer = 'span-transactions') => {
  const pageFilters = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilters);
  const dateFilters = getDateQueryFilter(startTime, endTime);

  const query = span
    ? `
  SELECT
    transaction,
    count() AS count
  FROM spans_experimental_starfish
  WHERE
    group_id = '${span.group_id}'
    ${dateFilters}
  GROUP BY transaction
  ORDER BY -power(10, floor(log10(count()))), -quantile(0.75)(exclusive_time)
  LIMIT 5
`
    : '';

  const {isLoading, error, data} = useQuery<Transaction[]>({
    queryKey: ['span-transactions', span?.group_id],
    queryFn: () =>
      fetch(`${HOST}/?query=${query}&referrer=${referrer}`).then(res => res.json()),
    retry: false,
    initialData: [],
    enabled: Boolean(span),
  });

  return {isLoading, error, data};
};
