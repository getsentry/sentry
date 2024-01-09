import {useCallback} from 'react';

import useFeedbackCache from 'sentry/components/feedback/useFeedbackCache';
import type {Group, GroupActivity, Organization} from 'sentry/types';
import {NoteType} from 'sentry/types/alerts';
import {fetchMutation, MutateOptions, useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type TPayload = {activity: GroupActivity[]; note?: NoteType; noteId?: string};
type TMethod = 'PUT' | 'POST' | 'DELETE';
export type TData = unknown;
export type TError = unknown;
export type TVariables = [TPayload, TMethod];
export type TContext = unknown;

interface Props {
  group: Group;
  organization: Organization;
}

export default function useMutateFeedbackActivity({organization, group}: Props) {
  const api = useApi({
    persistInFlight: false,
  });
  const {updateCached, invalidateCached} = useFeedbackCache();

  const mutation = useMutation<TData, TError, TVariables, TContext>({
    onMutate: ([{activity}, _method]) => {
      updateCached([group.id], {activity});
    },
    mutationFn: ([{note, noteId}, method]) => {
      const url =
        method === 'PUT' || method === 'DELETE'
          ? `/organizations/${organization.slug}/issues/${group.id}/comments/${noteId}/`
          : `/organizations/${organization.slug}/issues/${group.id}/comments/`;

      return fetchMutation(api)([
        method,
        url,
        {},
        {text: note?.text, mentions: note?.mentions},
      ]);
    },
    onSettled: (_resp, _error, _var, _context) => {
      invalidateCached([group.id]);
    },
    cacheTime: 0,
  });

  const updateComment = useCallback(
    (
      note: NoteType,
      noteId: string,
      activity: GroupActivity[],
      options?: MutateOptions<TData, TError, TVariables, TContext>
    ) => {
      mutation.mutate([{note, noteId, activity}, 'PUT'], options);
    },
    [mutation]
  );

  const addComment = useCallback(
    (
      note: NoteType,
      activity: GroupActivity[],
      options?: MutateOptions<TData, TError, TVariables, TContext>
    ) => {
      mutation.mutate([{note, activity}, 'POST'], options);
    },
    [mutation]
  );

  const deleteComment = useCallback(
    (
      noteId: string,
      activity: GroupActivity[],
      options?: MutateOptions<TData, TError, TVariables, TContext>
    ) => {
      mutation.mutate([{noteId, activity}, 'DELETE'], options);
    },
    [mutation]
  );

  return {
    addComment,
    deleteComment,
    updateComment,
  };
}
