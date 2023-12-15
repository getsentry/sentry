import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {
  MetricsProperty,
  MetricsResponse,
  SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
import {useWrappedDiscoverQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {EMPTY_OPTION_VALUE} from 'sentry/views/starfish/views/spans/selectors/emptyOption';

export const useSpanMetrics = <T extends MetricsProperty[]>(
  filters: SpanMetricsQueryFilters,
  fields: T,
  sorts?: Sort[],
  limit?: number,
  cursor?: string,
  referrer: string = 'api.starfish.use-span-metrics'
) => {
  const location = useLocation();

  const eventView = getEventView(filters, fields, sorts, location);

  const enabled = Object.values(filters).every(value => Boolean(value));

  const result = useWrappedDiscoverQuery({
    eventView,
    initialData: [],
    limit,
    enabled,
    referrer,
    cursor,
  });

  // This type is a little awkward but it explicitly states that the response could be empty. This doesn't enable unchecked access errors, but it at least indicates that it's possible that there's no data
  // eslint-disable-next-line @typescript-eslint/ban-types
  const data = (result?.data ?? []) as Pick<MetricsResponse, T[number]>[] | [];

  return {
    ...result,
    data,
    isEnabled: enabled,
  };
};

function getEventView(
  filters: SpanMetricsQueryFilters,
  fields: string[] = [],
  sorts: Sort[] = [],
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

  const eventView = EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: query.formatString(),
      fields,
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    location
  );

  if (sorts.length > 0) {
    eventView.sorts = sorts;
  }

  return eventView;
}

const ALLOWED_WILDCARD_FIELDS = ['span.description'];
