import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {AI_AGENTS_GETTING_STARTED_DOCS_LINK} from 'sentry/views/insights/pages/agents/utils/docsLinks';

export function AgentsChartsBanner({show}: {show: boolean}) {
  if (!show) {
    return null;
  }

  return (
    <Alert variant="info">
      <Flex align="center" gap="md" justify="between" wrap="wrap">
        <Flex flex={1} minWidth="240px">
          <Text>
            {t(
              'You’re sending LLM calls only — no agent or tool spans yet. Running agents in your app?'
            )}
          </Text>
        </Flex>
        <Flex align="center" gap="md">
          <LinkButton
            external
            href={AI_AGENTS_GETTING_STARTED_DOCS_LINK}
            size="sm"
            variant="primary"
          >
            {t('Set Up Agent Tracing')}
          </LinkButton>
        </Flex>
      </Flex>
    </Alert>
  );
}
