import {useCallback} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {GroupStatus, Organization} from 'sentry/types';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

interface Props {
  feedbackId: string;
  organization: Organization;
  refetchIssue: () => void;
}

type QueryKeyEndpointOptions = {
  headers?: Record<string, string>;
  query?: Record<string, any>;
};
type ApiMutationVariables =
  | ['PUT' | 'POST' | 'DELETE', string]
  | ['PUT' | 'POST' | 'DELETE', string, QueryKeyEndpointOptions]
  | ['PUT' | 'POST', string, QueryKeyEndpointOptions, Record<string, unknown>];
type TData = unknown;
type TError = unknown;
type TVariables = ApiMutationVariables;
type TContext = unknown;

export default function useFeedbackItem({feedbackId, organization, refetchIssue}: Props) {
  const api = useApi();
  // const queryClient = useQueryClient();

  const mutation = useMutation<TData, TError, TVariables, TContext>({
    onMutate: (_variables: TVariables) => {
      addLoadingMessage(t('Updating feedback...'));
      // const [, , , data] = variables;
      // setApiQueryData(
      //   queryClient,
      //   feedbackItemQueryKey(organization, feedbackId),
      //   (feedbackItem: FeedbackItemResponse) => ({...feedbackItem, ...data})
      // );
    },
    mutationFn: async (variables: ApiMutationVariables) => {
      const [method, url, opts, data] = variables;
      return await api.requestPromise(url, {
        method,
        query: opts?.query,
        headers: opts?.headers,
        data,
      });
    },
    onError: () => {
      addErrorMessage(t('An error occurred while updating the feedback.'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Updated feedback'));
    },
    onSettled: () => {
      refetchIssue();
    },
    cacheTime: 0,
  });

  const url = `/organizations/${organization.slug}/issues/${feedbackId}/`;

  const markAsRead = useCallback(
    (hasSeen: boolean) => {
      mutation.mutate(['PUT', url, {}, {hasSeen}]);
    },
    [mutation, url]
  );

  const resolve = useCallback(
    (status: GroupStatus) => {
      mutation.mutate(['PUT', url, {}, {status}]);
    },
    [mutation, url]
  );

  return {
    markAsRead,
    resolve,
  };
}
