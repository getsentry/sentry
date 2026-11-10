import {useMutation, useQueryClient} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import type {IssueAttachment} from 'sentry/types/group';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';

import {
  fetchGroupEventAttachmentsApiOptions,
  type FetchGroupEventAttachmentsApiOptionsParams,
} from './useGroupEventAttachments';

type DeleteGroupEventAttachmentVariables = FetchGroupEventAttachmentsApiOptionsParams & {
  attachment: IssueAttachment;
  projectSlug: string;
};

type DeleteGroupEventAttachmentContext = {
  previous?: ApiResponse<IssueAttachment[]>;
};

export function useDeleteGroupEventAttachment() {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    RequestError,
    DeleteGroupEventAttachmentVariables,
    DeleteGroupEventAttachmentContext
  >({
    mutationFn: variables =>
      fetchMutation({
        url: getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/attachments/$attachmentId/',
          {
            path: {
              organizationIdOrSlug: variables.orgSlug,
              projectIdOrSlug: variables.projectSlug,
              eventId: variables.attachment.event_id,
              attachmentId: variables.attachment.id,
            },
          }
        ),
        method: 'DELETE',
      }),
    onMutate: async variables => {
      const {queryKey} = fetchGroupEventAttachmentsApiOptions(variables);

      await queryClient.cancelQueries({queryKey});

      const previous = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, oldData => {
        if (!oldData) {
          return oldData;
        }

        return {
          ...oldData,
          json: oldData.json.filter(
            oldAttachment => oldAttachment.id !== variables.attachment.id
          ),
        };
      });

      return {previous};
    },
    onSuccess: () => {
      toast.success(t('Attachment deleted'));
    },
    onError: (error, variables, context) => {
      const detail = error?.responseJSON?.detail;
      toast.error(
        typeof detail === 'string'
          ? detail
          : t('An error occurred while deleting the attachment')
      );

      if (context) {
        const {queryKey} = fetchGroupEventAttachmentsApiOptions(variables);
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
  });
}
