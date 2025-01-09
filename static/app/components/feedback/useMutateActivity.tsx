import {useCallback} from 'react';

import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {MutateOptions} from 'sentry/utils/queryClient';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

type TPayload = {activity: GroupActivity[]; note?: NoteType; noteId?: string};
type TMethod = 'PUT' | 'POST' | 'DELETE';
export type TData = GroupActivity;
export type TError = RequestError;
export type TVariables = [TPayload, TMethod];
export type TContext = unknown;

export type DeleteCommentCallback = (
  noteId: string,
  activity: GroupActivity[],
  options?: MutateOptions<TData, TError, TVariables, TContext>
) => void;

export type CreateCommentCallback = (
  note: NoteType,
  activity: GroupActivity[],
  options?: MutateOptions<TData, TError, TVariables, TContext>
) => void;

export type UpdateCommentCallback = (
  note: NoteType,
  noteId: string,
  activity: GroupActivity[],
  options?: MutateOptions<TData, TError, TVariables, TContext>
) => void;

interface Props {
  group: Group;
  organization: Organization;
  onMutate?: (variables: TVariables) => unknown | undefined;
  onSettled?:
    | ((
        data: unknown,
        error: unknown,
        variables: TVariables,
        context: unknown
      ) => unknown)
    | undefined;
}

export default function useMutateActivity({
  organization,
  group,
  onMutate,
  onSettled,
}: Props) {
  const api = useApi({
    persistInFlight: false,
  });

  const mutation = useMutation<TData, TError, TVariables, TContext>({
    onMutate: onMutate ?? undefined,
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
    onSettled: onSettled ?? undefined,
    gcTime: 0,
  });

  const handleUpdate = useCallback<UpdateCommentCallback>(
    (note, noteId, activity, options) => {
      mutation.mutate([{note, noteId, activity}, 'PUT'], options);
    },
    [mutation]
  );

  const handleCreate = useCallback<CreateCommentCallback>(
    (note, activity, options) => {
      mutation.mutate([{note, activity}, 'POST'], options);
    },
    [mutation]
  );

  const handleDelete = useCallback<DeleteCommentCallback>(
    (noteId, activity, options) => {
      mutation.mutate([{noteId, activity}, 'DELETE'], options);
    },
    [mutation]
  );

  return {
    handleUpdate,
    handleCreate,
    handleDelete,
  };
}
