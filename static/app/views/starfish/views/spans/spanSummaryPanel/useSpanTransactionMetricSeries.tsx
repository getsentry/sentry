import groupBy from 'lodash/groupBy';
import keyBy from 'lodash/keyBy';
import moment from 'moment';

import {Series} from 'sentry/types/echarts';
import {useQuery} from 'sentry/utils/queryClient';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import type {Span} from 'sentry/views/starfish/views/spans/spanSummaryPanel/types';

const INTERVAL = 12;

type Metric = {
  count: number;
  interval: string;
  p50: number;
  p95: number;
};

export const useSpanTransactionMetricSeries = (
  span?: Span,
  transactions?: string[],
  referrer: string = 'span-transaction-metrics-series'
) => {
  const query =
    span && transactions && transactions.length > 0 ? getQuery(span, transactions) : '';

  const {isLoading, error, data} = useQuery<Metric[]>({
    queryKey: ['span-metrics-series', span?.group_id, transactions?.join(',') || ''],
    queryFn: () =>
      fetch(`${HOST}/?query=${query}&referrer=${referrer}`).then(res => res.json()),
    retry: false,
    initialData: [],
    enabled: Boolean(query),
  });

  const parsedData: Record<string, Record<string, Series>> = {};
  const dataByTransaction = groupBy(data, 'transaction');
  Object.keys(dataByTransaction).forEach(transaction => {
    const parsedTransactionData = keyBy(
      ['spm', 'p50'].map(seriesName => {
        const series: Series = {
          seriesName,
          data: data.map(datum => ({value: datum[seriesName], name: datum.interval})),
        };

        return zeroFillSeries(series, moment.duration(INTERVAL, 'hours'));
      }),
      'seriesName'
    );

    parsedData[transaction] = parsedTransactionData;
  });

  return {isLoading, error, data: parsedData};
};

const getQuery = (span: Span, transactions: string[]) => {
  return `SELECT
    transaction,
    toStartOfInterval(start_timestamp, INTERVAL ${INTERVAL} hour) as interval,
    quantile(0.50)(exclusive_time) AS p50,
    divide(count(), multiply(${INTERVAL}, 60)) as spm
  FROM spans_experimental_starfish
  WHERE
    transaction IN ('${transactions.join("','")}')
    AND group_id = '${span.group_id}'
  GROUP BY transaction, interval
  ORDER BY transaction, interval
`;
};
