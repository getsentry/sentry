import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, type ContainerProps} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {IconClose, IconCopy} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {useOrganization} from 'sentry/utils/useOrganization';

const CAPTURE_MESSAGES_PROMPT = `
> Sentry AI agent monitoring is already instrumented in this app, but the conversation input and output messages are not being recorded, so the Sentry Conversations view is empty.
> Update the existing Sentry configuration so gen_ai input and output messages (prompts and responses) are captured:
>   1. Enable PII so message content is recorded: in Python set \`send_default_pii=True\` in \`sentry_sdk.init(...)\`; in JavaScript/Node set \`sendDefaultPii: true\` in \`Sentry.init(...)\`.
>   2. If you use an SDK agent integration (e.g. OpenAI, Anthropic, LangChain, Vercel AI SDK), make sure its input/output recording options are enabled — some integrations gate message capture behind options like \`include_prompts\` / \`recordInputs\` / \`recordOutputs\` even when PII is on.
>   3. If your agents are instrumented manually, make sure the input and output messages are explicitly set on the spans (the gen_ai request/response message attributes) so they show up in Conversations.

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
      size="xs"
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

interface ConversationMissingMessagesAlertProps {
  /**
   * Scopes the dismissal, so each page that shows the banner can be dismissed
   * independently.
   */
  dismissKey: string;
  docsLink: string;
  /**
   * Spacing around the banner. Applied here rather than by the caller, so it
   * goes away together with the banner once it is dismissed.
   */
  padding?: ContainerProps['padding'];
  /**
   * Whether the banner describes a single conversation or the conversations
   * listed on the page.
   */
  plural?: boolean;
}

/**
 * Shown when conversations captured no input or output messages. Points to
 * the docs for enabling input/output capture and offers a prompt that lets an
 * AI agent set it up. Dismissible, since leaving capture disabled can be
 * intentional.
 */
export function ConversationMissingMessagesAlert({
  dismissKey,
  docsLink,
  padding,
  plural = false,
}: ConversationMissingMessagesAlertProps) {
  const organization = useOrganization();
  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:${dismissKey}`,
  });

  if (isDismissed) {
    return null;
  }

  const link = <ExternalLink href={docsLink} />;

  return (
    <Container padding={padding}>
      <Alert
        variant="muted"
        trailingItems={
          <Flex align="center" gap="md">
            <CopyCaptureMessagesPromptButton />
            <Button
              aria-label={t('Dismiss banner')}
              icon={<IconClose />}
              onClick={dismiss}
              size="zero"
              variant="transparent"
            />
          </Flex>
        }
      >
        {plural
          ? tct(
              "These conversations' inputs and outputs weren't captured. [link:Enable capturing inputs and outputs] in your SDK to see the messages here.",
              {link}
            )
          : tct(
              "This conversation's inputs and outputs weren't captured. [link:Enable capturing inputs and outputs] in your SDK to see the messages here.",
              {link}
            )}
      </Alert>
    </Container>
  );
}
