import {Fragment, useMemo} from 'react';

import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {
  organizationIntegrationsCodingAgents,
  type CodingAgentIntegration,
} from 'sentry/components/events/autofix/useAutofix';
import {
  getOrderedAutofixSections,
  isCodeChangesSection,
  isPullRequestsSection,
  isRootCauseSection,
  isSolutionSection,
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
import {useQuery} from 'sentry/utils/queryClient';
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
  const completedSolution = sections.some(
    s => isSolutionSection(s) && s.status === 'completed'
  );
  const completedCodeChanges = sections.some(
    s => isCodeChangesSection(s) && s.status === 'completed'
  );
  const hasPR = sections.some(isPullRequestsSection);

  return {
    organization,
    aiConfig,
    isExplorer,
    issueTypeSupportsSeer,
    autofix,
    completedRootCause,
    completedSolution,
    completedCodeChanges,
    hasPR,
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
    completedSolution,
    completedCodeChanges,
    hasPR,
  } = useSeerState(group, project);

  const {openSeerDrawer} = useOpenSeerDrawer({group, project, event});

  const {data: codingAgentResponse} = useQuery(
    organizationIntegrationsCodingAgents(organization)
  );
  const codingAgentIntegrations = codingAgentResponse?.integrations;

  if (!aiConfig.areAiFeaturesAllowed || !isExplorer || !issueTypeSupportsSeer || !event) {
    return null;
  }

  const {runState, isPolling} = autofix;
  const runId = runState?.run_id;

  const canContinue = !isPolling && defined(runId);

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
      {(!runState || runState.status === 'error') && (
        <CMDKAction
          display={{label: t('Fix with Seer'), icon: <IconSeer />}}
          keywords={['autofix', 'seer', 'ai', 'fix']}
          onAction={() => {
            openSeerDrawer();
            autofix.startStep('root_cause');
          }}
        />
      )}

      {canContinue && completedRootCause && !completedSolution && (
        <CMDKAction
          display={{label: t('Seer: Generate solution'), icon: <IconSeer />}}
          keywords={['autofix', 'seer', 'ai', 'solution']}
          onAction={() => {
            openSeerDrawer();
            autofix.startStep('solution', runId);
          }}
        />
      )}

      {canContinue && completedSolution && !completedCodeChanges && (
        <CMDKAction
          display={{label: t('Seer: Generate code changes'), icon: <IconSeer />}}
          keywords={['autofix', 'seer', 'ai', 'code', 'changes']}
          onAction={() => {
            openSeerDrawer();
            autofix.startStep('code_changes', runId);
          }}
        />
      )}

      {canContinue && completedCodeChanges && !hasPR && (
        <CMDKAction
          display={{label: t('Seer: Open pull request'), icon: <IconSeer />}}
          keywords={['autofix', 'seer', 'ai', 'pr', 'pull request', 'open pr']}
          onAction={() => {
            openSeerDrawer();
            autofix.createPR(runId);
          }}
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
