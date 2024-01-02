import {Sort} from 'sentry/utils/discover/fields';
import {useSpanTransactionMetrics} from 'sentry/views/starfish/queries/useSpanTransactionMetrics';
import {SpanMetricsField} from 'sentry/views/starfish/types';

const {HTTP_RESPONSE_CONTENT_LENGTH, RESOURCE_RENDER_BLOCKING_STATUS} = SpanMetricsField;

export const useResourcePagesQuery = (
  groupId: string,
  {
    sort,
    cursor,
    renderBlockingStatus,
  }: {sort: Sort; cursor?: string; renderBlockingStatus?: string}
) => {
  return useSpanTransactionMetrics(
    {
      'span.group': groupId,
      ...(renderBlockingStatus
        ? {[RESOURCE_RENDER_BLOCKING_STATUS]: renderBlockingStatus}
        : {}),
    },
    [sort],
    cursor,
    [`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`, RESOURCE_RENDER_BLOCKING_STATUS]
  );
};
