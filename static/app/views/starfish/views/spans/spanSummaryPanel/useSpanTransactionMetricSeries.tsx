import groupBy from 'lodash/groupBy';
import keyBy from 'lodash/keyBy';
import moment from 'moment';

import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useWrappedDiscoverTimeseriesQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

const INTERVAL = 12;

export const useSpanTransactionMetricSeries = (
  transactions?: string[],
  referrer: string = 'span-transaction-metrics-series'
) => {
  const {
    selection: {datetime},
  } = usePageFilters();
  const {isLoading, data} = useWrappedDiscoverTimeseriesQuery({
    eventView: getEventView({
      transactions: transactions!,
      datetime,
      interval: `${INTERVAL}h`,
    }),
    initialData: [],
    enabled: transactions && transactions.length > 0,
    referrer,
  });

  const parsedData: Record<string, Record<string, Series>> = {};
  const dataByTransaction = groupBy(data, 'group');
  Object.keys(dataByTransaction).forEach(transaction => {
    const parsedTransactionData = keyBy(
      ['epm()', 'p50(transaction.duration)'].map(seriesName => {
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

  return {isLoading, data: parsedData};
};

const getEventView = ({
  transactions,
  datetime,
  interval,
}: {
  datetime;
  interval;
  transactions: string[];
}) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: ['transaction', 'epm()', 'p50(transaction.duration)'],
    yAxis: ['epm()', 'p50(transaction.duration)'],
    orderby: 'transaction',
    query: `transaction:["${transactions.join('","')}"]`,
    topEvents: '5',
    start: datetime.start as string,
    end: datetime.end as string,
    range: datetime.period as string,
    dataset: DiscoverDatasets.METRICS,
    interval,
    projects: [1],
    version: 2,
  });
};
