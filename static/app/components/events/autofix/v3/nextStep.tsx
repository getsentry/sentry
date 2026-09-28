import {useCallback, useMemo, useState, type ReactNode} from 'react';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {MenuComponents} from '@sentry/scraps/compactSelect';
import {DropdownMenu, DropdownMenuFooter} from '@sentry/scraps/dropdownMenu';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {hasCreatedPullRequests} from 'sentry/components/events/autofix/pullRequests';
import {AUTOFIX_USER_CONTEXT_MAX_LENGTH} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {
  type PermissionsTarget,
  useAutofixCreatePrGate,
} from 'sentry/components/events/autofix/useAutofixCreatePrGate';
import {
  getAutofixArtifactFromSection,
  isCodeChangesSection,
  isPullRequestsSection,
  isRootCauseSection,
  isRunValidForPrIteration,
  isSolutionSection,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {PrIterationFeedbackForm} from 'sentry/components/events/autofix/v3/prIterationFeedbackForm';
import {RepositoryWritePermissionButton} from 'sentry/components/events/autofix/v3/repositoryWritePermissionButton';
import {
  ASK_SEER_CONTINUE_PROMPT,
  useAskSeerHandoff,
} from 'sentry/components/events/autofix/v3/useAskSeerHandoff';
import {useCodingAgents} from 'sentry/components/events/autofix/v3/useCodingAgents';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconChevron} from 'sentry/icons/iconChevron';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

interface SeerDrawerNextStepProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
  sections: AutofixSection[];
}

export function SeerDrawerNextStep({sections, group, autofix}: SeerDrawerNextStepProps) {
  const runId = getAutofixRunId(autofix.runState);
  const section = sections[sections.length - 1];
  const referrer = autofix.runState?.blocks?.[0]?.message?.metadata?.referrer;

  if (!defined(runId) || !defined(section)) {
    return null;
  }

  // Failed create still renders the PR card (Retry PR). That is the next
  // action — don't offer iteration feedback or "draft a PR" again.
  const repoPrStates = autofix.runState?.repo_pr_states;
  if (
    isPullRequestsSection(section) &&
    defined(repoPrStates) &&
    Object.keys(repoPrStates).length > 0 &&
    !hasCreatedPullRequests(repoPrStates)
  ) {
    return null;
  }

  // The PR iteration form stays visible during a run: feedback submitted while
  // processing is queued for the next iteration rather than dropped, so we want
  // users to be able to keep submitting even mid-run.
  if (isPullRequestsSection(section)) {
    return (
      <PullRequestNextStep
        group={group}
        autofix={autofix}
        runId={runId}
        section={section}
        referrer={referrer}
      />
    );
  }

  // Every other next-step action kicks off a fresh run and can't be queued, so
  // hide them while a run is in progress (also hides them right after clicking a
  // next-step button).
  if (autofix.isPolling) {
    return null;
  }

  if (isRootCauseSection(section)) {
    return (
      <RootCauseNextStep
        group={group}
        autofix={autofix}
        runId={runId}
        section={section}
        referrer={referrer}
      />
    );
  }

  if (isSolutionSection(section)) {
    return (
      <SolutionNextStep
        group={group}
        autofix={autofix}
        runId={runId}
        section={section}
        referrer={referrer}
      />
    );
  }

  if (isCodeChangesSection(section)) {
    return (
      <CodeChangesNextStep
        group={group}
        autofix={autofix}
        runId={runId}
        section={section}
        referrer={referrer}
      />
    );
  }

  return null;
}

function PullRequestNextStep({autofix, group, runId, referrer}: NextStepProps) {
  const organization = useOrganization();

  if (!isRunValidForPrIteration(organization)) {
    return null;
  }

  return (
    <PrIterationFeedbackForm
      autofix={autofix}
      groupId={group.id}
      runId={runId}
      referrer={referrer}
    />
  );
}

interface NextStepProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
  runId: SeerExplorerRunId;
  section: AutofixSection;
  referrer?: string;
}

