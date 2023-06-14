import {getInterval} from 'sentry/components/charts/utils';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  UseSpansQueryReturnType,
  useWrappedDiscoverTimeseriesQuery,
} from 'sentry/views/starfish/utils/useSpansQuery';

type QueryTransactionByTPMAndP75ReturnType = {
  count: number;
  'count()': number;
  interval: string;
  'p50(transaction.duration)': number;
  'p95(transaction.duration)': number;
  transaction: string;
}[];
export const useQueryTransactionByTPMAndDuration = (
  transactionNames: string[]
): UseSpansQueryReturnType<QueryTransactionByTPMAndP75ReturnType> => {
  const {
    selection: {datetime},
  } = usePageFilters();

  return useWrappedDiscoverTimeseriesQuery({
    eventView: EventView.fromSavedQuery({
      name: '',
      fields: [
        'transaction',
        'epm()',
        'p50(transaction.duration)',
        'p95(transaction.duration)',
      ],
      yAxis: ['epm()', 'p50(transaction.duration)', 'p95(transaction.duration)'],
      orderby: '-count',
      query: `transaction:["${transactionNames.join('","')}"]`,
      topEvents: '5',
      start: datetime.start as string,
      end: datetime.end as string,
      range: datetime.period as string,
      dataset: DiscoverDatasets.METRICS,
      interval: getInterval(datetime, 'low'),
      projects: [1],
      version: 2,
    }),
    initialData: [],
  });
};
