import {Fragment, useState, type ReactNode} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import type {LocationDescriptor} from 'history';

import {Button, ButtonBar, LinkButton, type ButtonProps} from '@sentry/scraps/button';
import {MenuComponents} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';

import {bulkUpdate} from 'sentry/actionCreators/group';
import {addSuccessMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import {getAutofixNextStep} from 'sentry/components/events/autofix/getAutofixNextStep';
import {findCodingAgentResultLink} from 'sentry/components/events/autofix/pullRequests';
import {getCodingAgentName} from 'sentry/components/events/autofix/types';
import {
  collectPatches,
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  isCodeChangesArtifact,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {useCodingAgents} from 'sentry/components/events/autofix/v3/useCodingAgents';
import {useLinkedPullRequests} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import {Placeholder} from 'sentry/components/placeholder';
import {
  IconAdd,
  IconBug,
  IconChevron,
  IconCode,
  IconGithub,
  IconList,
  IconOpen,
  IconPullRequest,
  IconRefresh,
  IconSeer,
} from 'sentry/icons';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import {IssueListCacheStore} from 'sentry/stores/IssueListCacheStore';
import {
  GroupStatus,
  ProgressState,
  type Group,
  type GroupStatusResolution,
} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getUtcDateString} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {getAnalyicsDataForProject} from 'sentry/utils/projects';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  GroupActions,
  GroupResolutionActions,
} from 'sentry/views/issueDetails/actions/index';
import {useIssuePreviewSeer} from 'sentry/views/issueList/pages/inbox/issuePreview/issuePreviewSeer';

type ExplorerAutofix = ReturnType<typeof useExplorerAutofix>;

function hasCodeChanges(section: AutofixSection): boolean {
  const artifact = getAutofixArtifactFromSection(section);
  return collectPatches(isCodeChangesArtifact(artifact) ? artifact : []).size > 0;
}

function shouldShowFixAppliedActions(group: Group, project: Project) {
  return (
    group.derivedData?.progress === ProgressState.FIX_APPLIED &&
    getConfigForIssueType(group, project).actions.resolve.enabled
  );
}

interface IssuePreviewActionsProps {
  group: Group;
  onContinueInSeer: () => void;
  onRetryCodeChanges: () => void;
  project: Project;
  disabled?: boolean;
}

interface AutofixActionsProps {
  autofix: ExplorerAutofix;
  group: Group;
  onContinueInSeer: () => void;
  onRetryCodeChanges: () => void;
  disabled?: boolean;
}

interface AutofixActionProps extends AutofixActionsProps {
  linkedPullRequestsData: ReturnType<typeof useLinkedPullRequests>['data'];
}

interface AutofixActionButtonProps {
  analyticsEventKey: string;
  analyticsEventName: string;
  group: Group;
  analyticsAction?: string;
  analyticsParams?: ButtonProps['analyticsParams'];
}

export function OpenIssueButton({
  group,
  to,
  size = 'xs',
}: {
  group: Group;
  to: LocationDescriptor;
  size?: 'xs' | 'sm';
}) {
  return (
    <LinkButton
      to={to}
      size={size}
      analyticsEventKey="issue_inbox.open_issue_clicked"
      analyticsEventName="Issue Inbox: Open Issue Clicked"
      analyticsParams={{
        group_id: group.id,
        progress: group.derivedData?.progress,
        source: 'button',
      }}
    >
      {t('Open Issue')}
    </LinkButton>
  );
}

