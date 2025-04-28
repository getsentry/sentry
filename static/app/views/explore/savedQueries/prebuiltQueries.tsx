import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {SavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {ChartType} from 'sentry/views/insights/common/components/chart';

type PrebuiltQuery = Pick<SavedQuery, 'name' | 'query'>;

export const PREBUILT_QUERIES: PrebuiltQuery[] = [
  {
    name: 'All Transactions',
    query: [
      {
        query: 'is_transaction:true',
        fields: [
          'id',
          'span.op',
          'span.description',
          'span.duration',
          'transaction',
          'timestamp',
        ],
        groupby: [],
        mode: Mode.SAMPLES,
        orderby: '',
        visualize: [
          {
            chartType: ChartType.BAR,
            yAxes: ['count()'],
          },
          {
            chartType: ChartType.LINE,
            yAxes: ['p75(span.duration)', 'p90(span.duration)'],
          },
        ],
      },
    ],
  },
  {
    name: 'DB Latency',
    query: [
      {
        query: 'span.op:db*',
        fields: [
          'id',
          'span.op',
          'span.description',
          'span.duration',
          'transaction',
          'timestamp',
        ],
        groupby: [],
        mode: Mode.SAMPLES,
        orderby: '',
        visualize: [
          {
            chartType: ChartType.LINE,
            yAxes: ['p75(span.duration)', 'p90(span.duration)'],
          },
        ],
      },
    ],
  },
  {
    name: 'Slow HTTP Requests',
    query: [
      {
        query: 'span.op:http.client',
        fields: [
          'id',
          'span.op',
          'span.description',
          'span.duration',
          'transaction',
          'timestamp',
        ],
        groupby: ['url'],
        mode: Mode.SAMPLES,
        orderby: '',
        visualize: [
          {
            chartType: ChartType.LINE,
            yAxes: ['p75(span.duration)', 'p90(span.duration)'],
          },
        ],
      },
    ],
  },
  {
    name: 'Worst Pageloads',
    query: [
      {
        query: 'span.op:pageload measurements.lcp:>0ms',
        fields: [
          'id',
          'span.op',
          'span.description',
          'span.duration',
          'transaction',
          'measurements.lcp',
          'timestamp',
        ],
        groupby: [],
        mode: Mode.SAMPLES,
        orderby: '-measurements.lcp',
        visualize: [
          {
            chartType: ChartType.BAR,
            yAxes: ['count()'],
          },
          {
            chartType: ChartType.LINE,
            yAxes: ['p75(span.duration)', 'p90(span.duration)'],
          },
        ],
      },
    ],
  },
];
