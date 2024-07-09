import {
  type MetricsQueryApiQueryParams,
  useMetricsQuery,
} from 'sentry/utils/metrics/useMetricsQuery';

type Props = {
  projects: (number | string)[];
};

const CARDINALITY_QUERIES = [
  {
    name: 'a',
    mri: 'g:metric_stats/cardinality@none',
    aggregation: 'max',
    groupBy: ['mri'],
    query: '!mri:"" cardinality.window:3600',
    orderBy: 'desc' as 'desc' | 'asc',
  } as MetricsQueryApiQueryParams,
];

const CARDINALITY_DATE_TIME = {
  period: '24h',
  start: null,
  end: null,
  utc: null,
};

const CARDINALITY_INTERVAL = '1h';

export function useMetricsCardinality({projects}: Props) {
  const cardinalityQuery = useMetricsQuery(
    CARDINALITY_QUERIES,
    {
      environments: [],
      datetime: CARDINALITY_DATE_TIME,
      projects: projects,
    },
    {interval: CARDINALITY_INTERVAL, includeSeries: false}
  );

  if (cardinalityQuery.data?.data[0]) {
    const data = cardinalityQuery.data.data[0].reduce(
      (acc, group) => {
        acc[group.by.mri] = group.totals;
        return acc;
      },
      {} as Record<string, number>
    );
    return {...cardinalityQuery, data};
  }

  return {...cardinalityQuery, data: undefined};
}
