import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CodeBlock} from 'sentry/components/core/code';
import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {DebugNotificationsPreview} from 'sentry/debug/notifications/components/debugNotificationsPreview';
import {
  NotificationProviderKey,
  type NotificationTemplateRegistration,
} from 'sentry/debug/notifications/types';
import {IconCopy} from 'sentry/icons';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

const MSTEAMS_PREVIEW_URL = 'https://adaptivecards.microsoft.com/designer.html';

export function TeamsPreview({
  registration,
}: {
  registration: NotificationTemplateRegistration;
}) {
  const card = registration.previews[NotificationProviderKey.TEAMS];

  const {onClick} = useCopyToClipboard({
    text: JSON.stringify(card, null, 2),
    onCopy: () => {
      addSuccessMessage('Copied AdaptiveCard JSON');
    },
    onError: () => {
      addErrorMessage('Failed to copy AdaptiveCard JSON');
    },
  });

  return (
    <DebugNotificationsPreview
      title="MS Teams"
      actions={
        <ButtonBar>
          <Button size="xs" onClick={onClick} icon={<IconCopy />}>
            Copy JSON
          </Button>
          <LinkButton
            to={MSTEAMS_PREVIEW_URL}
            size="xs"
            icon={<PluginIcon pluginId="msteams" size={24} />}
            target="_blank"
          >
            Designer
          </LinkButton>
        </ButtonBar>
      }
    >
      <Container border="primary" radius="md">
        <Flex direction="column" padding="xl" align="start" gap="xl">
          <Text>
            Below is the AdaptiveCard JSON payload that will be sent to MS Teams. To
            preview it, copy the JSON and paste it into the Designer linked above.
          </Text>
          <CodeBlock language="json">
            {card ? JSON.stringify(card, null, 2) : ''}
          </CodeBlock>
        </Flex>
      </Container>
    </DebugNotificationsPreview>
  );
}
