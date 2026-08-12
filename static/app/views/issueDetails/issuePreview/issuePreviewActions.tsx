import {useState, type ReactNode} from 'react';

import {Button, ButtonBar, LinkButton, type ButtonProps} from '@sentry/scraps/button';
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

interface IssuePreviewActionsProps {
  autofix: ExplorerAutofix;
  group: Group;
  onContinueInSeer: () => void;
  disabled?: boolean;
}

interface AutofixActionProps {
  autofix: ExplorerAutofix;
  group: Group;
  onContinueInSeer: () => void;
  disabled?: boolean;
}

interface AutofixActionButtonProps {
  analyticsAction: string;
  analyticsEventKey: string;
  analyticsEventName: string;
  children: ReactNode;
  group: Group;
  onClick: () => void | Promise<void>;
  analyticsParams?: ButtonProps['analyticsParams'];
  busy?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  tooltip?: string | null;
}

function AutofixActionButton({
  analyticsEventKey,
  analyticsEventName,
  analyticsAction,
  analyticsParams,
  busy,
  children,
  disabled,
  group,
  icon,
  onClick,
  tooltip,
}: AutofixActionButtonProps) {
  return (
    <Button
      variant="primary"
      size="sm"
      icon={icon}
      busy={busy}
      disabled={disabled || busy}
      onClick={onClick}
      tooltipProps={tooltip ? {title: tooltip} : undefined}
      analyticsEventKey={analyticsEventKey}
      analyticsEventName={analyticsEventName}
      analyticsParams={{
        action: analyticsAction,
        group_id: group.id,
        progress: group.derivedData?.progress,
        ...analyticsParams,
      }}
    >
      {children}
    </Button>
  );
}

function LinkAction({
  analyticsEventKey,
  analyticsEventName,
  analyticsParams,
  children,
  disabled,
  group,
  href,
  icon = <IconOpen />,
}: {
  analyticsEventKey: string;
  analyticsEventName: string;
  children: ReactNode;
  group: Group;
  href: string;
  analyticsParams?: ButtonProps['analyticsParams'];
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <LinkButton
      external
      variant="primary"
      size="sm"
      icon={icon}
      href={href}
      disabled={disabled}
      analyticsEventKey={analyticsEventKey}
      analyticsEventName={analyticsEventName}
      analyticsParams={{
        group_id: group.id,
        progress: group.derivedData?.progress,
        ...analyticsParams,
      }}
    >
      {children}
    </LinkButton>
  );
}

