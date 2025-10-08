import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CodeBlock} from 'sentry/components/core/code';
import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {DebugNotificationsPreview} from 'sentry/debug/notifications/components/debugNotificationsPreview';
import {
  NotificationProviderKey,
  type NotificationTemplateRegistration,
} from 'sentry/debug/notifications/types';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';

const SLACK_PREVIEW_BASE_URL = 'https://app.slack.com/block-kit-builder/';

export function SlackPreview({
  registration,
}: {
  registration: NotificationTemplateRegistration;
}) {
  const blocks = registration.previews[NotificationProviderKey.SLACK];
  const previewLink = `${SLACK_PREVIEW_BASE_URL}#${JSON.stringify(blocks)}`;
  return (
    <DebugNotificationsPreview
      title="Slack"
      actions={
        <LinkButton
          to={previewLink}
          size="xs"
          icon={<PluginIcon pluginId="slack" size={24} />}
          target="_blank"
        >
          BlockKit Builder
        </LinkButton>
      }
    >
      <Container border="primary" radius="md">
        <Flex direction="column" padding="xl" align="start" gap="xl">
          <Text>
            Below is the BlockKit JSON payload that will be sent to Slack. To preview it,
            use the builder link above.
          </Text>
          <CodeBlock language="json">
            {blocks ? JSON.stringify(blocks, null, 2) : ''}
          </CodeBlock>
        </Flex>
      </Container>
    </DebugNotificationsPreview>
  );
}
