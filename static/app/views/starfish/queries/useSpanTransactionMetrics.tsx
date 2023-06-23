import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {useWrappedDiscoverQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const {SPAN_SELF_TIME} = SpanMetricsFields;

export type SpanTransactionMetrics = {
  'p50(span.self_time)': number;
  'p95(span.self_time)': number;
  'percentile_percent_change(span.self_time, 0.95)': number;
  'sps()': number;
  'sps_percent_change()': number;
  'sum(span.self_time)': number;
  'time_spent_percentage(local)': number;
  transaction: string;
};

export const useSpanTransactionMetrics = (
  span: Pick<IndexedSpan, 'group'>,
  transactions?: string[],
  _referrer = 'span-transaction-metrics'
) => {
  const location = useLocation();

  const eventView = getEventView(span, location, transactions ?? []);

  return useWrappedDiscoverQuery<SpanTransactionMetrics[]>({
    eventView,
    initialData: [],
    enabled: Boolean(span),
  });
};

function getEventView(span: {group: string}, location: Location, transactions: string[]) {
  const cleanGroupId = span.group.replaceAll('-', '').slice(-16);

  const search = new MutableSearch('');
  search.addFilterValues('span.group', [cleanGroupId]);
  search.addFilterValues('transaction.op', ['http.server']);

  if (transactions.length > 0) {
    search.addFilterValues('transaction', transactions);
  }

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: search.formatString(),
      fields: [
        'transaction',
        'sps()',
        'sps_percent_change()',
        `sum(${SPAN_SELF_TIME})`,
        `p95(${SPAN_SELF_TIME})`,
        `percentile_percent_change(${SPAN_SELF_TIME}, 0.95)`,
        'time_spent_percentage(local)',
        'transaction.op',
      ],
      orderby: '-time_spent_percentage_local',
      dataset: DiscoverDatasets.SPANS_METRICS,
      projects: [1],
      version: 2,
    },
    location
  );
}
