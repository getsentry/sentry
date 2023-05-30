import keyBy from 'lodash/keyBy';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useWrappedDiscoverQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export const useSpanTransactionMetrics = (
  transactions?: string[],
  referrer = 'span-transaction-metrics'
) => {
  const {
    selection: {datetime},
  } = usePageFilters();
  const {isLoading, data} = useWrappedDiscoverQuery({
    eventView: getEventView({transactions: transactions ?? [], datetime}),
    initialData: [],
    referrer,
  });

  const parsedData = keyBy(data, 'transaction');

  return {isLoading, data: parsedData};
};

const getEventView = ({transactions, datetime}: {datetime; transactions: string[]}) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: ['transaction', 'epm()', 'p50(transaction.duration)'],
    orderby: 'transaction',
    query: `transaction:["${transactions.join('","')}"]`,
    start: datetime.start as string,
    end: datetime.end as string,
    range: datetime.period as string,
    dataset: DiscoverDatasets.METRICS,
    projects: [1],
    version: 2,
  });
};
