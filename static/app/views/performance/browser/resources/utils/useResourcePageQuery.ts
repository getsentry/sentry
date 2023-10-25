import {Sort} from 'sentry/utils/discover/fields';
import {useSpanTransactionMetrics} from 'sentry/views/starfish/queries/useSpanTransactionMetrics';
import {SpanMetricsField} from 'sentry/views/starfish/types';

const {HTTP_RESPONSE_CONTENT_LENGTH} = SpanMetricsField;

export const useResourcePagesQuery = (groupId: string, {sort}: {sort: Sort}) => {
  return useSpanTransactionMetrics({'span.group': groupId}, [sort], undefined, [
    `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
  ]);
};
