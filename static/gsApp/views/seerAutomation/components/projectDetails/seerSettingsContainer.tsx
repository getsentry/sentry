import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Stack} from '@sentry/scraps/layout/stack';

import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {useCodingAgentIntegrations} from 'sentry/components/events/autofix/useAutofix';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';

import AutoTriggeredFixesToggle from 'getsentry/views/seerAutomation/components/projectDetails/autoTriggeredFixesToggle';
import BackgroundAgentFields from 'getsentry/views/seerAutomation/components/projectDetails/backgroundAgentFields';
import BackgroundAgentPicker from 'getsentry/views/seerAutomation/components/projectDetails/backgroundAgentPicker';
import BackgroundAgentSetup from 'getsentry/views/seerAutomation/components/projectDetails/backgroundAgentSetup';
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

  return (
    <Stack gap="xl">
      <PanelNoMargin>
        <PanelHeader>{t('Issue Scan & Fix')}</PanelHeader>
        <PanelBody>
          <AutoTriggeredFixesToggle canWrite={canWrite} project={project} />
        </PanelBody>
      </PanelNoMargin>

      <PanelNoMargin>
        <PanelHeader>{t('Seer Agent')}</PanelHeader>
        <PanelBody>
          <SeerAgentSection
            canWrite={canWrite}
            project={project}
            preference={preference}
          />
        </PanelBody>
      </PanelNoMargin>

      {showBackgroundAgentSection && (
        <Fragment>
          <PanelNoMargin>
            <PanelHeader>{t('Agent Delegation')}</PanelHeader>
            <PanelBody>
              <BackgroundAgentPicker
                supportedIntegrations={supportedIntegrations}
                canWrite={canWrite}
                project={project}
                preference={preference}
              />

              {isLoadingIntegrations ? (
                <Flex justify="center" align="center" padding="xl">
                  <Placeholder height="52px" />
                </Flex>
              ) : (
                <Fragment>
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
            </PanelBody>
          </PanelNoMargin>
        </Fragment>
      )}
    </Stack>
  );
}

const PanelNoMargin = styled(Panel)`
  margin-bottom: 0;
`;
