import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanSummaryQueryFilters} from 'sentry/views/starfish/queries/useSpanMetrics';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const {SPAN_OP, SPAN_ACTION, SPAN_DESCRIPTION, SPAN_DOMAIN, SPAN_GROUP} =
  SpanMetricsFields;

export type SpanMeta = {
  'span.action': string;
  'span.description': string;
  'span.domain': string;
  'span.op': string;
};

export const useSpanMeta = (
  group: string,
  queryFilters: SpanSummaryQueryFilters,
  referrer: string = 'span-metrics'
) => {
  const location = useLocation();

  return useSpansQuery<SpanMeta[]>({
    eventView: getEventView(group, location, queryFilters),
    initialData: [],
    referrer,
  });
};

function getEventView(
  groupId: string,
  location: Location,
  queryFilters: SpanSummaryQueryFilters
) {
  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      query: `${SPAN_GROUP}:${groupId}${
        queryFilters?.transactionName
          ? ` transaction:${queryFilters?.transactionName}`
          : ''
      }${
        queryFilters?.['transaction.method']
          ? ` transaction.method:${queryFilters?.['transaction.method']}`
          : ''
      }`,
      fields: [SPAN_OP, SPAN_DESCRIPTION, SPAN_ACTION, SPAN_DOMAIN, 'count()'], // TODO: Failing to pass a field like `count()` causes an error
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    location
  );
}
