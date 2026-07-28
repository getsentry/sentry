import {useCallback, useMemo, useState, type ReactNode} from 'react';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';

import {Button, ButtonBar, LinkButton} from '@sentry/scraps/button';
import {MenuComponents} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {
  organizationIntegrationsCodingAgents,
  type CodingAgentIntegration,
} from 'sentry/components/events/autofix/useAutofix';
import {useAutofixRepos} from 'sentry/components/events/autofix/useAutofixRepos';
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
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconOpen} from 'sentry/icons/iconOpen';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {defined} from 'sentry/utils/defined';
import {useIntegrations} from 'sentry/utils/integrations/useIntegrations';
import {
  getSeerProjectReposInfiniteQueryOptions,
  isGitHubProvider,
} from 'sentry/utils/seer/seerProjectRepos';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';
import {getProviderPermissionsUrl} from 'sentry/views/settings/organizationRepositories/getProviderConfigUrl';

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
      codingAgentIntegrations={codingAgentIntegrations}
      codingAgentDisabledReason={codingAgentDisabledReason}
      onCodingAgentHandoff={handleCodingAgentHandoff}
    />
  );
}

function SolutionNextStep({autofix, group, runId, section, referrer}: NextStepProps) {
  const organization = useOrganization();
  const {isPolling, startStep} = autofix;

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
      codingAgentIntegrations={codingAgentIntegrations}
      codingAgentDisabledReason={codingAgentDisabledReason}
      onCodingAgentHandoff={handleCodingAgentHandoff}
    />
  );
}

function CodeChangesNextStep({autofix, group, runId, section, referrer}: NextStepProps) {
  const artifact = useMemo(() => getAutofixArtifactFromSection(section), [section]);

  const repos = useAutofixRepos({group, enabled: defined(artifact)});
  const integrationIds =
    repos.data?.repos
      ?.filter(repo => !repo.has_write_access)
      .map(repo => repo.integration_id) ?? [];
  const {integrations, isPending: isIntegrationsPending} = useIntegrations({
    integrationIds,
  });
  const permissionsUrls = integrations
    .map(integration => {
      const url = getProviderPermissionsUrl(integration);
      if (!defined(url)) {
        return null;
      }
      return {
        integration,
        url,
      };
    })
    .filter(Boolean);

  if (!defined(artifact)) {
    return null;
  }

  if (repos.isPending || isIntegrationsPending) {
    return null;
  }

  if (permissionsUrls.length) {
    return (
      <CodeChangesNextStepWithoutWritePermissions
        group={group}
        autofix={autofix}
        runId={runId}
        section={section}
        referrer={referrer}
        integration={permissionsUrls[0]!.integration}
        permissionsUrl={permissionsUrls[0]!.url}
      />
    );
  }

  return (
    <CodeChangesNextStepWithWritePermissions
      group={group}
      autofix={autofix}
      runId={runId}
      section={section}
      referrer={referrer}
    />
  );
}

interface CodeChangesNextStepWithoutWritePermissionsProps extends NextStepProps {
  integration: OrganizationIntegration;
  permissionsUrl: string;
}

function CodeChangesNextStepWithoutWritePermissions({
  autofix,
  group,
  runId,
  section,
  referrer,
  integration,
  permissionsUrl,
}: CodeChangesNextStepWithoutWritePermissionsProps) {
  const organization = useOrganization();
  const {isPolling, startStep} = autofix;

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
        <Tooltip
          title={t(
            'You need to grant write permissions for your %s integration',
            integration.provider.name
          )}
        >
          <LinkButton
            external
            openInNewTab
            variant="primary"
            disabled={isPolling}
            to={permissionsUrl}
            icon={<IconOpen />}
          >
            {t('Yes, view %s permissions', integration.provider.name)}
          </LinkButton>
        </Tooltip>
      }
      nevermindButton={
        <Tooltip
          title={t(
            'You need to grant write permissions for your %s integration',
            integration.provider.name
          )}
        >
          <LinkButton
            external
            openInNewTab
            variant="primary"
            disabled={isPolling}
            to={permissionsUrl}
            icon={<IconOpen />}
          >
            {t('Nevermind, view %s permissions', integration.provider.name)}
          </LinkButton>
        </Tooltip>
      }
      placeholderPrompt={t('Give seer additional context to improve this code change.')}
      rethinkPrompt={t('How can this code change be improved?')}
      labelRethink={t('Rethink code changes')}
    />
  );
}

