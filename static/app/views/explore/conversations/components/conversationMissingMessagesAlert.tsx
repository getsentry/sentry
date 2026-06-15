import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {CodeBlock} from '@sentry/scraps/code';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Prose} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {CopyLLMPromptButton} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';
import {AI_INSTRUMENTATION_DOCS_LINKS} from 'sentry/views/insights/pages/agents/utils/docsLinks';

/**
 * Shown on the conversations overview when conversations exist but none of them
 * have captured input/output messages. This usually means message capture (PII)
 * is disabled in the SDK, so the conversation views are effectively empty.
 */
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
              'These conversations are missing their input and output. Turn on message capture in your SDK to see the messages in each conversation.'
            )}
          </Prose>
          <Prose>
            {tct('For Python, set [code:send_default_pii] in your [code:init] call:', {
              code: <StyledCode />,
            })}
          </Prose>
          <CodeBlock dark language="python" css={codeSnippetStyles}>
            {`sentry_sdk.init(
  # ...
  send_default_pii=True,
)`}
          </CodeBlock>
          <Prose>
            {tct('For JavaScript, set [code:sendDefaultPii] in your [code:init] call:', {
              code: <StyledCode />,
            })}
          </Prose>
          <CodeBlock dark language="javascript" css={codeSnippetStyles}>
            {`Sentry.init({
  // ...
  sendDefaultPii: true,
});`}
          </CodeBlock>
          <Prose>
            {tct(
              'For more details, see the [pythonLink:Python] or [javascriptLink:JavaScript] instrumentation docs, or let an AI agent set it up.',
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

// TODO(aknaus): Remove this once the Prose component adds styling for code elements
const StyledCode = styled('code')`
  color: ${p => p.theme.colors.pink500};
`;

const codeSnippetStyles = css`
  margin: 0 !important;
`;
