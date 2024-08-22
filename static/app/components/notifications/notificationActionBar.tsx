import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import {space} from 'sentry/styles/space';
import {
  type NotificationContentAction,
  type NotificationHistory,
  NotificationHistoryStatus,
} from 'sentry/types/notifications';
import useMutateInAppNotification from 'sentry/utils/useMutateInAppNotification';
import {useNavigate} from 'sentry/utils/useNavigate';

export function NotificationActionBar({
  notification,
}: {
  notification: NotificationHistory;
}) {
  const navigate = useNavigate();
  const {mutate: updateNotif} = useMutateInAppNotification({
    notifId: notification.id,
  });
  const actions: NotificationContentAction[] = notification.content._actions ?? [];
  const buttonActions = actions.map((action, i) => (
    <Button
      key={i}
      size="xs"
      priority={
        notification.status === NotificationHistoryStatus.ARCHIVED
          ? 'default'
          : action.style ?? 'default'
      }
      aria-label={action.label ?? action.name}
      onClick={() => {
        if (action.url) {
          navigate(action.url);
        }
        if (notification.status === NotificationHistoryStatus.UNREAD) {
          updateNotif({status: NotificationHistoryStatus.READ});
        }
      }}
    >
      {action.label ?? action.name}
    </Button>
  ));

  return (
    <Flex gap={space(1)} justify="left">
      {buttonActions}
    </Flex>
  );
}