function FixAppliedActions({
  disabled,
  group,
  project,
}: {
  disabled: boolean;
  group: Group;
  project: Project;
}) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const location = useLocation();
  const queryClient = useQueryClient();
  function handleUpdate(data: GroupStatusResolution) {
    bulkUpdate(
      api,
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
        data,
      },
      {
        success: () => {
          clearIndicators();
          addSuccessMessage(
            data.status === GroupStatus.UNRESOLVED
              ? t('Issue marked unresolved')
              : t('Issue resolved')
          );
          IssueListCacheStore.reset();
          const issueListUrl = getApiUrl('/organizations/$organizationIdOrSlug/issues/', {
            path: {organizationIdOrSlug: organization.slug},
          });
          const issueCountUrl = getApiUrl(
            '/organizations/$organizationIdOrSlug/issues-count/',
            {path: {organizationIdOrSlug: organization.slug}}
          );
          const issueUrl = getApiUrl(
            '/organizations/$organizationIdOrSlug/issues/$issueId/',
            {
              path: {
                organizationIdOrSlug: organization.slug,
                issueId: group.id,
              },
            }
          );
          const issueActivitiesUrl = getApiUrl(
            '/organizations/$organizationIdOrSlug/issues/$issueId/activities/',
            {
              path: {
                organizationIdOrSlug: organization.slug,
                issueId: group.id,
              },
            }
          );
          void queryClient.invalidateQueries({
            predicate: query => {
              const url = safeParseQueryKey(query.queryKey)?.url;

              return (
                url === issueListUrl ||
                url === issueCountUrl ||
                url === issueUrl ||
                url === issueActivitiesUrl
              );
            },
          });
        },
      }
    );

    const {alert_date, alert_rule_id, alert_type} = location.query;
    trackAnalytics('issue_inbox.resolve_clicked', {
      organization,
      action_type: data.status,
      action_substatus: data.substatus ?? undefined,
      action_status_details: Object.keys(data.statusDetails || {})[0],
      alert_date:
        typeof alert_date === 'string' ? getUtcDateString(Number(alert_date)) : undefined,
      alert_rule_id: typeof alert_rule_id === 'string' ? alert_rule_id : undefined,
      alert_type: typeof alert_type === 'string' ? alert_type : undefined,
      ...getAnalyticsDataForGroup(group),
      ...getAnalyicsDataForProject(project),
      org_streamline_only: organization.streamlineOnly ?? undefined,
    });
  }

  return (
    <GroupResolutionActions
      disabled={disabled}
      event={null}
      group={group}
      onUpdate={handleUpdate}
      project={project}
    />
  );
}

function getAutofixActionProps({
  analyticsEventKey,
  analyticsEventName,
  analyticsAction,
  analyticsParams,
  group,
}: AutofixActionButtonProps) {
  return {
    variant: 'primary',
    size: 'sm',
    analyticsEventKey,
    analyticsEventName,
    analyticsParams: {
      ...(analyticsAction ? {action: analyticsAction} : {}),
      group_id: group.id,
      progress: group.derivedData?.progress,
      ...analyticsParams,
    },
  } as const;
}