function StartAutofixAction({
  action,
  analyticsAction,
  analyticsEventKey,
  analyticsEventName,
  analyticsParams,
  autofix,
  codingAgentStep,
  disabled,
  group,
  icon = <IconSeer />,
  label,
  onContinueInSeer,
  tooltip,
}: AutofixActionProps & {
  action: () => unknown | Promise<unknown>;
  analyticsAction: string;
  analyticsEventKey: string;
  analyticsEventName: string;
  label: string;
  analyticsParams?: ButtonProps['analyticsParams'];
  codingAgentStep?: 'root_cause' | 'solution';
  icon?: ReactNode;
  tooltip?: string | null;
}) {
  const organization = useOrganization();
  const [isStartingAction, setIsStartingAction] = useState(false);
  const runId = autofix.runState?.run_id;
  const busy = autofix.isPolling || isStartingAction;
  const {codingAgentIntegrations, codingAgentDisabledReason, handleCodingAgentHandoff} =
    useCodingAgents({
      autofix,
      group,
      runId: runId ?? 0,
      step: codingAgentStep ?? 'solution',
      referrer: 'issue_inbox',
      enabled: defined(codingAgentStep) && defined(runId),
      onHandoff: onContinueInSeer,
    });

  const handleClick = async () => {
    setIsStartingAction(true);
    try {
      await action();
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

  const primaryButton = (
    <AutofixActionButton
      analyticsAction={analyticsAction}
      analyticsEventKey={analyticsEventKey}
      analyticsEventName={analyticsEventName}
      analyticsParams={analyticsParams}
      icon={icon}
      busy={busy}
      disabled={disabled}
      group={group}
      onClick={handleClick}
      tooltip={tooltip}
    >
      {label}
    </AutofixActionButton>
  );

  if (!codingAgentStep || codingAgentIntegrations === undefined) {
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

function ActionButtons({autofix, disabled, group, onContinueInSeer}: AutofixActionProps) {
  const {runState} = autofix;
  const sections = getOrderedAutofixSections(runState);

  if (!runState || sections.length === 0) {
    return (
      <StartAutofixAction
        action={() => autofix.startStep('root_cause')}
        analyticsAction="root_cause"
        analyticsEventKey="issue_inbox.start_fix_clicked"
        analyticsEventName="Issue Inbox: Start Fix Clicked"
        autofix={autofix}
        disabled={disabled}
        group={group}
        label={t('Find Root Cause')}
        onContinueInSeer={onContinueInSeer}
      />
    );
  }

  // The run is paused waiting on the user, so continue in the full Seer drawer.
  if (runState.status === 'awaiting_user_input') {
    return (
      <AutofixActionButton
        analyticsAction="view_autofix"
        analyticsEventKey="issue_inbox.seer_cta_clicked"
        analyticsEventName="Issue Inbox: Continue in Seer Clicked"
        analyticsParams={{
          destination: 'seer',
          input_type: runState.pending_user_input?.input_type,
        }}
        disabled={disabled}
        group={group}
        icon={<IconSeer />}
        onClick={onContinueInSeer}
      >
        {runState.pending_user_input?.input_type === 'file_change_approval'
          ? t('Review Changes')
          : t('Continue in Seer')}
      </AutofixActionButton>
    );
  }

  const pullRequests = Object.values(runState.repo_pr_states ?? {});
  const completedPullRequestLink = pullRequests.map(getRepoPullRequestLink).find(defined);
  const failedPullRequest = pullRequests.find(
    pullRequest => pullRequest.pr_creation_status === 'error'
  );

  // A pull request was created and completed
  // Show the view pull request button
  if (completedPullRequestLink) {
    return (
      <LinkAction
        analyticsEventKey="issue_inbox.seer_cta_clicked"
        analyticsEventName="Issue Inbox: Seer CTA Clicked"
        analyticsParams={{destination: 'pull_request'}}
        disabled={disabled}
        group={group}
        href={completedPullRequestLink.url}
        icon={<IconGithub data-test-id="pull-request-github" />}
      >
        {completedPullRequestLink.label}
      </LinkAction>
    );
  }

  // A pull request was created but failed
  // Show the retry button
  if (failedPullRequest) {
    return (
      <StartAutofixAction
        action={() => autofix.createPR(runState.run_id, failedPullRequest.repo_name)}
        analyticsAction="create_pr"
        analyticsEventKey="issue_inbox.create_pr_clicked"
        analyticsEventName="Issue Inbox: Create PR Setup Clicked"
        analyticsParams={{is_retry: true}}
        autofix={autofix}
        disabled={disabled}
        group={group}
        icon={<IconRefresh />}
        label={t('Retry PR in %s', failedPullRequest.repo_name)}
        onContinueInSeer={onContinueInSeer}
        tooltip={failedPullRequest.pr_creation_error}
      />
    );
  }

  const codingAgents = Object.values(runState.coding_agents ?? {});
  const codingAgentWithResult = codingAgents.find(agent =>
    agent.results?.some(result => result.pr_url)
  );
  const codingAgentResult = codingAgentWithResult?.results?.find(result => result.pr_url);
  const resultLink = findCodingAgentResultLink(codingAgents);

  if (resultLink) {
    return (
      <LinkAction
        analyticsEventKey="issue_inbox.seer_cta_clicked"
        analyticsEventName="Issue Inbox: Seer CTA Clicked"
        analyticsParams={{
          destination: 'coding_agent_result',
          provider: codingAgentWithResult?.provider,
          repo_provider: codingAgentResult?.repo_provider,
        }}
        disabled={disabled}
        group={group}
        href={resultLink.url}
      >
        {resultLink.label}
      </LinkAction>
    );
  }

  const codingAgent = codingAgents.find(agent => agent.agent_url);
  if (codingAgent?.agent_url) {
    return (
      <LinkAction
        analyticsEventKey="issue_inbox.seer_cta_clicked"
        analyticsEventName="Issue Inbox: Open in Coding Agent Clicked"
        analyticsParams={{destination: 'coding_agent', provider: codingAgent.provider}}
        disabled={disabled}
        group={group}
        href={codingAgent.agent_url}
      >
        {t('Open in %s', getCodingAgentName(codingAgent.provider))}
      </LinkAction>
    );
  }

  const nextStep = getAutofixNextStep({sections});

  switch (nextStep?.action) {
    case 'create_pr':
      return (
        <StartAutofixAction
          action={() => autofix.createPR(runState.run_id)}
          analyticsAction="create_pr"
          analyticsEventKey="issue_inbox.create_pr_clicked"
          analyticsEventName="Issue Inbox: Create PR Clicked"
          analyticsParams={{is_retry: false}}
          autofix={autofix}
          disabled={disabled}
          group={group}
          label={t('Create PR')}
          onContinueInSeer={onContinueInSeer}
        />
      );
    case 'code_changes':
      return (
        <StartAutofixAction
          action={() => autofix.startStep('code_changes', {runId: runState.run_id})}
          analyticsAction="code_changes"
          analyticsEventKey="issue_inbox.code_fix_clicked"
          analyticsEventName="Issue Inbox: Write Code Fix Clicked"
          autofix={autofix}
          disabled={disabled}
          group={group}
          codingAgentStep="solution"
          label={t('Write a Code Fix')}
          onContinueInSeer={onContinueInSeer}
        />
      );
    case 'solution':
      return (
        <StartAutofixAction
          action={() => autofix.startStep('solution', {runId: runState.run_id})}
          analyticsAction="solution"
          analyticsEventKey="issue_inbox.find_solution_clicked"
          analyticsEventName="Issue Inbox: Make a Plan Clicked"
          autofix={autofix}
          disabled={disabled}
          group={group}
          codingAgentStep="root_cause"
          label={t('Make a Plan')}
          onContinueInSeer={onContinueInSeer}
        />
      );
    case 'pr_iteration':
      return (
        <AutofixActionButton
          analyticsAction="view_autofix"
          analyticsEventKey="issue_inbox.seer_cta_clicked"
          analyticsEventName="Issue Inbox: Continue in Seer Clicked"
          analyticsParams={{destination: 'seer', next_step: 'pr_iteration'}}
          disabled={disabled}
          group={group}
          icon={<IconSeer />}
          onClick={onContinueInSeer}
        >
          {t('Continue in Seer')}
        </AutofixActionButton>
      );
    default:
      return null;
  }
}

export function IssuePreviewActions({
  autofix,
  disabled,
  group,
  onContinueInSeer,
}: IssuePreviewActionsProps) {
  if (autofix.isLoading) {
    return <Placeholder width="120px" height="32px" />;
  }

  return (
    <ActionButtons
      autofix={autofix}
      disabled={disabled}
      group={group}
      onContinueInSeer={onContinueInSeer}
    />
  );
}
