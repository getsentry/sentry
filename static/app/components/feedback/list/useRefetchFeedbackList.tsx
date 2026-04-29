import {useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {useFeedbackApiOptions} from 'sentry/components/feedback/useFeedbackApiOptions';
import {useFeedbackCache} from 'sentry/components/feedback/useFeedbackCache';

export function useRefetchFeedbackList() {
  const queryClient = useQueryClient();
  const {listApiOptions, resetListHeadTime} = useFeedbackApiOptions();
  const {invalidateListCache} = useFeedbackCache();

  const refetchFeedbackList = useCallback(() => {
    queryClient.invalidateQueries({queryKey: listApiOptions.queryKey});
    resetListHeadTime();
    invalidateListCache();
  }, [queryClient, listApiOptions, resetListHeadTime, invalidateListCache]);

  return {refetchFeedbackList};
}
