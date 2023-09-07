import {useEffect, useState} from 'react';

import hydrateFeedbackRecord from 'sentry/components/feedback/hydrateFeedbackRecord';
import {exampleListResponse} from 'sentry/utils/feedback/example';
import {
  FeedbackListQueryParams,
  FeedbackListResponse,
  HydratedFeedbackList,
} from 'sentry/utils/feedback/types';
import type {UseApiQueryOptions} from 'sentry/utils/queryClient';

type MockState = {
  data: undefined | FeedbackListResponse;
  isError: false;
  isLoading: boolean;
};

export default function useFetchFeedbackList(
  _params: FeedbackListQueryParams,
  _options: Partial<UseApiQueryOptions<HydratedFeedbackList>> = {}
) {
  // Mock some state to simulate `useApiQuery` while the backend is being constructed
  const [state, setState] = useState<MockState>({
    isLoading: true,
    isError: false,
    data: undefined,
  });

  useEffect(() => {
    setState({
      isLoading: false,
      isError: false,
      data: exampleListResponse,
    });
  }, []);

  return {
    ...state,
    data: state.data?.map(hydrateFeedbackRecord),
  };
}
