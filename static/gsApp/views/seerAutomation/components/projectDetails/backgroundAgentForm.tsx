import {Fragment, useMemo} from 'react';

import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link/link';
import {Heading} from '@sentry/scraps/text/heading';
import {Text} from '@sentry/scraps/text/text';

import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {useCodingAgentIntegrations} from 'sentry/components/events/autofix/useAutofix';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';

import BackgroundAgentFields from 'getsentry/views/seerAutomation/components/projectDetails/backgroundAgentFields';
import BackgroundAgentPicker from 'getsentry/views/seerAutomation/components/projectDetails/backgroundAgentPicker';
import BackgroundAgentSetup from 'getsentry/views/seerAutomation/components/projectDetails/backgroundAgentSetup';
import {SUPPORTED_CODING_AGENT_INTEGRATION_PROVIDERS} from 'getsentry/views/seerAutomation/components/projectDetails/constants';

interface Props {
  canWrite: boolean;
  preference: ProjectSeerPreferences;
  project: Project;
}

export default function BackgroundAgentForm({canWrite, preference, project}: Props) {
  const organization = useOrganization();

  const {data: codingAgentIntegrations, isLoading: isLoadingIntegrations} =
    useCodingAgentIntegrations();

  const supportedIntegrations = useMemo(
    () =>
      codingAgentIntegrations?.integrations.filter(integration =>
        (SUPPORTED_CODING_AGENT_INTEGRATION_PROVIDERS as unknown as string[]).includes(
          integration.provider
        )
      ) ?? [],
    [codingAgentIntegrations]
  );

  if (!organization.features.includes('integrations-cursor')) {
    return null;
  }

  // If there is something configured, use that
  // otherwise if there is only one integration, we'll show those fields
  // but when there are multiple integrations and none picked: show no fields yet.
  const onlyIntegration =
    supportedIntegrations.length === 1 ? supportedIntegrations[0] : undefined;
  const selectedIntegration =
    supportedIntegrations.find(
      integration =>
        integration.id === String(preference?.automation_handoff?.integration_id)
    ) ?? onlyIntegration;

  return (
    <Container border="primary" radius="md" margin="2xl 0">
      <Flex direction="column">
        <Heading as="h3">
          <Flex direction="row" gap="sm" align="center" padding="xl xl 0 xl">
            {t('Background Agent Hand Off')}
          </Flex>
        </Heading>
        {isLoadingIntegrations ? (
          <Flex justify="center" align="center" paddingTop="xl">
            <Placeholder height="52px" />
          </Flex>
        ) : (
          <Fragment>
            <Flex padding="xl xl 0 xl">
              <Text>
                {tct(
                  'Hand off Seer debugging, issue fixes, and PR creation tasks directly to external coding agents. [docsLink:Read the docs] to learn more.',
                  {
                    docsLink: (
                      <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/" />
                    ),
                  }
                )}
              </Text>
            </Flex>
            <BackgroundAgentPicker
              supportedIntegrations={supportedIntegrations}
              canWrite={canWrite}
              project={project}
              preference={preference}
            />
            {selectedIntegration ? (
              <BackgroundAgentFields
                canWrite={canWrite}
                project={project}
                preference={preference}
                selectedIntegration={selectedIntegration}
              />
            ) : null}
            <BackgroundAgentSetup supportedIntegrations={supportedIntegrations} />
          </Fragment>
        )}
      </Flex>
    </Container>
  );
}
