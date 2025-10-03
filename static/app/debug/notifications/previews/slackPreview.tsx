import {Link} from 'sentry/components/core/link';
import {DebugNotificationsPreview} from 'sentry/debug/notifications/components/debugNotificationsPreview';
import {
  NotificationProviderKey,
  type NotificationTemplateRegistration,
} from 'sentry/debug/notifications/types';

export function SlackPreview({
  registration,
}: {
  registration: NotificationTemplateRegistration;
}) {
  const slackBlockKitBuilderBaseURL = 'https://app.slack.com/block-kit-builder/#';

  const blocks = JSON.stringify(registration.previews[NotificationProviderKey.SLACK]);
  const blockKitPreviewLink = `${slackBlockKitBuilderBaseURL}${blocks}`;

  return (
    <DebugNotificationsPreview title="Slack">
      <Link to={blockKitPreviewLink}>Preview in Block Kit Builder</Link>
    </DebugNotificationsPreview>
  );
}