function RootCauseNextStep({autofix, group, runId, section, referrer}: NextStepProps) {
  const organization = useOrganization();
  const {isPolling, startStep} = autofix;
  const {askSeer, isCodeMode} = useAskSeerHandoff();

  const {codingAgentIntegrations, codingAgentDisabledReason, handleCodingAgentHandoff} =
    useCodingAgents({
      autofix,
      runId,
      group,
      step: 'root_cause',
      referrer,
    });

  const handleYesClick = () => {
    if (isCodeMode) {
      askSeer(ASK_SEER_CONTINUE_PROMPT);
    } else {
      startStep('solution', {runId});
    }
    trackAnalytics('autofix.root_cause.find_solution', {
      organization,
      group_id: group.id,
      mode: 'explorer',
      referrer,
    });
  };

  const handleNoClick = useCallback(
    (userContext: string) => {
      startStep('root_cause', {runId, userContext, insertIndex: section.index});
      trackAnalytics('autofix.root_cause.re_run', {
        organization,
        group_id: group.id,
        mode: 'explorer',
        referrer,
      });
    },
    [organization, group, startStep, runId, referrer, section.index]
  );

  const artifact = useMemo(() => getAutofixArtifactFromSection(section), [section]);

  if (!defined(artifact)) {
    return null;
  }

  return (
    <NextStepTemplate
      isProcessing={isPolling}
      prompt={t('Are you happy with this root cause?')}
      labelNo={t('No')}
      onClickNo={handleNoClick}
      yesButton={
        <Button variant="primary" disabled={isPolling} onClick={handleYesClick}>
          {t('Yes, make a plan')}
        </Button>
      }
      nevermindButton={
        <Button variant="primary" disabled={isPolling} onClick={handleYesClick}>
          {t('Nevermind, make a plan')}
        </Button>
      }
      placeholderPrompt={t('Give seer additional context to improve this root cause.')}
      rethinkPrompt={t('How can this root cause be improved?')}
      labelRethink={t('Rethink root cause')}
      askSeer={isCodeMode ? {onAsk: askSeer, prompt: t('Rethink root cause')} : undefined}
      codingAgentIntegrations={codingAgentIntegrations}
      codingAgentDisabledReason={codingAgentDisabledReason}
      onCodingAgentHandoff={handleCodingAgentHandoff}
    />
  );
}

function SolutionNextStep({autofix, group, runId, section, referrer}: NextStepProps) {
  const organization = useOrganization();
  const {isPolling, startStep} = autofix;
  const {askSeer, isCodeMode} = useAskSeerHandoff();

  const {codingAgentIntegrations, codingAgentDisabledReason, handleCodingAgentHandoff} =
    useCodingAgents({
      autofix,
      runId,
      group,
      step: 'solution',
      referrer,
    });

  const handleYesClick = () => {
    if (isCodeMode) {
      askSeer(ASK_SEER_CONTINUE_PROMPT);
    } else {
      startStep('code_changes', {runId});
    }
    trackAnalytics('autofix.solution.code', {
      organization,
      group_id: group.id,
      mode: 'explorer',
      referrer,
    });
  };

  const handleNoClick = useCallback(
    (userContext: string) => {
      startStep('solution', {runId, userContext, insertIndex: section.index});
      trackAnalytics('autofix.solution.re_run', {
        organization,
        group_id: group.id,
        mode: 'explorer',
        referrer,
      });
    },
    [organization, group, startStep, runId, referrer, section.index]
  );

  const artifact = useMemo(() => getAutofixArtifactFromSection(section), [section]);

  if (!defined(artifact)) {
    return null;
  }

  return (
    <NextStepTemplate
      isProcessing={isPolling}
      prompt={t('Are you happy with this plan?')}
      labelNo={t('No')}
      onClickNo={handleNoClick}
      yesButton={
        <Button variant="primary" disabled={isPolling} onClick={handleYesClick}>
          {t('Yes, write a code fix')}
        </Button>
      }
      nevermindButton={
        <Button variant="primary" disabled={isPolling} onClick={handleYesClick}>
          {t('Nevermind, write a code fix')}
        </Button>
      }
      placeholderPrompt={t('Give seer additional context to improve this plan.')}
      rethinkPrompt={t('How can this plan be improved?')}
      labelRethink={t('Rethink plan')}
      askSeer={isCodeMode ? {onAsk: askSeer, prompt: t('Rethink plan')} : undefined}
      codingAgentIntegrations={codingAgentIntegrations}
      codingAgentDisabledReason={codingAgentDisabledReason}
      onCodingAgentHandoff={handleCodingAgentHandoff}
    />
  );
}