function StartAutofixAction({
  variant = 'primary',
  action,
  analyticsAction,
  analyticsEventKey,
  analyticsEventName,
  analyticsParams,
  autofix,
  codingAgentStep,
  disabled,
  group,
  icon,
  label,
  onContinueInSeer,
  tooltip,
  waiting,
}: Omit<AutofixActionProps, 'linkedPullRequestsData' | 'onRetryCodeChanges'> & {
  action: () => unknown | Promise<unknown>;
  analyticsAction: string;
  analyticsEventKey: string;
  analyticsEventName: string;
  icon: ReactNode;
  label: string;
  analyticsParams?: ButtonProps['analyticsParams'];
  codingAgentStep?: 'root_cause' | 'solution';
  tooltip?: string | null;
  variant?: 'primary' | 'secondary';
  waiting?: boolean;
}) {
  const organization = useOrganization();
  const [isStartingAction, setIsStartingAction] = useState(false);
  const runId = autofix.runState?.run_id;
  const isProcessing = autofix.isProcessing || isStartingAction;
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
    <Button
      {...getAutofixActionProps({
        analyticsAction,
        analyticsEventKey,
        analyticsEventName,
        analyticsParams,
        group,
      })}
      icon={icon}
      busy={isStartingAction || waiting}
      disabled={disabled || isProcessing}
      onClick={handleClick}
      tooltipProps={tooltip ? {title: tooltip} : undefined}
      variant={variant}
    >
      {label}
    </Button>
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
            variant={variant}
            size="sm"
            icon={<IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />}
            aria-label={t('More code fix options')}
            disabled={disabled || isProcessing || defined(codingAgentDisabledReason)}
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

function NextAutofixStepButton({
  autofix,
  disabled,
  group,
  onContinueInSeer,
  onRetryCodeChanges,
  suppressResultLink = false,
  variant = 'primary',
}: Omit<AutofixActionProps, 'linkedPullRequestsData'> & {
  autofix: ExplorerAutofix;
  group: Group;
  onContinueInSeer: () => void;
  disabled?: boolean;
  suppressResultLink?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const {runState, isWaitingForRun} = autofix;
  const sections = getOrderedAutofixSections(runState);

  if (!runState) {
    return (
      <StartAutofixAction
        action={() => autofix.startStep('root_cause')}
        analyticsAction="root_cause"
        analyticsEventKey="issue_inbox.start_fix_clicked"
        analyticsEventName="Issue Inbox: Start Fix Clicked"
        autofix={autofix}
        disabled={disabled}
        group={group}
        icon={<IconBug data-test-id="autofix-root-cause-icon" />}
        label={t('Find Root Cause')}
        onContinueInSeer={onContinueInSeer}
        variant={variant}
        waiting={isWaitingForRun}
      />
    );
  }

  // The run is paused waiting on the user, so continue in the full Seer drawer.
  if (runState.status === 'awaiting_user_input') {
    return (
      <Button
        {...getAutofixActionProps({
          analyticsAction: 'view_autofix',
          analyticsEventKey: 'issue_inbox.seer_cta_clicked',
          analyticsEventName: 'Issue Inbox: Continue in Seer Clicked',
          analyticsParams: {
            destination: 'seer',
            input_type: runState.pending_user_input?.input_type,
          },
          group,
        })}
        busy={autofix.isProcessing}
        disabled={disabled || autofix.isProcessing}
        icon={<IconSeer />}
        onClick={onContinueInSeer}
        variant={variant}
      >
        {runState.pending_user_input?.input_type === 'file_change_approval'
          ? t('Review Changes')
          : t('Continue in Seer')}
      </Button>
    );
  }

  const failedPullRequest = Object.values(runState.repo_pr_states ?? {}).find(
    pullRequest => pullRequest.pr_creation_status === 'error'
  );

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
        variant={variant}
      />
    );
  }

  const codingAgents = Object.values(runState.coding_agents ?? {});
  const codingAgentWithResult = codingAgents.find(agent =>
    agent.results?.some(result => result.pr_url)
  );
  const codingAgentResult = codingAgentWithResult?.results?.find(result => result.pr_url);
  const resultLink = findCodingAgentResultLink(codingAgents);

  if (resultLink && !suppressResultLink) {
    return (
      <LinkButton
        {...getAutofixActionProps({
          analyticsEventKey: 'issue_inbox.coding_agent_result_clicked',
          analyticsEventName: 'Issue Inbox: Coding Agent Result Clicked',
          analyticsParams: {
            provider: codingAgentWithResult?.provider,
            repo_provider: codingAgentResult?.repo_provider,
          },
          group,
        })}
        external
        disabled={disabled}
        href={resultLink.url}
        icon={<IconOpen />}
        variant={variant}
      >
        {defined(resultLink.prNumber) ? t('View PR') : resultLink.label}
      </LinkButton>
    );
  }

  const codingAgent = codingAgents.find(agent => agent.agent_url);
  if (codingAgent?.agent_url) {
    return (
      <LinkButton
        {...getAutofixActionProps({
          analyticsEventKey: 'issue_inbox.open_in_coding_agent_clicked',
          analyticsEventName: 'Issue Inbox: Open in Coding Agent Clicked',
          analyticsParams: {
            provider: codingAgent.provider,
          },
          group,
        })}
        external
        disabled={disabled}
        href={codingAgent.agent_url}
        icon={<IconOpen />}
        variant={variant}
      >
        {t('Open in %s', getCodingAgentName(codingAgent.provider))}
      </LinkButton>
    );
  }

  const nextStep = getAutofixNextStep({sections});
  if (autofix.isProcessing) {
    const {icon, label} =
      nextStep?.action === 'solution'
        ? {
            icon: <IconList data-test-id="autofix-plan-icon" />,
            label: t('Make a Plan'),
          }
        : nextStep?.action === 'code_changes'
          ? {
              icon: <IconCode data-test-id="autofix-code-changes-icon" />,
              label: t('Write a Code Fix'),
            }
          : {
              icon: <IconBug data-test-id="autofix-root-cause-icon" />,
              label: t('Find Root Cause'),
            };

    return (
      <StartAutofixAction
        action={() => {}}
        analyticsAction="polling"
        analyticsEventKey="issue_inbox.start_fix_clicked"
        analyticsEventName="Issue Inbox: Start Fix Clicked"
        autofix={autofix}
        disabled
        group={group}
        icon={icon}
        label={label}
        onContinueInSeer={onContinueInSeer}
        variant={variant}
        waiting
      />
    );
  }

  // Seer can finish the code changes step without producing a diff. The full
  // Seer drawer offers a retry for this state, so send users there instead of
  // offering to create an empty PR.
  if (nextStep?.action === 'create_pr' && !hasCodeChanges(nextStep.section)) {
    return (
      <Button
        {...getAutofixActionProps({
          analyticsAction: 'retry_code_changes',
          analyticsEventKey: 'issue_inbox.retry_code_changes_clicked',
          analyticsEventName: 'Issue Inbox: Retry Code Changes Clicked',
          group,
        })}
        disabled={disabled}
        icon={<IconRefresh />}
        onClick={onRetryCodeChanges}
        variant={variant}
      >
        {t('Add context & retry')}
      </Button>
    );
  }

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
          icon={<IconPullRequest data-test-id="autofix-pull-request-icon" />}
          label={t('Create PR')}
          onContinueInSeer={onContinueInSeer}
          variant={variant}
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
          icon={<IconCode data-test-id="autofix-code-changes-icon" />}
          label={t('Write a Code Fix')}
          onContinueInSeer={onContinueInSeer}
          variant={variant}
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
          icon={<IconList data-test-id="autofix-plan-icon" />}
          label={t('Make a Plan')}
          onContinueInSeer={onContinueInSeer}
          variant={variant}
        />
      );
    // We are not yet supporting PR iteration
    // Open PRs will display a link to the PR, closed PRs will display "Restart Autofix"
    default:
      return (
        <StartAutofixAction
          action={() => autofix.startStep('root_cause')}
          analyticsAction="root_cause"
          analyticsEventKey="issue_inbox.start_fix_clicked"
          analyticsEventName="Issue Inbox: Start Fix Clicked"
          autofix={autofix}
          disabled={disabled}
          group={group}
          icon={<IconRefresh />}
          label={t('Restart Autofix')}
          onContinueInSeer={onContinueInSeer}
          variant={variant}
        />
      );
  }
}

