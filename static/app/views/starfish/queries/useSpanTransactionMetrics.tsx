import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {useWrappedDiscoverQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const {SPAN_SELF_TIME, SPAN_GROUP} = SpanMetricsFields;

export type SpanTransactionMetrics = {
  'http_error_count()': number;
  'http_error_count_percent_change()': number;
  'p50(span.self_time)': number;
  'p95(span.self_time)': number;
  'percentile_percent_change(span.self_time, 0.95)': number;
  'sps()': number;
  'sps_percent_change()': number;
  'sum(span.self_time)': number;
  'time_spent_percentage(local)': number;
  transaction: string;
  'transaction.method': string;
};

export const useSpanTransactionMetrics = (
  span: Pick<IndexedSpan, 'group'>,
  options: {sorts?: Sort[]; transactions?: string[]},
  _referrer = 'api.starfish.span-transaction-metrics'
) => {
  const location = useLocation();

  const {transactions, sorts} = options;

  const eventView = getEventView(span, location, transactions ?? [], sorts);

  return useWrappedDiscoverQuery<SpanTransactionMetrics[]>({
    eventView,
    initialData: [],
    enabled: Boolean(span),
    referrer: _referrer,
  });
};

function getEventView(
  span: {group: string},
  location: Location,
  transactions: string[],
  sorts?: Sort[]
) {
  const cleanGroupId = span.group.replaceAll('-', '').slice(-16);

  const search = new MutableSearch('');
  search.addFilterValues(SPAN_GROUP, [cleanGroupId]);
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
        'sps()',
        `sum(${SPAN_SELF_TIME})`,
        `p95(${SPAN_SELF_TIME})`,
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
