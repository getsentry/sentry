import type {NotificationHistory} from 'sentry/types/notifications';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import {useUser} from 'sentry/utils/useUser';

interface UserInAppNotificationParams {
  userId: string;
}

const POLL_MS = 3000;

export const makeUserInAppNotificationsKey = ({
  userId,
}: UserInAppNotificationParams): ApiQueryKey => [
  `/users/${userId}/notifications/history/`,
];

export function useUserInAppNotifications(
  params?: Partial<UserInAppNotificationParams>,
  options: Partial<UseApiQueryOptions<NotificationHistory[]>> = {}
) {
  const user = useUser();
  return useApiQuery<NotificationHistory[]>(
    makeUserInAppNotificationsKey({userId: params?.userId ?? user.id}),
    {
      staleTime: POLL_MS,
      refetchInterval: POLL_MS,
      ...options,
    }
  );
}
