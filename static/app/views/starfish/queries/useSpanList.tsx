import {Location} from 'history';
import omit from 'lodash/omit';

import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleName, SpanMetricsFields} from 'sentry/views/starfish/types';
import {buildEventViewQuery} from 'sentry/views/starfish/utils/buildEventViewQuery';
import {useWrappedDiscoverQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const {SPAN_SELF_TIME, SPAN_DESCRIPTION, SPAN_GROUP, SPAN_OP, SPAN_DOMAIN} =
  SpanMetricsFields;

export type SpanMetrics = {
  'http_error_count()': number;
  'http_error_count_percent_change()': number;
  'p95(span.self_time)': number;
  'percentile_percent_change(span.self_time, 0.95)': number;
  'span.description': string;
  'span.domain': string;
  'span.group': string;
  'span.op': string;
  'sps()': number;
  'sps_percent_change()': number;
  'sum(span.self_time)': number;
  'time_spent_percentage()': number;
  'time_spent_percentage(local)': number;
};

export const useSpanList = (
  moduleName: ModuleName,
  transaction?: string,
  method?: string,
  spanCategory?: string,
  sorts?: Sort[],
  limit?: number,
  referrer = 'api.starfish.use-span-list',
  cursor?: string
) => {
  const location = useLocation();

  const eventView = getEventView(
    moduleName,
    location,
    transaction,
    method,
    spanCategory,
    sorts
  );

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
  moduleName: ModuleName,
  location: Location,
  transaction?: string,
  method?: string,
  spanCategory?: string,
  sorts?: Sort[]
) {
  const query = buildEventViewQuery({
    moduleName,
    location,
    transaction,
    method,
    spanCategory,
  })
    .filter(Boolean)
    .join(' ');

  const fields = [
    SPAN_OP,
    SPAN_GROUP,
    SPAN_DESCRIPTION,
    SPAN_DOMAIN,
    'sps()',
    `sum(${SPAN_SELF_TIME})`,
    `p95(${SPAN_SELF_TIME})`,
    'http_error_count()',
  ];

  if (defined(transaction)) {
    fields.push('time_spent_percentage(local)');
  } else {
    fields.push('time_spent_percentage()');
  }

  const eventView = EventView.fromNewQueryWithLocation(
    {
      name: '',
      query,
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
