import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {makeUserInAppNotificationsKey} from 'sentry/components/notifications/useUserInAppNotifications';
import {t} from 'sentry/locale';
import type {NotificationHistory} from 'sentry/types/notifications';
import {setApiQueryData, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

interface MutateInAppNotificationPayload {
  status: 'unread' | 'read' | 'archived';
}

interface UseMutateInAppNotificationProps {
  notifId: string;
  onError?: (error: RequestError) => void;
  onSuccess?: (notification: NotificationHistory) => void;
}

export default function useMutateInAppNotification({
  notifId,
  onSuccess,
  onError,
}: UseMutateInAppNotificationProps) {
  const api = useApi({persistInFlight: false});
  const queryClient = useQueryClient();
  return useMutation<NotificationHistory, RequestError, MutateInAppNotificationPayload>({
    mutationFn: data =>
      api.requestPromise(`/notifications/history/${notifId}/`, {
        method: 'PUT',
        data,
      }),
    onSuccess: (updatedNotif: NotificationHistory) => {
      if (updatedNotif.user_id) {
        setApiQueryData<NotificationHistory[]>(
          queryClient,
          makeUserInAppNotificationsKey({userId: `${updatedNotif.user_id}`}),
          existingData => {
            if (!updatedNotif) {
              return existingData;
            }
            const matchingNotifIndex = existingData.findIndex(
              n => n.id === updatedNotif.id
            );
            if (matchingNotifIndex === -1) {
              return existingData;
            }
            return [
              ...existingData.slice(0, matchingNotifIndex),
              updatedNotif,
              ...existingData.slice(matchingNotifIndex + 1),
            ];
          }
        );
      }
      return onSuccess?.(updatedNotif);
    },
    onError: error => {
      addErrorMessage(t('Failed to update notification'));
      return onError?.(error);
    },
  });
}
