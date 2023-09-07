import {useEffect, useState} from 'react';

import hydrateFeedbackRecord from 'sentry/components/feedback/hydrateFeedbackRecord';
import {exampleItemResponse} from 'sentry/utils/feedback/example';
import {FeedbackItemResponse, HydratedFeedbackItem} from 'sentry/utils/feedback/types';
import type {UseApiQueryOptions} from 'sentry/utils/queryClient';

type MockState = {
  data: undefined | FeedbackItemResponse;
  isError: false;
  isLoading: boolean;
};

export default function useFetchFeedbackItem(
  _params: {},
  _options: Partial<UseApiQueryOptions<HydratedFeedbackItem>> = {}
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
      data: exampleItemResponse,
    });
  }, []);

  return {
    ...state,
    data: state.data ? hydrateFeedbackRecord(state.data) : undefined,
  };
}
