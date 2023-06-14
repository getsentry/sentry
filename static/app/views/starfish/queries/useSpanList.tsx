import {Location} from 'history';
import omit from 'lodash/omit';

import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleName} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {NULL_SPAN_CATEGORY} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

const SPAN_FILTER_KEYS = ['span.op', 'span.domain', 'span.action'];

export type SpanMetrics = {
  'p95(span.duration)': number;
  'percentile_percent_change(span.duration, 0.95)': number;
  'span.description': string;
  'span.domain': string;
  'span.group': string;
  'span.op': string;
  'sps()': number;
  'sps_percent_change()': number;
  'sum(span.duration)': number;
  'time_spent_percentage()': number;
};

export const useSpanList = (
  moduleName: ModuleName,
  transaction?: string,
  spanCategory?: string,
  orderBy?: string,
  limit?: number,
  referrer = 'use-span-list'
) => {
  const location = useLocation();

  const eventView = getEventView(
    moduleName,
    location,
    transaction,
    spanCategory,
    orderBy
  );

  // TODO: Add referrer
  const {isLoading, data, pageLinks} = useSpansQuery<SpanMetrics[]>({
    eventView,
    initialData: [],
    enabled: Boolean(eventView),
    limit,
    referrer,
  });

  return {isLoading, data, pageLinks};
};

function getEventView(
  moduleName: ModuleName,
  location: Location,
  transaction?: string,
  spanCategory?: string,
  orderBy?: string
) {
  const query = buildEventViewQuery(moduleName, location, transaction, spanCategory)
    .filter(Boolean)
    .join(' ');

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query,
      fields: [
        'span.op',
        'span.group',
        'span.description',
        'span.domain',
        'sps()',
        'sps_percent_change()',
        'sum(span.duration)',
        'p95(span.duration)',
        'time_spent_percentage()',
        'percentile_percent_change(span.duration, 0.95)',
      ],
      orderby: orderBy,
      dataset: DiscoverDatasets.SPANS_METRICS,
      projects: [1],
      version: 2,
    },
    omit(location, 'span.category')
  );
}

function buildEventViewQuery(
  moduleName: ModuleName,
  location: Location,
  transaction?: string,
  spanCategory?: string
) {
  const {query} = location;
  const result = Object.keys(query)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    .filter(key => Boolean(query[key]))
    .map(key => {
      return `${key}:${query[key]}`;
    });

  if (moduleName !== ModuleName.ALL) {
    result.push(`span.module:${moduleName}`);
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

  return result;
}
