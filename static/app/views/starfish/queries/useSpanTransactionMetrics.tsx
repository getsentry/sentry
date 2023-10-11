import {Location} from 'history';

import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {MetricsFilters, SpanMetricsField} from 'sentry/views/starfish/types';
import {useWrappedDiscoverQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const {SPAN_SELF_TIME} = SpanMetricsField;

export type SpanTransactionMetrics = {
  'avg(span.self_time)': number;
  'http_error_count()': number;
  'spm()': number;
  'sum(span.self_time)': number;
  'time_spent_percentage()': number;
  transaction: string;
  'transaction.method': string;
  'transaction.op': string;
};

export const useSpanTransactionMetrics = (
  filters: MetricsFilters,
  sorts?: Sort[],
  cursor?: string,
  enabled: boolean = true,
  referrer = 'api.starfish.span-transaction-metrics'
) => {
  const location = useLocation();

  const eventView = getEventView(location, filters, sorts);

  return useWrappedDiscoverQuery<SpanTransactionMetrics[]>({
    eventView,
    initialData: [],
    enabled,
    limit: 25,
    referrer,
    cursor,
  });
};

function getEventView(location: Location, filters: MetricsFilters = {}, sorts?: Sort[]) {
  const search = new MutableSearch('');

  Object.entries(filters).forEach(([key, value]) => {
    if (!defined(value)) {
      return;
    }

    if (Array.isArray(value)) {
      search.addFilterValues(key, value);
    } else {
      search.addFilterValue(key, value);
    }
  });

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
        'time_spent_percentage()',
        'transaction.op',
        'http_error_count()',
      ],
      orderby: '-time_spent_percentage',
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
