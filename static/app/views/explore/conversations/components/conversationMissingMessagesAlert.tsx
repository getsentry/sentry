import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Prose} from '@sentry/scraps/text';

import {IconCopy} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AI_INSTRUMENTATION_DOCS_LINKS} from 'sentry/views/insights/pages/agents/utils/docsLinks';

const CAPTURE_MESSAGES_PROMPT = `
> Sentry AI agent monitoring is already instrumented in this app, but the conversation input and output messages are not being recorded, so the Sentry Conversations view is empty.
> Update the existing Sentry configuration to capture gen_ai message content (prompts and responses): in Python set \`send_default_pii=True\` in \`sentry_sdk.init(...)\`, and in JavaScript/Node set \`sendDefaultPii: true\` in \`Sentry.init(...)\`.
> If the app has multi-turn chats, also set a conversation ID per chat so Sentry receives the gen_ai.conversation.id attribute.

# Capture Sentry AI Agent Conversation Messages

Use these skills as the source of truth:

## Skill References

- Source repository: https://github.com/getsentry/sentry-for-ai
- Agent-monitoring skill: https://skills.sentry.dev/sentry-setup-ai-monitoring/SKILL.md
`;

function CopyCaptureMessagesPromptButton() {
  const {copy} = useCopyToClipboard();
  const organization = useOrganization();

  return (
    <Button
      size="sm"
      icon={<IconCopy />}
      onClick={() => {
        trackAnalytics('agent-monitoring.copy-llm-prompt-click', {organization});
        copy(CAPTURE_MESSAGES_PROMPT, {
          successMessage: t('Copied instrumentation prompt to clipboard'),
        });
      }}
    >
      {t('Copy Prompt for AI Agent')}
    </Button>
  );
}

export function ConversationMissingMessagesAlert() {
  return (
    <Alert.Container>
      <Alert variant="info">
        <Stack direction="column" gap="md" paddingTop="2xs">
          <Heading as="h4" variant="accent">
            {t('Capture Your Conversation Messages')}
          </Heading>
          <Prose>
            {t(
              'These conversations are missing their input and output. Make sure message capture is enabled in your SDK so you can see the messages in each conversation.'
            )}
          </Prose>
          <Prose>
            {tct(
              'See the [pythonLink:Python] or [javascriptLink:JavaScript] instrumentation docs for details, or let an AI agent set it up.',
              {
                pythonLink: <ExternalLink href={AI_INSTRUMENTATION_DOCS_LINKS.python} />,
                javascriptLink: (
                  <ExternalLink href={AI_INSTRUMENTATION_DOCS_LINKS.javascript} />
                ),
              }
            )}
          </Prose>
          <Stack direction="row" paddingTop="xs" justify="start">
            <CopyCaptureMessagesPromptButton />
          </Stack>
        </Stack>
      </Alert>
    </Alert.Container>
  );
}
