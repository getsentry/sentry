import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import {space} from 'sentry/styles/space';
import type {
  NotificationContentAction,
  NotificationHistory,
} from 'sentry/types/notifications';
import {useNavigate} from 'sentry/utils/useNavigate';

export function NotificationActionBar({
  notification,
}: {
  notification: NotificationHistory;
}) {
  const navigate = useNavigate();
  const actions: NotificationContentAction[] = notification.content._actions ?? [];

  const buttonActions = actions.map((action, i) => (
    <Button
      key={i}
      size="xs"
      priority={action.style ?? 'default'}
      aria-label={action.label ?? action.name}
      onClick={() => {
        if (action.url) {
          navigate(action.url);
        }
        switch (action.action_id) {
          case 'approve_request':
          case 'reject_request':
          default:
            return;
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
