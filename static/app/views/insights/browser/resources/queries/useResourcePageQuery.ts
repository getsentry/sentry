import type {Sort} from 'sentry/utils/discover/fields';
import {useSpanTransactionMetrics} from 'sentry/views/insights/common/queries/useSpanTransactionMetrics';
import {SpanMetricsField, type SubregionCode} from 'sentry/views/insights/types';

const {HTTP_RESPONSE_CONTENT_LENGTH, RESOURCE_RENDER_BLOCKING_STATUS} = SpanMetricsField;

export const useResourcePagesQuery = (
  groupId: string,
  {
    sort,
    cursor,
    subregions,
    renderBlockingStatus,
  }: {
    sort: Sort;
    cursor?: string;
    renderBlockingStatus?: string;
    subregions?: SubregionCode[];
  }
) => {
  return useSpanTransactionMetrics(
    {
      'span.group': groupId,
      ...(renderBlockingStatus
        ? {[RESOURCE_RENDER_BLOCKING_STATUS]: renderBlockingStatus}
        : {}),
      ...(subregions
        ? {[SpanMetricsField.USER_GEO_SUBREGION]: `[${subregions.join(',')}]`}
        : {}),
    },
    [sort],
    cursor,
    [`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`, RESOURCE_RENDER_BLOCKING_STATUS]
  );
};
