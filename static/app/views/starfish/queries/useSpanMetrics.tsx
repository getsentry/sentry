import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const {SPAN_GROUP} = SpanMetricsField;

export type SpanMetrics = {
  [metric: string]: number | string;
  'http_error_count()': number;
  'p95(span.self_time)': number;
  'span.op': string;
  'spm()': number;
  'time_spent_percentage()': number;
};

export type SpanSummaryQueryFilters = {
  'transaction.method'?: string;
  transactionName?: string;
};

export const useSpanMetrics = (
  group: string,
  queryFilters: SpanSummaryQueryFilters,
  fields: string[] = [],
  referrer: string = 'span-metrics'
) => {
  const location = useLocation();
  const eventView = group
    ? getEventView(group, location, queryFilters, fields)
    : undefined;

  const enabled =
    Boolean(group) && Object.values(queryFilters).every(value => Boolean(value));

  // TODO: Add referrer
  const result = useSpansQuery<SpanMetrics[]>({
    eventView,
    initialData: [],
    enabled,
    referrer,
  });

  return {...result, data: result?.data?.[0] ?? {}, isEnabled: enabled};
};

function getEventView(
  group: string,
  location: Location,
  queryFilters?: SpanSummaryQueryFilters,
  fields: string[] = []
) {
  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: `${SPAN_GROUP}:${group}${
        queryFilters?.transactionName
          ? ` transaction:"${queryFilters?.transactionName}"`
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
