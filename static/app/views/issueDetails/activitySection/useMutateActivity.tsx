import {useMutation, useQueryClient} from '@tanstack/react-query';

import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {issueCommentsQueryOptions} from 'sentry/views/issueDetails/activitySection/issueCommentsQueryOptions';
import {groupQueryKey} from 'sentry/views/issueDetails/useGroup';

type ActivityMutation =
  | {method: 'POST'; note: NoteType}
  | {method: 'PUT'; note: NoteType; noteId: string}
  | {method: 'DELETE'; noteId: string};

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
  const activityQueryKey = [
    getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/activities/', {
      path: {organizationIdOrSlug: organization.slug, issueId: group.id},
    }),
  ];

  const {mutateAsync} = useMutation({
    mutationFn: (mutation: ActivityMutation) => {
      const url =
        'noteId' in mutation
          ? getApiUrl(
              '/organizations/$organizationIdOrSlug/issues/$issueId/comments/$noteId/',
              {
                path: {
                  organizationIdOrSlug: organization.slug,
                  issueId: group.id,
                  noteId: mutation.noteId,
                },
              }
            )
          : getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/comments/', {
              path: {
                organizationIdOrSlug: organization.slug,
                issueId: group.id,
              },
            });

      return fetchMutation<GroupActivity>({
        method: mutation.method,
        url,
        options: {},
        data:
          'note' in mutation
            ? {text: mutation.note.text, mentions: mutation.note.mentions}
            : undefined,
      });
    },
    onSuccess: (result, mutation) => {
      queryClient.setQueriesData<ApiResponse<Group>>({queryKey}, prev => {
        if (!prev) {
          return prev;
        }

        const updateGroup = (
          activity: GroupActivity[],
          numComments: number
        ): ApiResponse<Group> => ({
          ...prev,
          json: {...prev.json, activity, numComments},
        });

        switch (mutation.method) {
          case 'POST':
            return updateGroup(
              [result, ...prev.json.activity],
              prev.json.numComments + 1
            );
          case 'PUT':
            return updateGroup(
              prev.json.activity.map(item =>
                item.id === result.id && item.type === GroupActivityType.NOTE
                  ? {...item, data: {...item.data, ...result.data}}
                  : item
              ),
              prev.json.numComments
            );
          case 'DELETE':
            return updateGroup(
              prev.json.activity.filter(item => item.id !== mutation.noteId),
              prev.json.numComments - 1
            );
        }
      });

      void queryClient.invalidateQueries({
        queryKey: issueCommentsQueryOptions({
          organizationSlug: organization.slug,
          groupId: group.id,
        }).queryKey,
      });
      void queryClient.invalidateQueries({queryKey: activityQueryKey});
    },
  });

  return {
    createComment: (note: NoteType) => mutateAsync({method: 'POST', note}),
    deleteComment: (noteId: string) => mutateAsync({method: 'DELETE', noteId}),
    updateComment: (noteId: string, note: NoteType) =>
      mutateAsync({method: 'PUT', note, noteId}),
  };
}
