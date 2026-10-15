import {mutationOptions} from '@tanstack/react-query';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {GroupStore} from 'sentry/stores/groupStore';
import {IssueListCacheStore} from 'sentry/stores/IssueListCacheStore';
import {apiFetch} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {uniqueId} from 'sentry/utils/guid';
import type {useNavigate} from 'sentry/utils/useNavigate';

type DiscardIssueVariables = {
  groupId: string;
  orgSlug: string;
  projectId: string;
};

export function discardIssueMutationOptions({
  navigate,
}: {
  navigate: ReturnType<typeof useNavigate>;
}) {
  return mutationOptions({
    mutationFn: (variables: DiscardIssueVariables) =>
      apiFetch({
        queryKey: [
          getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/', {
            path: {
              organizationIdOrSlug: variables.orgSlug,
              issueId: String(variables.groupId),
            },
          }),
          {method: 'PUT', data: {discard: true}},
        ],
      }),
    onMutate: variables => {
      const changeId = uniqueId();
      addLoadingMessage(t('Discarding event\u2026'));
      GroupStore.onDiscard(changeId, variables.groupId);
      IssueListCacheStore.reset();
      return {changeId};
    },
    onSuccess: (_, variables, onMutateResult) => {
      GroupStore.onDiscardSuccess(onMutateResult.changeId, variables.groupId, undefined);
      navigate({
        pathname: `/organizations/${variables.orgSlug}/issues/`,
        query: {project: variables.projectId},
      });
    },
    onError: (error, variables, onMutateResult) => {
      if (onMutateResult) {
        GroupStore.onDiscardError(onMutateResult.changeId, variables.groupId, error);
      }
    },
    onSettled: () => {
      clearIndicators();
    },
  });
}
