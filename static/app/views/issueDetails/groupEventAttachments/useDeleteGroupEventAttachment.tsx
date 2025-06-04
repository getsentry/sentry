import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {IssueAttachment} from 'sentry/types/group';
import {
  getApiQueryData,
  setApiQueryData,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

import {makeFetchGroupEventAttachmentsQueryKey} from './useGroupEventAttachments';

type DeleteGroupEventAttachmentVariables = Parameters<
  typeof makeFetchGroupEventAttachmentsQueryKey
>[0] & {
  attachment: IssueAttachment;
  projectSlug: string;
};

type DeleteGroupEventAttachmentContext = {
  previous?: IssueAttachment[];
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
        `/projects/${variables.orgSlug}/${variables.projectSlug}/events/${variables.attachment.event_id}/attachments/${variables.attachment.id}/`,
        {
          method: 'DELETE',
        }
      ),
    onMutate: async variables => {
      await queryClient.cancelQueries({
        queryKey: makeFetchGroupEventAttachmentsQueryKey(variables),
      });

      const previous = getApiQueryData<IssueAttachment[]>(
        queryClient,
        makeFetchGroupEventAttachmentsQueryKey(variables)
      );

      setApiQueryData<IssueAttachment[]>(
        queryClient,
        makeFetchGroupEventAttachmentsQueryKey(variables),
        oldData => {
          if (!Array.isArray(oldData)) {
            return oldData;
          }

          return oldData.filter(
            oldAttachment => oldAttachment.id !== variables.attachment.id
          );
        }
      );

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
        setApiQueryData(
          queryClient,
          makeFetchGroupEventAttachmentsQueryKey(variables),
          context.previous
        );
      }
    },
  });
}
