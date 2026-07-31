import {useCallback} from 'react';
import {useMutation, useQueryClient, type MutateOptions} from '@tanstack/react-query';

import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {groupQueryKey} from 'sentry/views/issueDetails/useGroup';

type TPayload = {note?: NoteType; noteId?: string};
type TMethod = 'PUT' | 'POST' | 'DELETE';
type TData = GroupActivity;
type TError = RequestError;
type TVariables = [TPayload, TMethod];

type DeleteCommentCallback = (
  noteId: string,
  options?: MutateOptions<TData, TError, TVariables>
) => Promise<TData>;

type CreateCommentCallback = (
  note: NoteType,
  options?: MutateOptions<TData, TError, TVariables>
) => Promise<TData>;

type UpdateCommentCallback = (
  note: NoteType,
  noteId: string,
  options?: MutateOptions<TData, TError, TVariables>
) => Promise<TData>;

interface Props {
  group: Group;
  organization: Organization;
}

export function useMutateActivity({organization, group}: Props) {
  const queryClient = useQueryClient();

  const queryKey = groupQueryKey({
    organizationSlug: organization.slug,
    groupId: group.id,
  });

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
    onSuccess: (result, [{noteId}, method]) => {
      queryClient.setQueriesData<ApiResponse<Group>>(
        {queryKey},
        (prev): ApiResponse<Group> | undefined => {
          if (!prev) {
            return prev;
          }

          const makeUpdatedGroupData = ({
            activity,
            numComments,
          }: {
            activity: GroupActivity[];
            numComments: number;
          }): ApiResponse<Group> => {
            return {
              ...prev,
              json: {...prev.json, activity, numComments},
            };
          };

          if (method === 'POST') {
            return makeUpdatedGroupData({
              activity: [result, ...prev.json.activity],
              numComments: prev.json.numComments + 1,
            });
          }
          if (method === 'PUT') {
            return makeUpdatedGroupData({
              activity: prev.json.activity.map(item =>
                item.id === result.id && item.type === GroupActivityType.NOTE
                  ? {...item, data: {...item.data, ...result.data}}
                  : item
              ),
              numComments: prev.json.numComments,
            });
          }
          if (method === 'DELETE') {
            return makeUpdatedGroupData({
              activity: prev.json.activity.filter(item => item.id !== noteId),
              numComments: prev.json.numComments - 1,
            });
          }

          return prev;
        }
      );
    },
    gcTime: 0,
  });

  const handleUpdate = useCallback<UpdateCommentCallback>(
    (note, noteId, options) => {
      return mutateAsync([{note, noteId}, 'PUT'], options);
    },
    [mutateAsync]
  );

  const handleCreate = useCallback<CreateCommentCallback>(
    (note, options) => {
      return mutateAsync([{note}, 'POST'], options);
    },
    [mutateAsync]
  );

  const handleDelete = useCallback<DeleteCommentCallback>(
    (noteId, options) => {
      return mutateAsync([{noteId}, 'DELETE'], options);
    },
    [mutateAsync]
  );

  return {
    handleUpdate,
    handleCreate,
    handleDelete,
  };
}
