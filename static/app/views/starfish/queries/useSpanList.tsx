import {Location} from 'history';
import omit from 'lodash/omit';

import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanMetricsField, SpanMetricsQueryFilters} from 'sentry/views/starfish/types';
import {useWrappedDiscoverQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const {SPAN_SELF_TIME, SPAN_DESCRIPTION, SPAN_GROUP, SPAN_OP, SPAN_DOMAIN, PROJECT_ID} =
  SpanMetricsField;

export type SpanMetrics = {
  'avg(span.self_time)': number;
  'http_error_count()': number;
  'project.id': number;
  'span.description': string;
  'span.domain': Array<string>;
  'span.group': string;
  'span.op': string;
  'spm()': number;
  'sum(span.self_time)': number;
  'time_spent_percentage()': number;
};

export const useSpanList = (
  filters: SpanMetricsQueryFilters,
  sorts?: Sort[],
  limit?: number,
  referrer = 'api.starfish.use-span-list',
  cursor?: string
) => {
  const location = useLocation();

  const eventView = getEventView(filters, location, sorts);

  // TODO: Add correct typing. The response should only include the fields
  // we're querying for
  const {isLoading, data, meta, pageLinks} = useWrappedDiscoverQuery<SpanMetrics[]>({
    eventView,
    initialData: [],
    limit,
    referrer,
    cursor,
  });

  return {isLoading, data, meta, pageLinks};
};

function getEventView(
  filters: SpanMetricsQueryFilters,
  location: Location,
  sorts?: Sort[]
) {
  const query = new MutableSearch('');
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      query.addFilterValue(key, value);
    }
  });

  query.addFilterValue('has', 'span.description');

  const fields = [
    PROJECT_ID,
    SPAN_OP,
    SPAN_GROUP,
    SPAN_DESCRIPTION,
    SPAN_DOMAIN,
    'spm()',
    `sum(${SPAN_SELF_TIME})`,
    `avg(${SPAN_SELF_TIME})`,
    'http_error_count()',
    'time_spent_percentage()',
  ];

  const eventView = EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: query.formatString(),
      fields,
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    omit(location, 'span.category', 'http.method')
  );

  if (sorts) {
    eventView.sorts = sorts;
  }

  return eventView;
}
