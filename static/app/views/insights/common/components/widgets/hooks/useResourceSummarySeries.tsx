import type {PageFilters} from 'sentry/types/core';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/insights/browser/resources/referrer';
import {useResourceModuleFilters} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {
  SPAN_SELF_TIME,
  HTTP_RESPONSE_CONTENT_LENGTH,
  HTTP_DECODED_RESPONSE_CONTENT_LENGTH,
  HTTP_RESPONSE_TRANSFER_SIZE,
  RESOURCE_RENDER_BLOCKING_STATUS,
} = SpanMetricsField;

interface Props {
  groupId?: string;
  pageFilters?: PageFilters;
}

export function useResourceSummarySeries({pageFilters, groupId}: Props = {}) {
  const filters = useResourceModuleFilters();

  const mutableSearch = MutableSearch.fromQueryObject({
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

  return useSpanMetricsSeries(
    {
      search: mutableSearch,
      yAxis: [
        `epm()`,
        `avg(${SPAN_SELF_TIME})`,
        `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
        `avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`,
        `avg(${HTTP_RESPONSE_TRANSFER_SIZE})`,
      ],
      enabled: Boolean(groupId),
      transformAliasToInputFormat: true,
    },
    Referrer.RESOURCE_SUMMARY_CHARTS,
    pageFilters
  );
}
