import {Fragment, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {getAutofixNextStep} from 'sentry/components/events/autofix/getAutofixNextStep';
import {
  organizationIntegrationsCodingAgents,
  type CodingAgentIntegration,
} from 'sentry/components/events/autofix/useAutofix';
import {
  getOrderedAutofixSections,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {IconSeer} from 'sentry/icons';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';
import {useOpenSeerDrawer} from 'sentry/views/issueDetails/sidebar/seerDrawer';

function useSeerState(group: Group, project: Project) {
  const organization = useOrganization();
  const aiConfig = useAiConfig(group, project);
  const issueTypeConfig = getConfigForIssueType(group, project);
  const issueTypeSupportsSeer =
    issueTypeConfig.autofix || issueTypeConfig.issueSummary.enabled;

  const autofix = useExplorerAutofix(group, {
    enabled: aiConfig.areAiFeaturesAllowed,
  });

  const sections = useMemo(
    () => getOrderedAutofixSections(autofix.runState),
    [autofix.runState]
  );

  return {
    organization,
    aiConfig,
    issueTypeSupportsSeer,
    autofix,
    sections,
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
  const {organization, aiConfig, issueTypeSupportsSeer, autofix, sections} = useSeerState(
    group,
    project
  );

  const {openSeerDrawer} = useOpenSeerDrawer({group, project});

  const {data: codingAgentResponse} = useQuery(
    organizationIntegrationsCodingAgents(organization)
  );
  const codingAgentIntegrations = codingAgentResponse?.integrations;

  if (!aiConfig.areAiFeaturesAllowed || !issueTypeSupportsSeer || !event) {
    return null;
  }

  const {runState, isPolling} = autofix;
  const runId = getAutofixRunId(runState);
  const nextStep = getAutofixNextStep({sections});
  const canContinue = !isPolling && defined(runId);
  const canHandOff =
    canContinue &&
    sections.some(
      section => section.step === 'root_cause' && section.status === 'completed'
    );

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

      {canContinue && nextStep?.action === 'solution' && (
        <CMDKAction
          display={{label: t('Seer: Generate solution'), icon: <IconSeer />}}
          keywords={['autofix', 'seer', 'ai', 'solution']}
          onAction={() => {
            openSeerDrawer();
            autofix.startStep('solution', {runId});
          }}
        />
      )}

      {canContinue && nextStep?.action === 'code_changes' && (
        <CMDKAction
          display={{label: t('Seer: Generate code changes'), icon: <IconSeer />}}
          keywords={['autofix', 'seer', 'ai', 'code', 'changes']}
          onAction={() => {
            openSeerDrawer();
            autofix.startStep('code_changes', {runId});
          }}
        />
      )}

      {canContinue && nextStep?.action === 'create_pr' && (
        <CMDKAction
          display={{label: t('Seer: Open pull request'), icon: <IconSeer />}}
          keywords={['autofix', 'seer', 'ai', 'pr', 'pull request', 'open pr']}
          onAction={() => {
            openSeerDrawer();
            autofix.createPR(runId);
          }}
        />
      )}

      {canHandOff &&
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
