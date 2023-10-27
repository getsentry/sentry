import {useCallback} from 'react';
import first from 'lodash/first';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import getFeedbackItemQueryKey from 'sentry/components/feedback/getFeedbackItemQueryKey';
import {t} from 'sentry/locale';
import {GroupStatus, Organization} from 'sentry/types';
import {FeedbackIssue} from 'sentry/utils/feedback/types';
import {
  fetchMutation,
  setApiQueryData,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

interface Props {
  feedbackIds: string[];
  organization: Organization;
  refetchIssue: () => void;
}

type TData = {hasSeen: boolean} | {status: GroupStatus};
type TError = unknown;
type TOptions = [string[], TData];
type TContext = unknown;

export default function useBulkMutateFeedback({
  feedbackIds,
  organization,
  refetchIssue,
}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();

  const mutation = useMutation<TData, TError, TOptions, TContext>({
    onMutate: variables => {
      addLoadingMessage(t('Updating feedback...'));

      const [ids, data] = variables;
      const queryKeysForIds = ids.map(feedbackId =>
        getFeedbackItemQueryKey({feedbackId, organization})
      );

      if (queryKeysForIds.length) {
        queryKeysForIds.forEach(queryKeys => {
          if (queryKeys.issueQueryKey) {
            setApiQueryData(
              queryClient,
              queryKeys.issueQueryKey,
              (feedbackIssue: FeedbackIssue) => ({
                ...feedbackIssue,
                ...data,
              })
            );
          }
        });
      }
    },
    mutationFn: variables => {
      const [ids, data] = variables;
      const url =
        ids.length === 1
          ? `/organizations/${organization.slug}/issues/${first(ids)}/`
          : `/organizations/${organization.slug}/issues/`;

      const options = {};
      return fetchMutation(api)(['PUT', url, options, data]);
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

  const markAsRead = useCallback(
    (hasSeen: boolean) => {
      mutation.mutate([feedbackIds, {hasSeen}]);
    },
    [mutation, feedbackIds]
  );

  const resolve = useCallback(
    (status: GroupStatus) => {
      mutation.mutate([feedbackIds, {status}]);
    },
    [mutation, feedbackIds]
  );

  return {
    markAsRead,
    resolve,
  };
}
