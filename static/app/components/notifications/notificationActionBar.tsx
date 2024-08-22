import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import type {NotificationHistory} from 'sentry/types/notifications';

export function NotificationActionBar({}: {notification: NotificationHistory}) {
  return (
    <ButtonBar gap={1}>
      <Button size="sm">Approve</Button>
      <Button size="sm">Deny</Button>
    </ButtonBar>
  );
}
