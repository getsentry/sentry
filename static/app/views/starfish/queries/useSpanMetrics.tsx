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

interface UseSpanMetricsOptions<Fields> {
  cursor?: string;
  fields?: Fields;
  filters?: SpanMetricsQueryFilters;
  limit?: number;
  referrer?: string;
  sorts?: Sort[];
}

export const useSpanMetrics = <Fields extends MetricsProperty[]>(
  options: UseSpanMetricsOptions<Fields> = {}
) => {
  const {fields = [], filters = {}, sorts = [], limit, cursor, referrer} = options;

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
  const data = (result?.data ?? []) as Pick<MetricsResponse, Fields[number]>[] | [];

  return {
    ...result,
    data,
    isEnabled: enabled,
  };
};

function getEventView(
  filters: SpanMetricsQueryFilters = {},
  fields: string[] = [],
  sorts: Sort[] = [],
  location: Location
) {
  const query = MutableSearch.fromQueryObject(filters);

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
