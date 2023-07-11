import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const {SPAN_GROUP} = SpanMetricsFields;

export type SpanMetrics = {
  [metric: string]: number | string;
  'http_error_count()': number;
  'p95(span.self_time)': number;
  'span.op': string;
  'sps()': number;
  'time_spent_percentage()': number;
};

export type SpanSummaryQueryFilters = {
  'transaction.method'?: string;
  transactionName?: string;
};

export const useSpanMetrics = (
  span?: Pick<IndexedSpan, 'group'>,
  queryFilters: SpanSummaryQueryFilters = {},
  fields: string[] = [],
  referrer: string = 'span-metrics'
) => {
  const location = useLocation();
  const eventView = span ? getEventView(span, location, queryFilters, fields) : undefined;

  // TODO: Add referrer
  const result = useSpansQuery<SpanMetrics[]>({
    eventView,
    initialData: [],
    enabled: Boolean(span),
    referrer,
  });

  return {...result, data: result?.data?.[0] ?? {}};
};

function getEventView(
  span: {group: string},
  location: Location,
  queryFilters?: SpanSummaryQueryFilters,
  fields: string[] = []
) {
  const cleanGroupId = span.group.replaceAll('-', '').slice(-16);

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: `${SPAN_GROUP}:${cleanGroupId}${
        queryFilters?.transactionName
          ? ` transaction:${queryFilters?.transactionName}`
          : ''
      }${
        queryFilters?.['transaction.method']
          ? ` transaction.method:${queryFilters?.['transaction.method']}`
          : ''
      }`,
      fields,
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    location
  );
}
