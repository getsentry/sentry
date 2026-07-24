import {useState} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';

import {
  getCodingAgentName,
  getResultButtonLabel,
} from 'sentry/components/events/autofix/types';
import {
  getOrderedAutofixSections,
  type ExplorerAutofixState,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {Placeholder} from 'sentry/components/placeholder';
import {IconOpen, IconRefresh, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';

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
  repoName?: string;
  tooltip?: string | null;
}

interface IssuePreviewSeerActionsProps {
  autofix: ExplorerAutofix;
  group: Group;
  onOpenAutofix: () => void;
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

function getAutofixPrimaryAction(
  runState: ExplorerAutofixState | null
): SeerAction | null {
  const sections = getOrderedAutofixSections(runState);
  const lastCompletedSection = sections.findLast(
    section => section.status === 'completed'
  );

  if (!runState || !lastCompletedSection) {
    return {
      ...AUTOFIX_ANALYTICS.root_cause,
      kind: 'root_cause',
      label: t('Find Root Cause'),
    };
  }

  // The run is paused waiting on the user
  // For now open the autofix tab, but in the future open an explorer side panel
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
  const completedPullRequest = pullRequests.find(
    pullRequest =>
      pullRequest.pr_creation_status === 'completed' &&
      pullRequest.pr_url &&
      pullRequest.pr_number &&
      pullRequest.repo_name
  );
  const failedPullRequest = pullRequests.find(
    pullRequest => pullRequest.pr_creation_status === 'error'
  );

  // A pull request was created and completed
  // Show the view pull request button
  if (completedPullRequest?.pr_url && completedPullRequest.pr_number) {
    return {
      ...AUTOFIX_ANALYTICS.view,
      kind: 'link',
      label: t(
        'View %s#%s',
        completedPullRequest.repo_name,
        completedPullRequest.pr_number
      ),
      href: completedPullRequest.pr_url,
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

  switch (lastCompletedSection.step) {
    case 'pull_request': {
      const pullRequest = pullRequests[0];
      if (!pullRequest) {
        return null;
      }

      return {
        ...AUTOFIX_ANALYTICS.create_pr,
        kind: 'create_pr',
        label: t('Retry PR in %s', pullRequest.repo_name),
        repoName: pullRequest.repo_name,
        tooltip: pullRequest.pr_creation_error,
      };
    }

    case 'coding_agents': {
      const codingAgents = Object.values(runState.coding_agents ?? {});
      const result = codingAgents
        .flatMap(codingAgent => codingAgent.results ?? [])
        .find(item => item.pr_url);

      if (result?.pr_url) {
        return {
          ...AUTOFIX_ANALYTICS.view,
          kind: 'link',
          label: getResultButtonLabel(result.pr_url),
          href: result.pr_url,
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

      return null;
    }

    case 'code_changes':
      return {
        ...AUTOFIX_ANALYTICS.create_pr,
        kind: 'create_pr',
        label: t('Draft a PR'),
      };

    case 'solution':
      return {
        ...AUTOFIX_ANALYTICS.code_changes,
        kind: 'code_changes',
        label: t('Write a Code Fix'),
      };

    case 'root_cause':
      return {
        ...AUTOFIX_ANALYTICS.solution,
        kind: 'solution',
        label: t('Make a Plan'),
      };

    default:
      return {
        ...AUTOFIX_ANALYTICS.root_cause,
        kind: 'root_cause',
        label: t('Find Root Cause'),
      };
  }
}

export function IssuePreviewSeerActions({
  autofix,
  disabled,
  group,
  onOpenAutofix,
}: IssuePreviewSeerActionsProps) {
  if (autofix.isLoading) {
    return <Placeholder width="120px" height="32px" />;
  }

  return (
    <IssuePreviewSeerButton
      autofix={autofix}
      disabled={disabled}
      group={group}
      onOpenAutofix={onOpenAutofix}
    />
  );
}

function IssuePreviewSeerButton({
  autofix,
  disabled,
  group,
  onOpenAutofix,
}: IssuePreviewSeerActionsProps) {
  const [isStartingAction, setIsStartingAction] = useState(false);
  const action = getAutofixPrimaryAction(autofix.runState);
  const runId = autofix.runState?.run_id;
  const busy = autofix.isPolling || isStartingAction;

  if (!action) {
    return null;
  }

  const analyticsParams = {
    group_id: group.id,
    referrer: 'issue_inbox',
  };

  const handleClick = async () => {
    onOpenAutofix();

    if (action.kind === 'view_autofix') {
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

  if (action.href) {
    return (
      <LinkButton
        external
        variant="primary"
        size="sm"
        icon={<IconOpen />}
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

  return (
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
}
