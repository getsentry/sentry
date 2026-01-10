import {Fragment, useMemo, type ReactNode} from 'react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link/link';
import {Heading} from '@sentry/scraps/text/heading';
import {Text} from '@sentry/scraps/text/text';

import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {useCodingAgentIntegrations} from 'sentry/components/events/autofix/useAutofix';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';

import AutoTriggeredFixesToggle from 'getsentry/views/seerAutomation/components/projectDetails/autoTriggeredFixesToggle';
import BackgroundAgentPicker from 'getsentry/views/seerAutomation/components/projectDetails/backgroundAgentPicker';
import BackgroundAgentSection from 'getsentry/views/seerAutomation/components/projectDetails/backgroundAgentSection';
import {SUPPORTED_CODING_AGENT_INTEGRATION_PROVIDERS} from 'getsentry/views/seerAutomation/components/projectDetails/constants';
import SeerAgentSection from 'getsentry/views/seerAutomation/components/projectDetails/seerAgentSection';

interface Props {
  canWrite: boolean;
  preference: ProjectSeerPreferences;
  project: Project;
}

export default function SeerSettingsContainer({canWrite, preference, project}: Props) {
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

  const onlyIntegration =
    supportedIntegrations.length === 1 ? supportedIntegrations[0] : undefined;
  const selectedIntegration =
    supportedIntegrations.find(
      integration =>
        integration.id === String(preference?.automation_handoff?.integration_id)
    ) ?? onlyIntegration;

  const showBackgroundAgentSection =
    organization.features.includes('integrations-cursor');

  // const isBackgroundAgentActive = Boolean(preference?.automation_handoff);

  return (
    <Fragment>
      <Container border="primary" radius="md">
        <Stack>
          <Title title={t('Issue Scan & Fix')} first />

          <AutoTriggeredFixesToggle canWrite={canWrite} project={project} />

          <Title title={t('Seer Agent')} />

          <Flex direction="column" padding="lg lg 0 lg">
            <Text variant="muted">
              {tct(
                'Seer will identify the root cause and propose a solution for error and performance issues. [docsLink:Read the docs] to learn more.',
                {
                  docsLink: (
                    <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/" />
                  ),
                }
              )}
            </Text>
          </Flex>

          <SeerAgentSection
            canWrite={canWrite}
            project={project}
            preference={preference}
          />

          {showBackgroundAgentSection && (
            <Fragment>
              <Title title={t('Agent Delegation')} />

              <Flex direction="column" padding="lg lg 0 lg">
                <Text variant="muted">
                  {tct(
                    'Seer will identify the root cause and hand off to an external coding agent for solutions and fixes. [docsLink:Read the docs] to learn more.',
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

              <BackgroundAgentSection
                canWrite={canWrite}
                project={project}
                preference={preference}
                supportedIntegrations={supportedIntegrations}
                selectedIntegration={selectedIntegration}
                isLoadingIntegrations={isLoadingIntegrations}
              />
            </Fragment>
          )}
        </Stack>
      </Container>
    </Fragment>
  );
}

function Title({title, first}: {title: ReactNode; first?: boolean}) {
  return (
    <Container
      background="secondary"
      padding="xl"
      borderBottom="primary"
      radius={first ? 'md md 0 0' : '0'}
    >
      <Heading as="h3">{title}</Heading>
    </Container>
  );
}
