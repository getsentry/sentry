import keyBy from 'lodash/keyBy';

import {useQuery} from 'sentry/utils/queryClient';
import {HOST} from 'sentry/views/starfish/utils/constants';
import type {Span} from 'sentry/views/starfish/views/spans/spanSummaryPanel/types';

const INTERVAL = 12;

type Metric = {
  p50: number;
  spm: number;
};

export const useSpanTransactionMetrics = (
  span?: Span,
  transactions?: string[],
  referrer = 'span-transaction-metrics'
) => {
  const query =
    span && transactions && transactions.length > 0 ? getQuery(span, transactions) : '';

  const {isLoading, error, data} = useQuery<Metric[]>({
    queryKey: [
      'span-transactions-metrics',
      span?.group_id,
      transactions?.join(',') || '',
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

const getQuery = (span: Span, transactions: string[]) => {
  return `
    SELECT
      transaction,
      quantile(0.5)(exclusive_time) as p50,
      divide(count(), multiply(${INTERVAL}, 60)) as spm
    FROM spans_experimental_starfish
    WHERE group_id = '${span.group_id}'
    AND transaction IN ('${transactions.join("','")}')
    GROUP BY transaction
 `;
};
