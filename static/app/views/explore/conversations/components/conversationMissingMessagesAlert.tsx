import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Prose} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {CopyLLMPromptButton} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';
import {AI_INSTRUMENTATION_DOCS_LINKS} from 'sentry/views/insights/pages/agents/utils/docsLinks';

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
            <CopyLLMPromptButton />
          </Stack>
        </Stack>
      </Alert>
    </Alert.Container>
  );
}
