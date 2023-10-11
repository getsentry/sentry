import {useSpanTransactionMetrics} from 'sentry/views/starfish/queries/useSpanTransactionMetrics';

export const useResourcePagesQuery = (groupId: string) => {
  // We'll do more this when we have the transaction tag on resource spans.
  return useSpanTransactionMetrics({'span.group': groupId});
};
