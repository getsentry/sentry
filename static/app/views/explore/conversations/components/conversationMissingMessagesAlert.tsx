import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Prose} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {useOrganization} from 'sentry/utils/useOrganization';

const PYTHON_DOCS_URL =
  'https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/ai-agents-module/';
const JAVASCRIPT_DOCS_URL =
  'https://docs.sentry.io/platforms/javascript/guides/node/tracing/instrumentation/ai-agents-module/';

/**
 * Shown on the conversations overview when conversations exist but none of them
 * have captured input/output messages. This usually means message capture (PII)
 * is disabled in the SDK, so the conversation views are effectively empty.
 */
export function ConversationMissingMessagesAlert() {
  const organization = useOrganization();
  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:genai-conversations-missing-messages-dismissed`,
  });

  if (isDismissed) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert variant="info">
        <Stack direction="column" gap="md" paddingTop="2xs">
          <Heading as="h4" variant="accent">
            {t('Missing the input and output of your conversations?')}
          </Heading>
          <Prose>
            {t(
              'These conversations were recorded, but their messages were not captured. Enable message capture in your SDK to see the full input and output of every conversation.'
            )}
          </Prose>
          <Prose>
            {tct(
              'See the [pythonLink:Python] or [javascriptLink:JavaScript] AI instrumentation docs for details.',
              {
                pythonLink: <ExternalLink href={PYTHON_DOCS_URL} />,
                javascriptLink: <ExternalLink href={JAVASCRIPT_DOCS_URL} />,
              }
            )}
          </Prose>
          <Stack direction="row" paddingTop="xs" justify="start">
            <Alert.Button onClick={dismiss}>{t('Dismiss')}</Alert.Button>
          </Stack>
        </Stack>
      </Alert>
    </Alert.Container>
  );
}
