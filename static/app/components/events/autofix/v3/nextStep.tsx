import {useCallback, useMemo, useState, type ReactNode} from 'react';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {MenuComponents} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import {
  organizationIntegrationsCodingAgents,
  type CodingAgentIntegration,
} from 'sentry/components/events/autofix/useAutofix';
import {
  getAutofixArtifactFromSection,
  isCodeChangesSection,
  isRootCauseSection,
  isSolutionSection,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

interface SeerDrawerNextStepProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
  sections: AutofixSection[];
}

export function SeerDrawerNextStep({sections, group, autofix}: SeerDrawerNextStepProps) {
  const runId = autofix.runState?.run_id;
  const section = sections[sections.length - 1];
  const referrer = autofix.runState?.blocks?.[0]?.message?.metadata?.referrer;

  if (!defined(runId) || !defined(section)) {
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

interface NextStepProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
  runId: number;
  section: AutofixSection;
  referrer?: string;
}

function RootCauseNextStep({autofix, group, runId, section, referrer}: NextStepProps) {
  const organization = useOrganization();
  const {isPolling, startStep} = autofix;

  const {codingAgentIntegrations, handleCodingAgentHandoff} = useCodingAgents({
    autofix,
    runId,
    group,
    step: 'root_cause',
    referrer,
  });

  const handleYesClick = useCallback(() => {
    startStep('solution', runId);
    trackAnalytics('autofix.root_cause.find_solution', {
      organization,
      group_id: group.id,
      mode: 'explorer',
      referrer,
    });
  }, [organization, group, startStep, runId, referrer]);

  const handleNoClick = useCallback(
    (userContext: string) => {
      startStep('root_cause', runId, userContext);
      trackAnalytics('autofix.root_cause.re_run', {
        organization,
        group_id: group.id,
        mode: 'explorer',
        referrer,
      });
    },
    [organization, group, startStep, runId, referrer]
  );

  const artifact = useMemo(() => getAutofixArtifactFromSection(section), [section]);

  if (!defined(artifact)) {
    return null;
  }

  return (
    <NextStepTemplate
      isProcessing={isPolling}
      prompt={t('Are you happy with this root cause?')}
      labelYes={t('Yes, make an implementation plan')}
      onClickYes={handleYesClick}
      labelNo={t('No')}
      onClickNo={handleNoClick}
      placeholderPrompt={t('Give seer additional context to improve this root cause.')}
      rethinkPrompt={t('How can this root cause be improved?')}
      labelNevermind={t('Nevermind, make an implementation plan')}
      labelRethink={t('Rethink root cause')}
      codingAgentIntegrations={codingAgentIntegrations}
      onCodingAgentHandoff={handleCodingAgentHandoff}
    />
  );
}

function SolutionNextStep({autofix, group, runId, section, referrer}: NextStepProps) {
  const organization = useOrganization();
  const {isPolling, startStep} = autofix;

  const {codingAgentIntegrations, handleCodingAgentHandoff} = useCodingAgents({
    autofix,
    runId,
    group,
    step: 'solution',
    referrer,
  });

  const handleYesClick = useCallback(() => {
    startStep('code_changes', runId);
    trackAnalytics('autofix.solution.code', {
      organization,
      group_id: group.id,
      mode: 'explorer',
      referrer,
    });
  }, [organization, group, startStep, runId, referrer]);

  const handleNoClick = useCallback(
    (userContext: string) => {
      startStep('solution', runId, userContext);
      trackAnalytics('autofix.solution.re_run', {
        organization,
        group_id: group.id,
        mode: 'explorer',
        referrer,
      });
    },
    [organization, group, startStep, runId, referrer]
  );

  const artifact = useMemo(() => getAutofixArtifactFromSection(section), [section]);

  if (!defined(artifact)) {
    return null;
  }

  return (
    <NextStepTemplate
      isProcessing={isPolling}
      prompt={t('Are you happy with this implementation plan?')}
      labelYes={t('Yes, write a code fix')}
      onClickYes={handleYesClick}
      labelNo={t('No')}
      onClickNo={handleNoClick}
      placeholderPrompt={t(
        'Give seer additional context to improve this implementation plan.'
      )}
      rethinkPrompt={t('How can this implementation plan be improved?')}
      labelNevermind={t('Nevermind, write a code fix')}
      labelRethink={t('Rethink implementation plan')}
      codingAgentIntegrations={codingAgentIntegrations}
      onCodingAgentHandoff={handleCodingAgentHandoff}
    />
  );
}

function CodeChangesNextStep({autofix, group, runId, section, referrer}: NextStepProps) {
  const organization = useOrganization();
  const {isPolling, createPR, startStep} = autofix;

  const handleYesClick = useCallback(() => {
    createPR(runId);
    trackAnalytics('autofix.create_pr_clicked', {
      organization,
      group_id: group.id,
      mode: 'explorer',
      referrer,
    });
  }, [organization, group, createPR, runId, referrer]);

  const handleNoClick = useCallback(
    (userContext: string) => {
      startStep('code_changes', runId, userContext);
      trackAnalytics('autofix.code_changes.re_run', {
        organization,
        group_id: group.id,
        mode: 'explorer',
        referrer,
      });
    },
    [organization, group, startStep, runId, referrer]
  );

  const artifact = useMemo(() => getAutofixArtifactFromSection(section), [section]);

  if (!defined(artifact)) {
    return null;
  }

  return (
    <NextStepTemplate
      isProcessing={isPolling}
      prompt={t('Are you happy with these code changes?')}
      labelYes={t('Yes, draft a PR')}
      onClickYes={handleYesClick}
      labelNo={t('No')}
      onClickNo={handleNoClick}
      placeholderPrompt={t('Give seer additional context to improve this code change.')}
      rethinkPrompt={t('How can this code change be improved?')}
      labelNevermind={t('Nevermind, draft a PR')}
      labelRethink={t('Rethink code changes')}
    />
  );
}

interface NextStepTemplateProps {
  isProcessing: boolean;
  labelNevermind: ReactNode;
  labelNo: ReactNode;
  labelRethink: ReactNode;
  labelYes: ReactNode;
  onClickNo: (prompt: string) => void;
  onClickYes: () => void;
  placeholderPrompt: string;
  prompt: ReactNode;
  rethinkPrompt: ReactNode;
  codingAgentIntegrations?: CodingAgentIntegration[];
  onCodingAgentHandoff?: (integration: CodingAgentIntegration) => void;
}

function NextStepTemplate({
  isProcessing,
  prompt,
  labelYes,
  onClickYes,
  labelNo,
  onClickNo,
  placeholderPrompt,
  rethinkPrompt,
  labelNevermind,
  labelRethink,
  codingAgentIntegrations,
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
      <Flex direction="column" gap="lg">
        <Text>{rethinkPrompt}</Text>
        <TextArea
          autosize
          rows={2}
          placeholder={placeholderPrompt}
          value={userContext}
          onChange={event => setUserContext(event.target.value)}
        />
        <Flex gap="md">
          <Button disabled={isProcessing} onClick={onClickYes}>
            {labelNevermind}
          </Button>
          <Button
            priority="primary"
            disabled={isProcessing}
            onClick={() => onClickNo(userContext)}
          >
            {labelRethink}
          </Button>
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="lg">
      <Text>{prompt}</Text>
      <Flex gap="md">
        <Button disabled={isProcessing} onClick={() => handleClickedNo(true)}>
          {labelNo}
        </Button>
        <ButtonBar>
          <Button priority="primary" disabled={isProcessing} onClick={onClickYes}>
            {labelYes}
          </Button>
          {codingAgentOptions?.length ? (
            <DropdownMenu
              items={codingAgentOptions}
              trigger={(triggerProps, isOpen) => (
                <Button
                  {...triggerProps}
                  disabled={isProcessing}
                  priority="primary"
                  icon={<IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />}
                  aria-label={t('More code fix options')}
                />
              )}
              position="bottom-end"
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
          ) : null}
        </ButtonBar>
      </Flex>
    </Flex>
  );
}

interface UseCodingAgentsOptions {
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
  referrer: string | undefined;
  runId: number;
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
  const codingAgentIntegrations = useMemo(
    () => codingAgentResponse?.integrations,
    [codingAgentResponse?.integrations]
  );

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

  return {codingAgentIntegrations, handleCodingAgentHandoff};
}
