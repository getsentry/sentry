import {useState} from 'react';

import {Button, ButtonBar, LinkButton} from '@sentry/scraps/button';
import {MenuComponents} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import {getAutofixNextStep} from 'sentry/components/events/autofix/getAutofixNextStep';
import {
  findCodingAgentResultLink,
  getRepoPullRequestLink,
} from 'sentry/components/events/autofix/pullRequests';
import {getCodingAgentName} from 'sentry/components/events/autofix/types';
import {
  getOrderedAutofixSections,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {useCodingAgents} from 'sentry/components/events/autofix/v3/useCodingAgents';
import {Placeholder} from 'sentry/components/placeholder';
import {
  IconAdd,
  IconChevron,
  IconGithub,
  IconOpen,
  IconRefresh,
  IconSeer,
} from 'sentry/icons';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';

type ExplorerAutofix = ReturnType<typeof useExplorerAutofix>;

type SeerActionKind =
  | 'code_changes'
  | 'create_pr'
  | 'link'
  | 'root_cause'
  | 'solution'
  | 'view_autofix';

interface SeerAction {
  analyticsEventKey: string;
  analyticsEventName: string;
  kind: SeerActionKind;
  label: string;
  href?: string;
  isPullRequest?: boolean;
  repoName?: string;
  tooltip?: string | null;
}

interface IssuePreviewSeerActionsProps {
  autofix: ExplorerAutofix;
  group: Group;
  onContinueInSeer: () => void;
  disabled?: boolean;
}

const AUTOFIX_ANALYTICS = {
  code_changes: {
    analyticsEventKey: 'autofix.solution.code',
    analyticsEventName: 'Autofix: Code It Up',
  },
  create_pr: {
    analyticsEventKey: 'autofix.create_pr_clicked',
    analyticsEventName: 'Autofix: Create PR Setup Clicked',
  },
  root_cause: {
    analyticsEventKey: 'autofix.start_fix_clicked',
    analyticsEventName: 'Autofix: Start Fix Clicked',
  },
  solution: {
    analyticsEventKey: 'autofix.root_cause.find_solution',
    analyticsEventName: 'Autofix: Root Cause Find Solution',
  },
  view: {
    analyticsEventKey: 'issue_inbox.seer_cta_clicked',
    analyticsEventName: 'Issue Inbox: Seer CTA Clicked',
  },
} as const;

function getAutofixPrimaryAction(autofix: ExplorerAutofix): SeerAction | null {
  const {runState} = autofix;
  const sections = getOrderedAutofixSections(runState);

  if (!runState || sections.length === 0) {
    return {
      ...AUTOFIX_ANALYTICS.root_cause,
      kind: 'root_cause',
      label: t('Find Root Cause'),
    };
  }

  // The run is paused waiting on the user, so continue in the full Seer drawer.
  if (runState.status === 'awaiting_user_input') {
    return {
      ...AUTOFIX_ANALYTICS.view,
      kind: 'view_autofix',
      label:
        runState.pending_user_input?.input_type === 'file_change_approval'
          ? t('Review Changes')
          : t('Continue in Seer'),
    };
  }

  const pullRequests = Object.values(runState.repo_pr_states ?? {});
  const completedPullRequestLink = pullRequests.map(getRepoPullRequestLink).find(defined);
  const failedPullRequest = pullRequests.find(
    pullRequest => pullRequest.pr_creation_status === 'error'
  );

  // A pull request was created and completed
  // Show the view pull request button
  if (completedPullRequestLink) {
    return {
      ...AUTOFIX_ANALYTICS.view,
      kind: 'link',
      label: completedPullRequestLink.label,
      href: completedPullRequestLink.url,
      isPullRequest: true,
    };
  }

  // A pull request was created but failed
  // Show the retry button
  if (failedPullRequest) {
    return {
      ...AUTOFIX_ANALYTICS.create_pr,
      kind: 'create_pr',
      label: t('Retry PR in %s', failedPullRequest.repo_name),
      repoName: failedPullRequest.repo_name,
      tooltip: failedPullRequest.pr_creation_error,
    };
  }

  const codingAgents = Object.values(runState.coding_agents ?? {});
  const resultLink = findCodingAgentResultLink(codingAgents);

  if (resultLink) {
    return {
      ...AUTOFIX_ANALYTICS.view,
      kind: 'link',
      label: resultLink.label,
      href: resultLink.url,
    };
  }

  const codingAgent = codingAgents.find(agent => agent.agent_url);
  if (codingAgent?.agent_url) {
    return {
      ...AUTOFIX_ANALYTICS.view,
      kind: 'link',
      label: t('Open in %s', getCodingAgentName(codingAgent.provider)),
      href: codingAgent.agent_url,
    };
  }

  const nextStep = getAutofixNextStep({sections});

  switch (nextStep?.action) {
    case 'create_pr':
      return {...AUTOFIX_ANALYTICS.create_pr, kind: 'create_pr', label: t('Create PR')};
    case 'code_changes':
      return {
        ...AUTOFIX_ANALYTICS.code_changes,
        kind: 'code_changes',
        label: t('Write a Code Fix'),
      };
    case 'solution':
      return {...AUTOFIX_ANALYTICS.solution, kind: 'solution', label: t('Make a Plan')};
    case 'pr_iteration':
      return {
        ...AUTOFIX_ANALYTICS.view,
        kind: 'view_autofix',
        label: t('Continue in Seer'),
      };
    default:
      return null;
  }
}

export function IssuePreviewSeerActions({
  autofix,
  disabled,
  group,
  onContinueInSeer,
}: IssuePreviewSeerActionsProps) {
  if (autofix.isLoading) {
    return <Placeholder width="120px" height="32px" />;
  }

  return (
    <IssuePreviewSeerButton
      autofix={autofix}
      disabled={disabled}
      group={group}
      onContinueInSeer={onContinueInSeer}
    />
  );
}

function IssuePreviewSeerButton({
  autofix,
  disabled,
  group,
  onContinueInSeer,
}: IssuePreviewSeerActionsProps) {
  const organization = useOrganization();
  const [isStartingAction, setIsStartingAction] = useState(false);
  const action = getAutofixPrimaryAction(autofix);
  const runId = autofix.runState?.run_id;
  const busy = autofix.isPolling || isStartingAction;
  const canHandOff = action?.kind === 'solution' || action?.kind === 'code_changes';
  const {codingAgentIntegrations, codingAgentDisabledReason, handleCodingAgentHandoff} =
    useCodingAgents({
      autofix,
      group,
      runId: runId ?? 0,
      step: action?.kind === 'solution' ? 'root_cause' : 'solution',
      referrer: 'issue_inbox',
      enabled: canHandOff && defined(runId),
      onHandoff: onContinueInSeer,
    });

  if (!action) {
    return null;
  }

  const analyticsParams = {
    action: action.kind,
    group_id: group.id,
    progress: group.derivedData?.progress,
    referrer: 'issue_inbox',
  };

  const handleClick = async () => {
    if (action.kind === 'view_autofix') {
      onContinueInSeer();
      return;
    }

    setIsStartingAction(true);
    try {
      if (action.kind === 'root_cause') {
        await autofix.startStep('root_cause');
      } else if (action.kind === 'solution' && runId !== undefined) {
        await autofix.startStep('solution', {runId});
      } else if (action.kind === 'code_changes' && runId !== undefined) {
        await autofix.startStep('code_changes', {runId});
      } else if (action.kind === 'create_pr' && runId !== undefined) {
        await autofix.createPR(runId, action.repoName);
      }
    } catch {
      // Errors are handled in the caller and shown in the autofix panel
    } finally {
      setIsStartingAction(false);
    }
  };

  const codingAgentOptions = (codingAgentIntegrations ?? []).map(integration => {
    const actionLabel =
      integration.requires_identity && !integration.has_identity
        ? t('Setup %s', integration.name)
        : t('Send to %s', integration.name);

    return {
      key: `agent:${integration.id ?? integration.provider}`,
      textValue: actionLabel,
      label: (
        <Flex gap="md" align="center">
          <PluginIcon pluginId={integration.provider} size={16} />
          <span>{actionLabel}</span>
        </Flex>
      ),
      onAction: () => handleCodingAgentHandoff(integration),
    };
  });

  if (action.href) {
    return (
      <LinkButton
        external
        variant="primary"
        size="sm"
        icon={
          action.isPullRequest ? (
            <IconGithub data-test-id="pull-request-github" />
          ) : (
            <IconOpen />
          )
        }
        href={action.href}
        disabled={disabled}
        tooltipProps={action.tooltip ? {title: action.tooltip} : undefined}
        analyticsEventKey={action.analyticsEventKey}
        analyticsEventName={action.analyticsEventName}
        analyticsParams={analyticsParams}
      >
        {action.label}
      </LinkButton>
    );
  }

  const primaryButton = (
    <Button
      variant="primary"
      size="sm"
      icon={action.repoName ? <IconRefresh /> : <IconSeer />}
      busy={busy}
      disabled={disabled || busy}
      onClick={handleClick}
      tooltipProps={action.tooltip ? {title: action.tooltip} : undefined}
      analyticsEventKey={action.analyticsEventKey}
      analyticsEventName={action.analyticsEventName}
      analyticsParams={analyticsParams}
    >
      {action.label}
    </Button>
  );

  if (!canHandOff || codingAgentIntegrations === undefined) {
    return primaryButton;
  }

  return (
    <ButtonBar>
      {primaryButton}
      <DropdownMenu
        items={codingAgentOptions}
        isDisabled={defined(codingAgentDisabledReason)}
        trigger={(triggerProps, isOpen) => (
          <Button
            {...triggerProps}
            variant="primary"
            size="sm"
            icon={<IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />}
            aria-label={t('More code fix options')}
            disabled={disabled || busy || defined(codingAgentDisabledReason)}
            tooltipProps={{title: codingAgentDisabledReason}}
          />
        )}
        position="bottom-end"
        shouldCloseOnBlur={false}
        menuFooter={
          <DropdownMenuFooter>
            <MenuComponents.CTALinkButton
              icon={<IconAdd />}
              to={`/settings/${organization.slug}/integrations/?category=coding%20agent`}
            >
              {t('Add Integration')}
            </MenuComponents.CTALinkButton>
          </DropdownMenuFooter>
        }
      />
    </ButtonBar>
  );
}
