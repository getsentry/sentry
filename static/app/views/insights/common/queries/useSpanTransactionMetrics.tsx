import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import type {MetricsFilters, SpanMetricsProperty} from 'sentry/views/insights/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME} = SpanMetricsField;

export type SpanTransactionMetrics = {
  'avg(http.response_content_length)': number;
  'avg(span.self_time)': number;
  'epm()': number;
  'http_response_count(5)': number;
  'resource.render_blocking_status': '' | 'non-blocking' | 'blocking';
  'sum(span.self_time)': number;
  'time_spent_percentage()': number;
  transaction: string;
  'transaction.method': string;
};

export const useSpanTransactionMetrics = (
  filters: MetricsFilters,
  sorts?: Sort[],
  cursor?: string,
  extraFields: SpanMetricsProperty[] = [],
  enabled = true,
  referrer = 'api.starfish.span-transaction-metrics'
) => {
  const search = new MutableSearch('');

  const finalSorts: Sort[] = sorts?.length
    ? sorts
    : [
        {
          field: 'time_spent_percentage',
          kind: 'desc',
        },
      ];

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

  return useSpanMetrics(
    {
      cursor,
      enabled,
      limit: 25,
      sorts: finalSorts,
      search,
      fields: [
        'transaction',
        'transaction.method',
        'epm()',
        `sum(${SPAN_SELF_TIME})`,
        `avg(${SPAN_SELF_TIME})`,
        'time_spent_percentage()',
        'http_response_count(5)',
        ...extraFields,
      ],
    },
    referrer
  );
};
