import {Fragment, useMemo} from 'react';

import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {useCodingAgentIntegrations} from 'sentry/components/events/autofix/useAutofix';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
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

  return (
    <Fragment>
      <Panel>
        <PanelHeader>{t('Issue Scan & Fix')}</PanelHeader>
        <PanelBody>
          <AutoTriggeredFixesToggle canWrite={canWrite} project={project} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>{t('Seer Agent')}</PanelHeader>
        <PanelBody>
          <SeerAgentSection
            canWrite={canWrite}
            project={project}
            preference={preference}
          />
        </PanelBody>
      </Panel>

      {showBackgroundAgentSection && (
        <Fragment>
          <Panel>
            <PanelHeader>{t('Agent Delegation')}</PanelHeader>
            <PanelBody>
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
            </PanelBody>
          </Panel>
        </Fragment>
      )}
    </Fragment>
  );
}
