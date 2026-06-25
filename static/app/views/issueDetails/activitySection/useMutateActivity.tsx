import {useCallback} from 'react';
import {useMutation, type MutateOptions} from '@tanstack/react-query';

import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';

type TPayload = {activity: GroupActivity[]; note?: NoteType; noteId?: string};
type TMethod = 'PUT' | 'POST' | 'DELETE';
type TData = GroupActivity;
type TError = RequestError;
type TVariables = [TPayload, TMethod];

type DeleteCommentCallback = (
  noteId: string,
  activity: GroupActivity[],
  options?: MutateOptions<TData, TError, TVariables>
) => Promise<TData>;

type CreateCommentCallback = (
  note: NoteType,
  activity: GroupActivity[],
  options?: MutateOptions<TData, TError, TVariables>
) => Promise<TData>;

type UpdateCommentCallback = (
  note: NoteType,
  noteId: string,
  activity: GroupActivity[],
  options?: MutateOptions<TData, TError, TVariables>
) => Promise<TData>;

interface Props {
  group: Group;
  organization: Organization;
}

export function useMutateActivity({organization, group}: Props) {
  const {mutateAsync} = useMutation<TData, TError, TVariables>({
    mutationFn: ([{note, noteId}, method]) => {
      const url =
        method === 'PUT' || method === 'DELETE'
          ? `/organizations/${organization.slug}/issues/${group.id}/comments/${noteId}/`
          : `/organizations/${organization.slug}/issues/${group.id}/comments/`;

      return fetchMutation({
        method,
        url,
        options: {},
        data: {text: note?.text, mentions: note?.mentions},
      });
    },
    gcTime: 0,
  });

  const handleUpdate = useCallback<UpdateCommentCallback>(
    (note, noteId, activity, options) => {
      return mutateAsync([{note, noteId, activity}, 'PUT'], options);
    },
    [mutateAsync]
  );

  const handleCreate = useCallback<CreateCommentCallback>(
    (note, activity, options) => {
      return mutateAsync([{note, activity}, 'POST'], options);
    },
    [mutateAsync]
  );

  const handleDelete = useCallback<DeleteCommentCallback>(
    (noteId, activity, options) => {
      return mutateAsync([{noteId, activity}, 'DELETE'], options);
    },
    [mutateAsync]
  );

  return {
    handleUpdate,
    handleCreate,
    handleDelete,
  };
}
