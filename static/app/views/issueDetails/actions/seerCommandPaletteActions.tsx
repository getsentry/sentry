import {Fragment, useCallback, useEffect, useMemo, useRef} from 'react';
import {useQuery} from '@tanstack/react-query';

import {ExternalLink, Link} from '@sentry/scraps/link';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Indicator} from 'sentry/actionCreators/indicator';
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
import {IndicatorStore} from 'sentry/stores/indicatorStore';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import {useOpenSeerDrawer} from 'sentry/views/issueDetails/streamline/sidebar/seerDrawer';

function getHeadlessSeerStageLabel({
  issueLabel,
  completedRootCause,
  completedSolution,
  completedCodeChanges,
  hasPullRequestState,
}: {
  completedCodeChanges: boolean;
  completedRootCause: boolean;
  completedSolution: boolean;
  hasPullRequestState: boolean;
  issueLabel: string;
}) {
  if (!completedRootCause) {
    return t('Seer is investigating issue %s', issueLabel);
  }
  if (!completedSolution) {
    return t('Seer is planning a fix for %s', issueLabel);
  }
  if (!completedCodeChanges) {
    return t('Seer is writing code for %s', issueLabel);
  }
  if (!hasPullRequestState) {
    return t('Seer is opening a pull request for %s', issueLabel);
  }
  return t('Seer is finishing work on %s', issueLabel);
}

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
  const location = useLocation();
  const headlessRunIdRef = useRef<number | null>(null);
  const loadingIndicatorRef = useRef<Indicator | null>(null);
  const loadingStageRef = useRef<string | null>(null);

  const {data: codingAgentResponse} = useQuery(
    organizationIntegrationsCodingAgents(organization)
  );
  const codingAgentIntegrations = codingAgentResponse?.integrations;

  const issueLabel = useMemo(() => {
    const shortId = group.shortId ?? `#${group.id}`;
    return shortId.startsWith('#') ? shortId : `#${shortId}`;
  }, [group.id, group.shortId]);

  const seerDrawerLink = useMemo(
    () => ({
      pathname: location.pathname,
      query: {
        ...location.query,
        seerDrawer: true,
      },
    }),
    [location.pathname, location.query]
  );

  const removeLoadingIndicator = useCallback(() => {
    if (loadingIndicatorRef.current) {
      IndicatorStore.remove(loadingIndicatorRef.current);
      loadingIndicatorRef.current = null;
    }
    loadingStageRef.current = null;
  }, []);

  const showLoadingIndicator = useCallback(
    (message: string) => {
      if (loadingStageRef.current === message && loadingIndicatorRef.current) {
        return;
      }

      removeLoadingIndicator();
      loadingStageRef.current = message;
      loadingIndicatorRef.current = IndicatorStore.addMessage(
        <Fragment>
          {message} <Link to={seerDrawerLink}>{t('View analysis')}</Link>
        </Fragment>,
        'loading'
      );
    },
    [removeLoadingIndicator, seerDrawerLink]
  );

  const resetHeadlessRun = useCallback(() => {
    headlessRunIdRef.current = null;
    removeLoadingIndicator();
  }, [removeLoadingIndicator]);

  const {runState, isPolling} = autofix;
  const runId = runState?.run_id;

  const canContinue = !isPolling && defined(runId);
  const prStates = Object.values(runState?.repo_pr_states ?? {});

  useEffect(() => {
    return () => {
      removeLoadingIndicator();
    };
  }, [removeLoadingIndicator]);

  useEffect(() => {
    const activeRunId = headlessRunIdRef.current;
    if (!defined(activeRunId) || runState?.run_id !== activeRunId) {
      return;
    }

    if (runState?.status === 'error') {
      resetHeadlessRun();
      addErrorMessage(t('Seer failed to fix %s.', issueLabel));
      return;
    }

    const prError = prStates.find(pr => pr.pr_creation_status === 'error');
    if (prError) {
      resetHeadlessRun();
      addErrorMessage(
        prError.pr_creation_error
          ? t('Seer failed to fix %s: %s', issueLabel, prError.pr_creation_error)
          : t('Seer failed to fix %s.', issueLabel)
      );
      return;
    }

    const completedPrs = prStates.filter(
      pr => pr.pr_creation_status === 'completed' && pr.pr_url
    );
    const isPrCreationComplete =
      prStates.length > 0 &&
      completedPrs.length === prStates.length &&
      prStates.every(pr => pr.pr_creation_status === 'completed');

    if (isPrCreationComplete) {
      const firstPr = completedPrs[0];
      resetHeadlessRun();
      addSuccessMessage(
        <Fragment>
          {t('Seer fixed %s, ', issueLabel)}
          <ExternalLink href={firstPr?.pr_url ?? undefined}>
            {t('view pull request')}
          </ExternalLink>
        </Fragment>,
        {duration: 8000}
      );
      return;
    }

    showLoadingIndicator(
      getHeadlessSeerStageLabel({
        issueLabel,
        completedRootCause,
        completedSolution,
        completedCodeChanges,
        hasPullRequestState: prStates.length > 0,
      })
    );
  }, [
    completedCodeChanges,
    completedRootCause,
    completedSolution,
    issueLabel,
    prStates,
    resetHeadlessRun,
    runState,
    showLoadingIndicator,
  ]);

  const startHeadlessFix = useCallback(async () => {
    showLoadingIndicator(
      getHeadlessSeerStageLabel({
        issueLabel,
        completedRootCause,
        completedSolution,
        completedCodeChanges,
        hasPullRequestState: prStates.length > 0,
      })
    );

    try {
      if (!runState || runState.status === 'error') {
        const nextRunId = await autofix.startStep('root_cause', {
          stoppingPoint: 'open_pr',
        });
        headlessRunIdRef.current = nextRunId;
        return;
      }

      if (!canContinue) {
        return;
      }

      headlessRunIdRef.current = runId;

      if (!completedRootCause) {
        await autofix.startStep('root_cause', {runId, stoppingPoint: 'open_pr'});
        return;
      }

      if (!completedSolution) {
        await autofix.startStep('solution', {runId, stoppingPoint: 'open_pr'});
        return;
      }

      if (!completedCodeChanges) {
        await autofix.startStep('code_changes', {runId, stoppingPoint: 'open_pr'});
        return;
      }

      if (!hasPR) {
        await autofix.createPR(runId);
      }
    } catch {
      resetHeadlessRun();
      addErrorMessage(t('Seer failed to fix %s.', issueLabel));
    }
  }, [
    autofix,
    canContinue,
    completedCodeChanges,
    completedRootCause,
    completedSolution,
    hasPR,
    issueLabel,
    prStates.length,
    resetHeadlessRun,
    runId,
    runState,
    showLoadingIndicator,
  ]);

  const fixWithSeerAction = useMemo(() => {
    if (
      !aiConfig.areAiFeaturesAllowed ||
      !isExplorer ||
      !issueTypeSupportsSeer ||
      !event
    ) {
      return null;
    }

    if (!runState || runState.status === 'error') {
      return {
        label: t('Fix with Seer'),
        keywords: ['autofix', 'seer', 'ai', 'fix'],
        onAction: startHeadlessFix,
      };
    }

    if (!canContinue || hasPR) {
      return null;
    }

    if (!completedRootCause) {
      return {
        label: t('Fix with Seer'),
        keywords: ['autofix', 'seer', 'ai', 'fix', 'root cause'],
        onAction: startHeadlessFix,
      };
    }

    if (!completedSolution) {
      return {
        label: t('Fix with Seer'),
        keywords: ['autofix', 'seer', 'ai', 'fix', 'solution'],
        onAction: startHeadlessFix,
      };
    }

    if (!completedCodeChanges) {
      return {
        label: t('Fix with Seer'),
        keywords: ['autofix', 'seer', 'ai', 'fix', 'code', 'changes'],
        onAction: startHeadlessFix,
      };
    }

    return {
      label: t('Fix with Seer'),
      keywords: ['autofix', 'seer', 'ai', 'fix', 'pr', 'pull request', 'open pr'],
      onAction: startHeadlessFix,
    };
  }, [
    aiConfig.areAiFeaturesAllowed,
    canContinue,
    completedCodeChanges,
    completedRootCause,
    completedSolution,
    event,
    hasPR,
    isExplorer,
    issueTypeSupportsSeer,
    runState,
    startHeadlessFix,
  ]);

  if (!fixWithSeerAction && !codingAgentIntegrations?.length) {
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
      {fixWithSeerAction && (
        <CMDKAction
          display={{
            label: fixWithSeerAction.label,
            icon: <IconSeer />,
          }}
          keywords={fixWithSeerAction.keywords}
          onAction={fixWithSeerAction.onAction}
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
