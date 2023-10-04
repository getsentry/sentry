import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {useWrappedDiscoverQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const {SPAN_SELF_TIME, SPAN_GROUP} = SpanMetricsField;

export type SpanTransactionMetrics = {
  'avg(span.self_time)': number;
  'http_error_count()': number;
  'spm()': number;
  'sum(span.self_time)': number;
  'time_spent_percentage(local)': number;
  transaction: string;
  'transaction.method': string;
  'transaction.op': string;
};

export const useSpanTransactionMetrics = (
  group: string,
  options: {transactions?: string[]},
  sorts?: Sort[],
  referrer = 'api.starfish.span-transaction-metrics',
  cursor?: string
) => {
  const location = useLocation();

  const {transactions} = options;

  const eventView = getEventView(group, location, transactions ?? [], sorts);

  return useWrappedDiscoverQuery<SpanTransactionMetrics[]>({
    eventView,
    initialData: [],
    enabled: Boolean(group),
    limit: 25,
    referrer,
    cursor,
  });
};

function getEventView(
  group: string,
  location: Location,
  transactions: string[],
  sorts?: Sort[]
) {
  const search = new MutableSearch('');
  search.addFilterValues(SPAN_GROUP, [group]);
  search.addFilterValues('transaction.op', ['http.server']);

  if (transactions.length > 0) {
    search.addFilterValues('transaction', transactions);
  }

  const eventView = EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: search.formatString(),
      fields: [
        'transaction',
        'transaction.method',
        'spm()',
        `sum(${SPAN_SELF_TIME})`,
        `avg(${SPAN_SELF_TIME})`,
        'time_spent_percentage(local)',
        'transaction.op',
        'http_error_count()',
      ],
      orderby: '-time_spent_percentage_local',
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    location
  );

  if (sorts) {
    eventView.sorts = sorts;
  }

  return eventView;
}
