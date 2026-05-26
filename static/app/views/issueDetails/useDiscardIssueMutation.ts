import {useMutation, type UseMutationOptions} from '@tanstack/react-query';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {GroupStore} from 'sentry/stores/groupStore';
import {IssueListCacheStore} from 'sentry/stores/IssueListCacheStore';
import {uniqueId} from 'sentry/utils/guid';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';

type DiscardIssueVariables = {
  groupId: string;
  orgSlug: string;
  projectId: string;
};

type DiscardIssueContext = {
  changeId: string;
};

export function useDiscardIssueMutation(
  options: Omit<
    UseMutationOptions<unknown, RequestError, DiscardIssueVariables, DiscardIssueContext>,
    'mutationFn'
  > = {}
) {
  const navigate = useNavigate();

  return useMutation<unknown, RequestError, DiscardIssueVariables, DiscardIssueContext>({
    ...options,
    mutationFn: variables =>
      fetchMutation({
        method: 'PUT',
        url: `/issues/${variables.groupId}/`,
        data: {discard: true},
      }),
    onMutate: async (variables, context) => {
      const changeId = uniqueId();
      addLoadingMessage(t('Discarding event\u2026'));
      GroupStore.onDiscard(changeId, variables.groupId);
      IssueListCacheStore.reset();
      await options.onMutate?.(variables, context);
      return {changeId};
    },
    onSuccess: (_, variables, onMutateResult, context) => {
      GroupStore.onDiscardSuccess(onMutateResult.changeId, variables.groupId, undefined);
      navigate({
        pathname: `/organizations/${variables.orgSlug}/issues/`,
        query: {project: variables.projectId},
      });
      options.onSuccess?.(_, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      if (onMutateResult) {
        GroupStore.onDiscardError(onMutateResult.changeId, variables.groupId, error);
      }
      options.onError?.(error, variables, onMutateResult, context);
    },
    onSettled: (data, error, variables, onMutateResult, context) => {
      clearIndicators();
      options.onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}
