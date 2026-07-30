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
> Update the existing Sentry configuration so gen_ai input and output messages (prompts and responses) are captured:
>   1. Enable PII so message content is recorded: in Python set \`send_default_pii=True\` in \`sentry_sdk.init(...)\`; in JavaScript/Node set \`sendDefaultPii: true\` in \`Sentry.init(...)\`.
>   2. If you use an SDK agent integration (e.g. OpenAI, Anthropic, LangChain, Vercel AI SDK), make sure its input/output recording options are enabled — some integrations gate message capture behind options like \`include_prompts\` / \`recordInputs\` / \`recordOutputs\` even when PII is on.
>   3. If your agents are instrumented manually, make sure the input and output messages are explicitly set on the spans (the gen_ai request/response message attributes) so they show up in Conversations.

# Capture Sentry AI Agent Conversation Messages

Use these docs as the source of truth:

## Docs References

- Getting started: https://docs.sentry.io/product/agents/getting-started.md
- JavaScript/Node instrumentation: https://docs.sentry.io/platforms/javascript/guides/node/tracing/instrumentation/ai-agents-module.md
- Python instrumentation: https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/ai-agents-module.md
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