function ActionButtons({
  autofix,
  disabled,
  group,
  linkedPullRequestsData,
  onContinueInSeer,
  onRetryCodeChanges,
}: AutofixActionProps) {
  const openPullRequests =
    linkedPullRequestsData?.pullRequests
      .filter(
        pullRequest => pullRequest.status === 'open' || pullRequest.status === 'draft'
      )
      .sort((a, b) => Date.parse(b.dateCreated) - Date.parse(a.dateCreated)) ?? [];
  const hasMultiplePullRequests = openPullRequests.length > 1;
  const displayedPullRequests = hasMultiplePullRequests
    ? openPullRequests.slice(0, 2)
    : openPullRequests.slice(0, 1);

  if (displayedPullRequests.length > 0) {
    return (
      <Fragment>
        {displayedPullRequests.map((pullRequest, index) => (
          <LinkButton
            key={pullRequest.externalUrl}
            {...getAutofixActionProps({
              analyticsEventKey: 'issue_inbox.seer_cta_clicked',
              analyticsEventName: 'Issue Inbox: Seer CTA Clicked',
              analyticsParams: {destination: 'pull_request'},
              group,
            })}
            external
            disabled={disabled}
            href={pullRequest.externalUrl}
            icon={<IconGithub data-test-id="pull-request-github" />}
            variant={index === 0 ? 'primary' : 'secondary'}
          >
            {hasMultiplePullRequests ? t('View PR #%s', pullRequest.id) : t('View PR')}
          </LinkButton>
        ))}
        <NextAutofixStepButton
          autofix={autofix}
          disabled={disabled}
          group={group}
          onContinueInSeer={onContinueInSeer}
          onRetryCodeChanges={onRetryCodeChanges}
          suppressResultLink={hasMultiplePullRequests}
          variant="secondary"
        />
      </Fragment>
    );
  }

  return (
    <NextAutofixStepButton
      autofix={autofix}
      disabled={disabled}
      group={group}
      onContinueInSeer={onContinueInSeer}
      onRetryCodeChanges={onRetryCodeChanges}
    />
  );
}

function AutofixActions({
  autofix,
  disabled,
  group,
  onContinueInSeer,
  onRetryCodeChanges,
}: AutofixActionsProps) {
  const {data: linkedPullRequestsData, isPending: pullRequestsPending} =
    useLinkedPullRequests({group});

  if ((autofix.isLoading && !autofix.isWaitingForRun) || pullRequestsPending) {
    return <Placeholder width="120px" height="32px" />;
  }

  return (
    <Flex gap="sm">
      <ActionButtons
        autofix={autofix}
        disabled={disabled}
        group={group}
        linkedPullRequestsData={linkedPullRequestsData}
        onContinueInSeer={onContinueInSeer}
        onRetryCodeChanges={onRetryCodeChanges}
      />{' '}
    </Flex>
  );
}

export function IssuePreviewActions({
  disabled = false,
  group,
  onContinueInSeer,
  onRetryCodeChanges,
  project,
}: IssuePreviewActionsProps) {
  const {autofix, isLoading, shouldShowSeerActions} = useIssuePreviewSeer();

  if (shouldShowFixAppliedActions(group, project)) {
    return <FixAppliedActions disabled={disabled} group={group} project={project} />;
  }

  if (isLoading) {
    return <Placeholder width="120px" height="32px" />;
  }

  if (!shouldShowSeerActions) {
    return (
      <GroupActions group={group} project={project} disabled={disabled} event={null} />
    );
  }

  return (
    <AutofixActions
      autofix={autofix}
      disabled={disabled}
      group={group}
      onContinueInSeer={onContinueInSeer}
      onRetryCodeChanges={onRetryCodeChanges}
    />
  );
}
