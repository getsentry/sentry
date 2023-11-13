import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {
  MetricsProperty,
  MetricsResponse,
  SpanMetricsField,
} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const {SPAN_GROUP} = SpanMetricsField;

export type SpanSummaryQueryFilters = {
  release?: string;
  'resource.render_blocking_status'?: 'blocking' | 'non-blocking' | '!blocking' | '';
  'transaction.method'?: string;
  transactionName?: string;
};

export const useSpanMetrics = <T extends MetricsProperty[]>(
  group: string,
  queryFilters: SpanSummaryQueryFilters,
  fields: T,
  referrer: string = 'span-metrics'
) => {
  const location = useLocation();
  const eventView = group
    ? getEventView(group, location, queryFilters, fields)
    : undefined;

  const enabled =
    Boolean(group) && Object.values(queryFilters).every(value => Boolean(value));

  // TODO: Add referrer
  const result = useSpansQuery({
    eventView,
    initialData: [],
    enabled,
    referrer,
  });

  const data = (result?.data?.[0] ?? {}) as Pick<MetricsResponse, T[number]>;

  return {
    ...result,
    data,
    isEnabled: enabled,
  };
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
      }${queryFilters?.release ? ` release:${queryFilters?.release}` : ''}`,
      fields,
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    location
  );
}
