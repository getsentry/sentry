import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {useCodingAgentIntegrations} from 'sentry/components/events/autofix/useAutofix';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

import AutoTriggeredFixesToggle from 'getsentry/views/seerAutomation/components/projectDetails/autoTriggeredFixesToggle';
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
  const {data: codingAgentIntegrations, isLoading: isLoadingIntegrations} =
    useCodingAgentIntegrations();

  const supportedIntegrations = useMemo(
    () =>
      codingAgentIntegrations?.integrations.filter(
        integration =>
          (SUPPORTED_CODING_AGENT_INTEGRATION_PROVIDERS as unknown as string[]).includes(
            integration.provider
          ) && !integration.requires_identity
      ) ?? [],
    [codingAgentIntegrations]
  );

  return (
    <Stack gap="xl">
      <PanelNoMargin>
        <PanelHeader>{t('Issue Scan & Fix')}</PanelHeader>
        <PanelBody>
          <AutoTriggeredFixesToggle canWrite={canWrite} project={project} />
        </PanelBody>
      </PanelNoMargin>

      <PanelNoMargin>
        <PanelHeader>{t('Coding Agent')}</PanelHeader>
        <PanelBody>
          {isLoadingIntegrations ? (
            <Flex justify="center" align="center" padding="xl">
              <Placeholder height="52px" />
            </Flex>
          ) : (
            <BackgroundAgentPicker
              supportedIntegrations={supportedIntegrations}
              canWrite={canWrite}
              project={project}
              preference={preference}
            />
          )}

          <SeerAgentSection
            canWrite={canWrite}
            project={project}
            preference={preference}
          />

          {!isLoadingIntegrations && (
            <BackgroundAgentSetup supportedIntegrations={supportedIntegrations} />
          )}
        </PanelBody>
      </PanelNoMargin>
    </Stack>
  );
}

const PanelNoMargin = styled(Panel)`
  margin-bottom: 0;
`;
