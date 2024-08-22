import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import {space} from 'sentry/styles/space';
import {
  type NotificationContentAction,
  type NotificationHistory,
  NotificationHistoryStatus,
} from 'sentry/types/notifications';
import {useNavigate} from 'sentry/utils/useNavigate';

export function NotificationActionBar({
  notification,
}: {
  notification: NotificationHistory;
}) {
  const navigate = useNavigate();
  const actions: NotificationContentAction[] = notification.content._actions ?? [];
  const isArchived = notification.status === NotificationHistoryStatus.ARCHIVED;

  const buttonActions = actions.map((action, i) => (
    <Button
      key={i}
      size="xs"
      priority={isArchived ? 'default' : action.style ?? 'default'}
      aria-label={action.label ?? action.name}
      onClick={() => {
        if (action.url) {
          navigate(action.url);
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
