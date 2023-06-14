import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export type SpanTransactionMetrics = {
  'p50(span.duration)': number;
  'p95(span.duration)': number;
  'percentile_percent_change(span.duration, 0.95)': number;
  'sps()': number;
  'sps_percent_change()': number;
  'sum(span.self_time)': number;
  'time_spent_percentage(local)': number;
  transaction: string;
};

export const useSpanTransactionMetrics = (
  span?: Pick<IndexedSpan, 'group'>,
  transactions?: string[],
  _referrer = 'span-transaction-metrics'
) => {
  const location = useLocation();

  const eventView = span ? getEventView(span, location, transactions ?? []) : undefined;

  const {isLoading, data, pageLinks} = useSpansQuery<SpanTransactionMetrics[]>({
    eventView,
    initialData: [],
    enabled: Boolean(eventView),
  });

  return {isLoading, data, pageLinks};
};

function getEventView(span: {group: string}, location: Location, transactions: string[]) {
  const cleanGroupId = span.group.replaceAll('-', '').slice(-16);

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: `span.group:${cleanGroupId}${
        transactions.length > 0 ? ` transaction:[${transactions.join(',')}]` : ''
      }`,
      fields: [
        'transaction',
        'sps()',
        'sps_percent_change()',
        'sum(span.duration)',
        'p95(span.duration)',
        'percentile_percent_change(span.duration, 0.95)',
        'time_spent_percentage(local)',
      ],
      orderby: '-time_spent_percentage_local',
      dataset: DiscoverDatasets.SPANS_METRICS,
      projects: [1],
      version: 2,
    },
    location
  );
}
