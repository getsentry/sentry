import {Sort} from 'sentry/utils/discover/fields';
import {useSpanTransactionMetrics} from 'sentry/views/starfish/queries/useSpanTransactionMetrics';

export const useResourcePagesQuery = (groupId: string, {sort}: {sort: Sort}) => {
  return useSpanTransactionMetrics({'span.group': groupId}, [sort]);
};
