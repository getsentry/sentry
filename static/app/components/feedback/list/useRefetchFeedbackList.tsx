import {useCallback} from 'react';

import useFeedbackCache from 'sentry/components/feedback/useFeedbackCache';
import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import {useQueryClient} from 'sentry/utils/queryClient';

export default function useRefetchFeedbackList() {
  const queryClient = useQueryClient();
  const {listQueryKey, resetListHeadTime} = useFeedbackQueryKeys();
  const {invalidateListCache} = useFeedbackCache();

  const refetchFeedbackList = useCallback(() => {
    queryClient.invalidateQueries({queryKey: listQueryKey});
    resetListHeadTime();
    invalidateListCache();
  }, [queryClient, listQueryKey, resetListHeadTime, invalidateListCache]);

  return {refetchFeedbackList};
}
