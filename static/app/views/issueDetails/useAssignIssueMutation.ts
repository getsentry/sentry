import * as Sentry from '@sentry/react';
import {useQueryClient} from '@tanstack/react-query';

import GroupStore from 'sentry/stores/groupStore';
import type {Actor} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';
import {buildTeamId, buildUserId} from 'sentry/utils';
import {uniqueId} from 'sentry/utils/guid';
import {
  fetchMutation,
  setApiQueryData,
  useMutation,
  type UseMutationOptions,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {makeFetchGroupQueryKey} from 'sentry/views/issueDetails/useGroup';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

export type AssignedBy = 'suggested_assignee' | 'assignee_selector';

type AssignIssueVariables = {
  actor: Pick<Actor, 'id' | 'type'> | null;
  groupId: string;
  orgSlug: string;
  assignedBy?: AssignedBy;
};

type AssignIssueContext = {
  changeId: string;
};

function makeActorId(actor: Pick<Actor, 'id' | 'type'>) {
  switch (actor.type) {
    case 'user':
      return buildUserId(actor.id);
    case 'team':
      return buildTeamId(actor.id);
    default:
      Sentry.withScope(scope => {
        scope.setExtra('actor', actor);
        Sentry.captureException('Unknown assignee type');
      });
      return '';
  }
}

export function useAssignIssueMutation(
  options: Omit<
    UseMutationOptions<Group, RequestError, AssignIssueVariables, AssignIssueContext>,
    'mutationFn'
  > = {}
) {
  const queryClient = useQueryClient();
  const environments = useEnvironmentsFromUrl();

  return useMutation<Group, RequestError, AssignIssueVariables, AssignIssueContext>({
    ...options,
    mutationFn: variables => {
      const actorId = variables.actor ? makeActorId(variables.actor) : '';
      return fetchMutation<Group>({
        method: 'PUT',
        url: `/organizations/${variables.orgSlug}/issues/${variables.groupId}/`,
        data: {
          assignedTo: actorId,
          assignedBy: variables.assignedBy,
        },
      });
    },
    onMutate: async variables => {
      const changeId = uniqueId();
      // TODO: Remove this when we no longer rely on GroupStore for updates
      GroupStore.onAssignTo(changeId, variables.groupId, {email: ''});
      await options.onMutate?.(variables);
      return {changeId};
    },
    onSuccess: (response, variables, context) => {
      // Update react query cache so that useGroup() reflects the new assignee
      setApiQueryData<Group>(
        queryClient,
        makeFetchGroupQueryKey({
          organizationSlug: variables.orgSlug,
          groupId: variables.groupId,
          environments,
        }),
        prev => (prev ? {...prev, assignedTo: response.assignedTo} : prev)
      );
      // Dual-write to GroupStore
      // TODO: Remove this when we no longer rely on GroupStore for updates
      GroupStore.onAssignToSuccess(context.changeId, variables.groupId, response);
      options.onSuccess?.(response, variables, context);
    },
    onError: (error, variables, context) => {
      // TODO: Remove this when we no longer rely on GroupStore for updates
      // This will show an alert to the user, remember to replace that functionality
      if (context) {
        GroupStore.onAssignToError(context.changeId, variables.groupId, error);
      }
      options.onError?.(error, variables, context);
    },
  });
}
