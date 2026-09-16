import {useMutation, useQueryClient} from '@tanstack/react-query';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {IssueAttachment} from 'sentry/types/group';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';

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
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    RequestError,
    DeleteGroupEventAttachmentVariables,
    DeleteGroupEventAttachmentContext
  >({
    mutationFn: variables =>
      api.requestPromise(
        getApiUrl(
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
        {
          method: 'DELETE',
        }
      ),
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
      addSuccessMessage(t('Attachment deleted'));
    },
    onError: (error, variables, context) => {
      addErrorMessage(
        error?.responseJSON?.detail
          ? (error.responseJSON.detail as string)
          : t('An error occurred while deleting the attachment')
      );

      if (context) {
        const {queryKey} = fetchGroupEventAttachmentsApiOptions(variables);
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
  });
}
