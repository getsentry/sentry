import {IconClose} from '@sentry/icons/close';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AI_AGENTS_GETTING_STARTED_DOCS_LINK} from 'sentry/views/insights/pages/agents/utils/docsLinks';

export function AgentsChartsBanner({show}: {show: boolean}) {
  const organization = useOrganization();
  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:agents-charts-missing-agent-data-banner-dismissed`,
  });

  if (!show || isDismissed) {
    return null;
  }

  return (
    <Alert
      variant="info"
      trailingItems={
        <Button
          aria-label={t('Dismiss banner')}
          icon={<IconClose />}
          onClick={dismiss}
          size="zero"
          variant="transparent"
        />
      }
    >
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