function CodeChangesNextStep({autofix, group, runId, section, referrer}: NextStepProps) {
  const artifact = useMemo(() => getAutofixArtifactFromSection(section), [section]);
  // The same answer `CodeChangesNextStepContent` uses to route "yes", so the
  // gate is only skipped when the click really goes to the agent.
  const {isCodeMode} = useAskSeerHandoff();

  // In code mode "yes" asks the agent rather than opening a pull request, so
  // repository write access is beside the point. Leaving the gate on would hide
  // the whole row while it resolves, then offer a permissions CTA in place of
  // the question.
  const {permissionsTarget, isPending, checkTargetWriteAccess} = useAutofixCreatePrGate({
    group,
    enabled: defined(artifact) && !isCodeMode,
  });

  if (!defined(artifact)) {
    return null;
  }

  if (isPending) {
    return null;
  }

  return (
    <CodeChangesNextStepContent
      group={group}
      autofix={autofix}
      runId={runId}
      section={section}
      referrer={referrer}
      permissionsTarget={permissionsTarget}
      checkTargetWriteAccess={checkTargetWriteAccess}
    />
  );
}

interface CodeChangesNextStepContentProps extends NextStepProps {
  checkTargetWriteAccess: () => Promise<boolean>;
  permissionsTarget: PermissionsTarget | null;
}

function CodeChangesActionButton({
  checkTargetWriteAccess,
  getPermissionsLabel,
  isPolling,
  onClick,
  permissionsTarget,
  readyLabel,
}: {
  checkTargetWriteAccess: () => Promise<boolean>;
  getPermissionsLabel: (providerName: string) => string;
  isPolling: boolean;
  onClick: () => void;
  permissionsTarget: PermissionsTarget | null;
  readyLabel: string;
}) {
  if (permissionsTarget) {
    const providerName = permissionsTarget.integration.provider.name;
    return (
      <RepositoryWritePermissionButton
        key={permissionsTarget.integration.id}
        checkTargetWriteAccess={checkTargetWriteAccess}
        disabled={isPolling}
        label={getPermissionsLabel(providerName)}
        permissionsUrl={permissionsTarget.url}
        providerName={providerName}
      />
    );
  }

  return (
    <Button variant="primary" disabled={isPolling} onClick={onClick}>
      {readyLabel}
    </Button>
  );
}

function CodeChangesNextStepContent({
  autofix,
  group,
  runId,
  section,
  referrer,
  checkTargetWriteAccess,
  permissionsTarget,
}: CodeChangesNextStepContentProps) {
  const organization = useOrganization();
  const {isPolling, createPR, startStep} = autofix;
  const {askSeer, isCodeMode} = useAskSeerHandoff();

  const handleYesClick = () => {
    if (isCodeMode) {
      askSeer(ASK_SEER_CONTINUE_PROMPT);
    } else {
      createPR(runId);
    }
    trackAnalytics('autofix.create_pr_clicked', {
      organization,
      group_id: group.id,
      mode: 'explorer',
      referrer,
    });
  };

  const handleNoClick = useCallback(
    (userContext: string) => {
      startStep('code_changes', {runId, userContext, insertIndex: section.index});
      trackAnalytics('autofix.code_changes.re_run', {
        organization,
        group_id: group.id,
        mode: 'explorer',
        referrer,
      });
    },
    [organization, group, startStep, runId, referrer, section.index]
  );

  return (
    <NextStepTemplate
      isProcessing={isPolling}
      prompt={t('Are you happy with these code changes?')}
      labelNo={t('No')}
      onClickNo={handleNoClick}
      yesButton={
        <CodeChangesActionButton
          checkTargetWriteAccess={checkTargetWriteAccess}
          getPermissionsLabel={providerName =>
            t('Yes, view %s permissions', providerName)
          }
          isPolling={isPolling}
          onClick={handleYesClick}
          permissionsTarget={permissionsTarget}
          readyLabel={t('Yes, draft a PR')}
        />
      }
      nevermindButton={
        <CodeChangesActionButton
          checkTargetWriteAccess={checkTargetWriteAccess}
          getPermissionsLabel={providerName => t('View %s permissions', providerName)}
          isPolling={isPolling}
          onClick={handleYesClick}
          permissionsTarget={permissionsTarget}
          readyLabel={t('Nevermind, draft a PR')}
        />
      }
      placeholderPrompt={t('Give seer additional context to improve this code change.')}
      rethinkPrompt={t('How can this code change be improved?')}
      labelRethink={t('Rethink code changes')}
      askSeer={
        isCodeMode ? {onAsk: askSeer, prompt: t('Rethink code changes')} : undefined
      }
    />
  );
}

