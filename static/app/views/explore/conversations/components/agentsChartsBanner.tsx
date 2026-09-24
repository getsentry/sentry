import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AI_AGENTS_GETTING_STARTED_DOCS_LINK} from 'sentry/views/insights/pages/agents/utils/docsLinks';

export function AgentsChartsBanner({show}: {show: boolean}) {
  const organization = useOrganization();
  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:agents-without-agent-spans-alert`,
  });

  if (!show || isDismissed) {
    return null;
  }

  return (
    <Alert variant="info">
      <Flex align="center" gap="md" justify="between" wrap="wrap">
        <Flex flex={1} minWidth="240px">
          <Text>
            {t(
              'Not seeing agent runs or tool calls — this project is sending LLM calls without agent spans.'
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
          <Alert.Button
            aria-label={t('Dismiss banner')}
            icon={<IconClose variant="accent" />}
            onClick={dismiss}
            variant="transparent"
          />
        </Flex>
      </Flex>
    </Alert>
  );
}
