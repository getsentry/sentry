import {Location} from 'history';
import omit from 'lodash/omit';

import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleName, SpanMetricsFields} from 'sentry/views/starfish/types';
import {useWrappedDiscoverQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {NULL_SPAN_CATEGORY} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

const {SPAN_SELF_TIME} = SpanMetricsFields;
const SPAN_FILTER_KEYS = [
  'span.op',
  'span.domain',
  'span.action',
  '!span.module',
  '!span.category',
];

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
  const query = buildEventViewQuery(
    moduleName,
    location,
    transaction,
    method,
    spanCategory
  )
    .filter(Boolean)
    .join(' ');

  const fields = [
    'span.op',
    'span.group',
    'span.description',
    'span.domain',
    'sps()',
    'sps_percent_change()',
    `sum(${SPAN_SELF_TIME})`,
    `p95(${SPAN_SELF_TIME})`,
    `percentile_percent_change(${SPAN_SELF_TIME}, 0.95)`,
    'http_error_count()',
    'http_error_count_percent_change()',
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

function buildEventViewQuery(
  moduleName: ModuleName,
  location: Location,
  transaction?: string,
  method?: string,
  spanCategory?: string
) {
  const {query} = location;
  const result = Object.keys(query)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    .filter(key => Boolean(query[key]))
    .map(key => {
      const value = query[key];
      const isArray = Array.isArray(value);

      if (key === '!span.category' && isArray && value.includes('db')) {
        // When omitting database spans, explicitly allow `db.redis` spans, because
        // we're not including those spans in the database category
        const categoriesAsideFromDatabase = value.filter(v => v !== 'db');
        return `(!span.category:db OR span.op:db.redis) !span.category:[${categoriesAsideFromDatabase.join(
          ','
        )}]`;
      }

      return `${key}:${isArray ? `[${value}]` : value}`;
    });

  result.push('has:span.description');

  if (moduleName !== ModuleName.ALL) {
    result.push(`span.module:${moduleName}`);
  }

  if (moduleName === ModuleName.DB) {
    result.push('!span.op:db.redis');
  }

  if (defined(spanCategory)) {
    if (spanCategory === NULL_SPAN_CATEGORY) {
      result.push(`!has:span.category`);
    } else if (spanCategory !== 'Other') {
      result.push(`span.category:${spanCategory}`);
    }
  }

  if (transaction) {
    result.push(`transaction:${transaction}`);
  }

  if (method) {
    result.push(`transaction.method:${method}`);
  }

  return result;
}