function CodeChangesNextStepWithWritePermissions({
  autofix,
  group,
  runId,
  section,
  referrer,
}: NextStepProps) {
  const organization = useOrganization();
  const {isPolling, createPR, startStep} = autofix;

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

  return (
    <NextStepTemplate
      isProcessing={isPolling}
      prompt={t('Are you happy with these code changes?')}
      labelNo={t('No')}
      onClickNo={handleNoClick}
      yesButton={
        <Button variant="primary" disabled={isPolling} onClick={handleYesClick}>
          {t('Yes, draft a PR')}
        </Button>
      }
      nevermindButton={
        <Button variant="primary" disabled={isPolling} onClick={handleYesClick}>
          {t('Nevermind, draft a PR')}
        </Button>
      }
      placeholderPrompt={t('Give seer additional context to improve this code change.')}
      rethinkPrompt={t('How can this code change be improved?')}
      labelRethink={t('Rethink code changes')}
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
        <Button disabled={isProcessing} onClick={() => handleClickedNo(true)}>
          {labelNo}
        </Button>
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

interface UseCodingAgentsOptions {
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
  referrer: string | undefined;
  runId: SeerExplorerRunId;
  step: 'root_cause' | 'solution';
}

function useCodingAgents({
  autofix,
  group,
  runId,
  step,
  referrer,
}: UseCodingAgentsOptions) {
  const organization = useOrganization();
  const {triggerCodingAgentHandoff} = autofix;

  const {data: codingAgentResponse} = useQuery(
    organizationIntegrationsCodingAgents(organization)
  );

  const reposQuery = useInfiniteQuery({
    ...getSeerProjectReposInfiniteQueryOptions({organization, project: group.project}),
    select: ({pages}) => pages.flatMap(page => page.json),
  });
  useFetchAllPages({result: reposQuery});
  const repos = reposQuery.data ?? [];

  // `useFetchAllPages` streams pages in across renders, so `isPending` alone only
  // means "page 1 arrived" — not that every repo is loaded. Wait until pagination is
  // fully drained so the gate below is computed over the complete repo list.
  const isReposLoading =
    reposQuery.isPending || reposQuery.isFetchingNextPage || reposQuery.hasNextPage;

  // Disable handoff when the project has no connected repos, or when a non-GitHub repo
  // (e.g. GitLab) is connected — coding agents only operate on GitHub repositories.
  const hasNoRepos = repos.length === 0;
  const hasNonGithubRepo = repos.some(repo => !isGitHubProvider(repo.provider));

  const codingAgentIntegrations = useMemo(
    () => (isReposLoading ? undefined : codingAgentResponse?.integrations),
    [codingAgentResponse?.integrations, isReposLoading]
  );

  const codingAgentDisabledReason = hasNoRepos
    ? t('Connect a GitHub repository to hand off to a coding agent.')
    : hasNonGithubRepo
      ? t('Handing off to a coding agent requires a connected GitHub repository.')
      : undefined;

  const handleCodingAgentHandoff = useCallback(
    (integration: CodingAgentIntegration) => {
      // OAuth redirect for integrations without identity
      if (integration.requires_identity && !integration.has_identity) {
        const currentUrl = window.location.href;
        window.location.href = `/remote/github-copilot/oauth/?next=${encodeURIComponent(currentUrl)}`;
        return;
      }
      triggerCodingAgentHandoff(runId, integration);
      trackAnalytics('autofix.coding_agent.launch', {
        organization,
        group_id: group.id,
        step,
        provider: integration.provider,
        mode: 'explorer',
        referrer,
      });
    },
    [triggerCodingAgentHandoff, organization, runId, group, step, referrer]
  );

  return {codingAgentIntegrations, codingAgentDisabledReason, handleCodingAgentHandoff};
}
