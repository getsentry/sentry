import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {
  MetricsProperty,
  MetricsResponse,
  SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {EMPTY_OPTION_VALUE} from 'sentry/views/starfish/views/spans/selectors/emptyOption';

export const useSpanMetrics = <T extends MetricsProperty[]>(
  filters: SpanMetricsQueryFilters,
  fields: T,
  referrer: string = 'span-metrics'
) => {
  const location = useLocation();
  const eventView = getEventView(filters, fields, location);

  const enabled = Object.values(filters).every(value => Boolean(value));

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
  filters: SpanMetricsQueryFilters,
  fields: string[] = [],
  location: Location
) {
  const query = new MutableSearch('');

  Object.entries(filters).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    if (value === EMPTY_OPTION_VALUE) {
      query.addFilterValue('!has', key);
    }

    query.addFilterValue(key, value, !ALLOWED_WILDCARD_FIELDS.includes(key));
  });

  // TODO: This condition should be enforced everywhere
  // query.addFilterValue('has', 'span.description');

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: query.formatString(),
      fields,
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    location
  );
}

const ALLOWED_WILDCARD_FIELDS = ['span.description'];
