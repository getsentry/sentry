import {useQuery} from 'sentry/utils/queryClient';
import {HOST} from 'sentry/views/starfish/utils/constants';
import type {Span} from 'sentry/views/starfish/views/spans/spanSummaryPanel/types';

type Transaction = {
  count: number;
  transaction: string;
};

export const useSpanTransactions = (span?: Span, referrer = 'span-transactions') => {
  const query = span ? getQuery(span) : '';

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

const getQuery = (span: Span) => {
  return `
    SELECT
      transaction,
      count() AS count
    FROM spans_experimental_starfish
    WHERE
      group_id = '${span.group_id}'
    GROUP BY transaction
    ORDER BY -power(10, floor(log10(count()))), -quantile(0.75)(exclusive_time)
    LIMIT 5
`;
};
