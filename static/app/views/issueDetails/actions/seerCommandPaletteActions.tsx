import {Fragment, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {
  organizationIntegrationsCodingAgents,
  type CodingAgentIntegration,
} from 'sentry/components/events/autofix/useAutofix';
import {
  getOrderedAutofixSections,
  isRootCauseSection,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import {useOpenSeerDrawer} from 'sentry/views/issueDetails/streamline/sidebar/seerDrawer';

function useSeerState(group: Group, project: Project) {
  const organization = useOrganization();
  const aiConfig = useAiConfig(group, project);
  const isExplorer = organization.features.includes('autofix-on-explorer');
  const issueTypeConfig = getConfigForIssueType(group, project);
  const issueTypeSupportsSeer = issueTypeConfig.autofix || issueTypeConfig.issueSummary;

  const autofix = useExplorerAutofix(group.id, {
    enabled: aiConfig.areAiFeaturesAllowed && isExplorer,
  });

  const sections = useMemo(
    () => getOrderedAutofixSections(autofix.runState),
    [autofix.runState]
  );

  const completedRootCause = sections.some(
    s => isRootCauseSection(s) && s.status === 'completed'
  );

  return {
    organization,
    aiConfig,
    isExplorer,
    issueTypeSupportsSeer,
    autofix,
    completedRootCause,
  };
}

interface SeerCommandPaletteActionsProps {
  event: Event | null;
  group: Group;
  project: Project;
}

export function SeerCommandPaletteActions({
  group,
  project,
  event,
}: SeerCommandPaletteActionsProps) {
  const {
    organization,
    aiConfig,
    isExplorer,
    issueTypeSupportsSeer,
    autofix,
    completedRootCause,
  } = useSeerState(group, project);

  const {openSeerDrawer} = useOpenSeerDrawer({group, project, event});

  const {data: codingAgentResponse} = useQuery(
    organizationIntegrationsCodingAgents(organization)
  );
  const codingAgentIntegrations = codingAgentResponse?.integrations;

  const runId = autofix.runState?.run_id;
  const canContinue = !autofix.isPolling && defined(runId);

  const showFixWithSeer =
    aiConfig.areAiFeaturesAllowed && isExplorer && issueTypeSupportsSeer && !!event;

  if (!showFixWithSeer && !codingAgentIntegrations?.length) {
    return null;
  }

  function handleCodingAgentHandoff(integration: CodingAgentIntegration) {
    if (!defined(runId)) {
      return;
    }
    if (integration.requires_identity && !integration.has_identity) {
      const currentUrl = window.location.href;
      window.location.href = `/remote/github-copilot/oauth/?next=${encodeURIComponent(currentUrl)}`;
      return;
    }
    openSeerDrawer();
    autofix.triggerCodingAgentHandoff(runId, integration);
  }

  return (
    <Fragment>
      {showFixWithSeer && (
        <CMDKAction
          display={{
            label: t('Fix with Seer'),
            icon: <IconSeer />,
          }}
          keywords={['autofix', 'seer', 'ai', 'fix']}
          onAction={openSeerDrawer}
        />
      )}

      {canContinue &&
        completedRootCause &&
        codingAgentIntegrations?.map(integration => (
          <CMDKAction
            key={`coding-agent:${integration.id ?? integration.provider}`}
            display={{
              label: t('Send to %s', integration.name),
              icon: <PluginIcon pluginId={integration.provider} size={16} />,
            }}
            keywords={[
              'autofix',
              'seer',
              'ai',
              'agent',
              integration.provider,
              integration.name,
            ]}
            onAction={() => handleCodingAgentHandoff(integration)}
          />
        ))}
    </Fragment>
  );
}
