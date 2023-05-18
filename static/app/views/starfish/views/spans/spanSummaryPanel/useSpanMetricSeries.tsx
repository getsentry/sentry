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

export const useSpanMetricSeries = (span?: Span, referrer = 'span-metrics-series') => {
  const query = span ? getQuery(span) : '';

  const {isLoading, error, data} = useQuery<Metric[]>({
    queryKey: ['span-metrics-series', span?.group_id],
    queryFn: () =>
      fetch(`${HOST}/?query=${query}&referrer=${referrer}`).then(res => res.json()),
    retry: false,
    initialData: [],
    enabled: Boolean(span),
  });

  const parsedData = keyBy(
    ['spm', 'p50', 'p95', 'failure_rate'].map(seriesName => {
      const series: Series = {
        seriesName,
        data: data.map(datum => ({value: datum[seriesName], name: datum.interval})),
      };

      return zeroFillSeries(series, moment.duration(INTERVAL, 'hours'));
    }),
    'seriesName'
  );

  return {isLoading, error, data: parsedData};
};

const getQuery = (span: Span) => {
  return `
  SELECT
    toStartOfInterval(start_timestamp, INTERVAL ${INTERVAL} HOUR) as interval,
    count() as count,
    divide(count, multiply(${INTERVAL}, 60)) as spm,
    quantile(0.95)(exclusive_time) as p95,
    quantile(0.50)(exclusive_time) as p50,
    countIf(greaterOrEquals(status, 400) AND lessOrEquals(status, 599)) as "failure_count",
    "failure_count" / "count" as "failure_rate"
  FROM spans_experimental_starfish
  WHERE group_id = '${span.group_id}'
  GROUP BY interval
  ORDER BY interval
`;
};
