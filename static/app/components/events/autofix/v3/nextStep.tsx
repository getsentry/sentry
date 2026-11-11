import {useCallback, useMemo, useState, type ReactNode} from 'react';
import {IconAdd} from '@sentry/icons/add';
import {IconChevron} from '@sentry/icons/chevron';
import {IconSeer} from '@sentry/icons/seer';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {MenuComponents} from '@sentry/scraps/compactSelect';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Footer} from '@sentry/scraps/menu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {useAutofixCreditsDisabled} from 'sentry/components/events/autofix/autofixCredits';
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
  isSolutionSection,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

import {PrIterationFeedbackForm} from './prIterationFeedbackForm';
import {RepositoryWritePermissionButton} from './repositoryWritePermissionButton';
import {useAskSeerHandoff} from './useAskSeerHandoff';
import {useCodingAgents} from './useCodingAgents';
import {useRethinkInChat} from './useRethinkInChat';

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
  const creditsDisabled = useAutofixCreditsDisabled('pr_iteration');

  return (
    <PrIterationFeedbackForm
      autofix={autofix}
      groupId={group.id}
      runId={runId}
      referrer={referrer}
      disabled={creditsDisabled}
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
    startStep('solution', {runId});
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

  const rethinkPrompt = t('How can this root cause be improved?');
  const rethinkInChat = useRethinkInChat({
    prompt: rethinkPrompt,
    step: 'root_cause',
  });

  const artifact = useMemo(() => getAutofixArtifactFromSection(section), [section]);
  const creditsDisabled = useAutofixCreditsDisabled('solution', {
    enabled: defined(artifact),
  });

  if (!defined(artifact)) {
    return null;
  }

  return (
    <NextStepTemplate
      isProcessing={isPolling}
      creditsDisabled={creditsDisabled}
      prompt={t('Are you happy with this root cause?')}
      labelNo={t('No')}
      onClickNo={handleNoClick}
      yesButton={
        <Button
          variant="primary"
          disabled={isPolling || creditsDisabled}
          onClick={handleYesClick}
        >
          {t('Yes, make a plan')}
        </Button>
      }
      nevermindButton={
        <Button
          variant="primary"
          disabled={isPolling || creditsDisabled}
          onClick={handleYesClick}
        >
          {t('Nevermind, make a plan')}
        </Button>
      }
      placeholderPrompt={t('Give seer additional context to improve this root cause.')}
      rethinkPrompt={rethinkPrompt}
      rethinkInChat={rethinkInChat}
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
    startStep('code_changes', {runId});
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

  const rethinkPrompt = t('How can this plan be improved?');
  const rethinkInChat = useRethinkInChat({
    prompt: rethinkPrompt,
    step: 'solution',
  });

  const artifact = useMemo(() => getAutofixArtifactFromSection(section), [section]);
  const creditsDisabled = useAutofixCreditsDisabled('code_changes', {
    enabled: defined(artifact),
  });

  if (!defined(artifact)) {
    return null;
  }

  return (
    <NextStepTemplate
      isProcessing={isPolling}
      creditsDisabled={creditsDisabled}
      prompt={t('Are you happy with this plan?')}
      labelNo={t('No')}
      onClickNo={handleNoClick}
      yesButton={
        <Button
          variant="primary"
          disabled={isPolling || creditsDisabled}
          onClick={handleYesClick}
        >
          {t('Yes, write a code fix')}
        </Button>
      }
      nevermindButton={
        <Button
          variant="primary"
          disabled={isPolling || creditsDisabled}
          onClick={handleYesClick}
        >
          {t('Nevermind, write a code fix')}
        </Button>
      }
      placeholderPrompt={t('Give seer additional context to improve this plan.')}
      rethinkPrompt={rethinkPrompt}
      rethinkInChat={rethinkInChat}
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

  const {permissionsTarget, isPending, checkTargetWriteAccess} = useAutofixCreatePrGate({
    group,
    enabled: defined(artifact),
  });
  const creditsDisabled = useAutofixCreditsDisabled('create_pr', {
    enabled: defined(artifact),
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
      creditsDisabled={creditsDisabled}
    />
  );
}

interface CodeChangesNextStepContentProps extends NextStepProps {
  checkTargetWriteAccess: () => Promise<boolean>;
  creditsDisabled: boolean;
  permissionsTarget: PermissionsTarget | null;
}

function CodeChangesActionButton({
  checkTargetWriteAccess,
  creditsDisabled,
  getPermissionsLabel,
  isPolling,
  onClick,
  permissionsTarget,
  readyLabel,
}: {
  checkTargetWriteAccess: () => Promise<boolean>;
  creditsDisabled: boolean;
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
    <Button variant="primary" disabled={isPolling || creditsDisabled} onClick={onClick}>
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
  creditsDisabled,
  permissionsTarget,
}: CodeChangesNextStepContentProps) {
  const organization = useOrganization();
  const {isPolling, createPR, startStep} = autofix;
  const {askSeer, isCodeMode} = useAskSeerHandoff();

  const handleYesClick = () => {
    createPR(runId);
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

  const rethinkPrompt = t('How can this code change be improved?');
  const rethinkInChat = useRethinkInChat({
    prompt: rethinkPrompt,
    step: 'code_changes',
  });

  return (
    <NextStepTemplate
      isProcessing={isPolling}
      creditsDisabled={creditsDisabled}
      prompt={t('Are you happy with these code changes?')}
      labelNo={t('No')}
      onClickNo={handleNoClick}
      yesButton={
        <CodeChangesActionButton
          checkTargetWriteAccess={checkTargetWriteAccess}
          creditsDisabled={creditsDisabled}
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
          creditsDisabled={creditsDisabled}
          getPermissionsLabel={providerName => t('View %s permissions', providerName)}
          isPolling={isPolling}
          onClick={handleYesClick}
          permissionsTarget={permissionsTarget}
          readyLabel={t('Nevermind, draft a PR')}
        />
      }
      placeholderPrompt={t('Give seer additional context to improve this code change.')}
      rethinkPrompt={rethinkPrompt}
      rethinkInChat={rethinkInChat}
      labelRethink={t('Rethink code changes')}
      askSeer={
        isCodeMode ? {onAsk: askSeer, prompt: t('Rethink code changes')} : undefined
      }
    />
  );
}

interface NextStepTemplateProps {
  /**
   * Disables everything here that would start Seer work: the org can't afford
   * the next step, or the check hasn't answered yet. "No" and "Ask Seer" lead
   * only to a re-run or a Seer Agent message, so they go too. Coding agents
   * aren't paid for in Seer credits, so their hand-off stays available.
   */
  creditsDisabled: boolean;
  isProcessing: boolean;
  labelNo: ReactNode;
  labelRethink: ReactNode;
  nevermindButton: ReactNode;
  onClickNo: (prompt: string) => void;
  placeholderPrompt: string;
  prompt: ReactNode;
  rethinkPrompt: string;
  yesButton: ReactNode;
  /**
   * Set only in code mode, where "no" hands the question to Seer Agent with
   * this prompt instead of collecting context for another Autofix step. The
   * agent asks its own follow-ups, so the textarea is redundant there. When
   * `rethinkInChat` is also set, the button asks through that instead.
   */
  askSeer?: {onAsk: (prompt: string) => void; prompt: string};
  codingAgentDisabledReason?: string;
  codingAgentIntegrations?: CodingAgentIntegration[];
  onCodingAgentHandoff?: (integration: CodingAgentIntegration) => void;
  /**
   * When set, "no" (or "Ask Seer" in code mode) opens Seer Agent on
   * `rethinkPrompt` instead of the textarea below, and the reader types their
   * changes into the chat.
   */
  rethinkInChat?: () => void;
}

function NextStepTemplate({
  creditsDisabled,
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
  rethinkInChat,
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
            disabled={isProcessing || creditsDisabled || !userContext.trim()}
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
          <Button
            disabled={isProcessing || creditsDisabled}
            icon={<IconSeer />}
            onClick={rethinkInChat ?? (() => askSeer.onAsk(askSeer.prompt))}
          >
            {t('Ask Seer')}
          </Button>
        ) : (
          <Button
            disabled={isProcessing || creditsDisabled}
            onClick={rethinkInChat ?? (() => handleClickedNo(true))}
          >
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
                <OverlayTrigger.IconButton
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
                <Footer>
                  <MenuComponents.CTALinkButton
                    icon={<IconAdd />}
                    to={`/settings/${organization.slug}/integrations/?category=coding%20agent`}
                  >
                    {t('Add Integration')}
                  </MenuComponents.CTALinkButton>
                </Footer>
              }
            />
          )}
        </ButtonBar>
      </Flex>
    </Stack>
  );
}