interface NextStepTemplateProps {
  isProcessing: boolean;
  labelNo: ReactNode;
  labelRethink: ReactNode;
  nevermindButton: ReactNode;
  onClickNo: (prompt: string) => void;
  placeholderPrompt: string;
  prompt: ReactNode;
  rethinkPrompt: ReactNode;
  yesButton: ReactNode;
  /**
   * Set only in code mode, where "no" hands the question to Seer Agent with
   * this prompt instead of collecting context for another Autofix step. The
   * agent asks its own follow-ups, so the textarea is redundant there.
   */
  askSeer?: {onAsk: (prompt: string) => void; prompt: string};
  codingAgentDisabledReason?: string;
  codingAgentIntegrations?: CodingAgentIntegration[];
  onCodingAgentHandoff?: (integration: CodingAgentIntegration) => void;
}

function NextStepTemplate({
  isProcessing,
  prompt,
  yesButton,
  nevermindButton,
  labelNo,
  onClickNo,
  placeholderPrompt,
  rethinkPrompt,
  labelRethink,
  askSeer,
  codingAgentIntegrations,
  codingAgentDisabledReason,
  onCodingAgentHandoff,
}: NextStepTemplateProps) {
  const organization = useOrganization();

  const codingAgentOptions = useMemo(() => {
    return (codingAgentIntegrations ?? []).map(integration => {
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
        onAction: () => onCodingAgentHandoff?.(integration),
      };
    });
  }, [codingAgentIntegrations, onCodingAgentHandoff]);

  const [clickedNo, handleClickedNo] = useState(false);
  const [userContext, setUserContext] = useState('');

  if (clickedNo) {
    return (
      <Stack gap="lg">
        <Text>{rethinkPrompt}</Text>
        <TextArea
          autosize
          rows={2}
          maxLength={AUTOFIX_USER_CONTEXT_MAX_LENGTH}
          placeholder={placeholderPrompt}
          value={userContext}
          onChange={event => setUserContext(event.target.value)}
        />
        <Flex gap="md">
          {nevermindButton}
          <Button
            variant="primary"
            disabled={isProcessing || !userContext.trim()}
            onClick={() => onClickNo(userContext)}
          >
            {labelRethink}
          </Button>
        </Flex>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Text>{prompt}</Text>
      <Flex gap="md">
        {askSeer ? (
          <Button disabled={isProcessing} onClick={() => askSeer.onAsk(askSeer.prompt)}>
            {t('Ask Seer')}
          </Button>
        ) : (
          <Button disabled={isProcessing} onClick={() => handleClickedNo(true)}>
            {labelNo}
          </Button>
        )}
        <ButtonBar>
          {yesButton}
          {codingAgentIntegrations === undefined ? null : (
            <DropdownMenu
              items={codingAgentOptions}
              isDisabled={defined(codingAgentDisabledReason)}
              trigger={(triggerProps, isOpen) => (
                <Button
                  {...triggerProps}
                  disabled={isProcessing || defined(codingAgentDisabledReason)}
                  tooltipProps={{title: codingAgentDisabledReason}}
                  variant="primary"
                  icon={<IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />}
                  aria-label={t('More code fix options')}
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
          )}
        </ButtonBar>
      </Flex>
    </Stack>
  );
}
