import type {PageFilters} from 'sentry/types/core';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useResourceModuleFilters} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import type {SearchHook} from 'sentry/views/insights/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {
  SPAN_SELF_TIME,
  HTTP_RESPONSE_CONTENT_LENGTH,
  HTTP_DECODED_RESPONSE_CONTENT_LENGTH,
  HTTP_RESPONSE_TRANSFER_SIZE,
  RESOURCE_RENDER_BLOCKING_STATUS,
} = SpanMetricsField;

interface Props {
  referrer: string;
  search: MutableSearch;
  enabled?: boolean;
  pageFilters?: PageFilters;
}

export function useResourceSummarySeriesSearch(groupId?: string): SearchHook {
  const filters = useResourceModuleFilters();

  const search = MutableSearch.fromQueryObject({
    'span.group': groupId,
    ...(filters[RESOURCE_RENDER_BLOCKING_STATUS]
      ? {
          [RESOURCE_RENDER_BLOCKING_STATUS]: filters[RESOURCE_RENDER_BLOCKING_STATUS],
        }
      : {}),
    ...(filters[SpanMetricsField.USER_GEO_SUBREGION]
      ? {
          [SpanMetricsField.USER_GEO_SUBREGION]: `[${filters[SpanMetricsField.USER_GEO_SUBREGION].join(',')}]`,
        }
      : {}),
  });

  return {search, enabled: Boolean(groupId)};
}

export function useResourceSummarySeries(props: Props) {
  const {search, pageFilters, enabled, referrer} = props;

  return useSpanMetricsSeries(
    {
      search,
      yAxis: [
        `epm()`,
        `avg(${SPAN_SELF_TIME})`,
        `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
        `avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`,
        `avg(${HTTP_RESPONSE_TRANSFER_SIZE})`,
      ],
      enabled,
      transformAliasToInputFormat: true,
    },
    referrer,
    pageFilters
  );
}
