import {useCallback, useMemo, useState, type ReactNode} from 'react';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
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
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {defined} from 'sentry/utils';
import {useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

interface SeerDrawerNextStepProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  sections: AutofixSection[];
}

export function SeerDrawerNextStep({sections, autofix}: SeerDrawerNextStepProps) {
  const runId = autofix.runState?.run_id;
  const section = sections[sections.length - 1];

  if (!defined(runId) || !defined(section)) {
    return null;
  }

  if (isRootCauseSection(section)) {
    return <RootCauseNextStep autofix={autofix} runId={runId} section={section} />;
  }

  if (isSolutionSection(section)) {
    return <SolutionNextStep autofix={autofix} runId={runId} section={section} />;
  }

  if (isCodeChangesSection(section)) {
    return <CodeChangesNextStep autofix={autofix} runId={runId} section={section} />;
  }

  return null;
}

interface NextStepProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  runId: number;
  section: AutofixSection;
}

function RootCauseNextStep({autofix, runId, section}: NextStepProps) {
  const {isPolling, startStep} = autofix;

  const {codingAgentIntegrations, handleCodingAgentHandoff} = useCodingAgents(
    autofix,
    runId
  );

  const handleYesClick = useCallback(() => {
    startStep('solution', runId);
  }, [startStep, runId]);

  const handleNoClick = useCallback(
    (userContext: string) => {
      startStep('root_cause', runId, userContext);
    },
    [startStep, runId]
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

function SolutionNextStep({autofix, runId, section}: NextStepProps) {
  const {isPolling, startStep} = autofix;

  const {codingAgentIntegrations, handleCodingAgentHandoff} = useCodingAgents(
    autofix,
    runId
  );

  const handleYesClick = useCallback(() => {
    startStep('code_changes', runId);
  }, [startStep, runId]);

  const handleNoClick = useCallback(
    (userContext: string) => {
      startStep('solution', runId, userContext);
    },
    [startStep, runId]
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

function CodeChangesNextStep({autofix, runId, section}: NextStepProps) {
  const {isPolling, createPR, startStep} = autofix;

  const handleYesClick = useCallback(() => {
    createPR(runId);
  }, [createPR, runId]);

  const handleNoClick = useCallback(
    (userContext: string) => {
      startStep('code_changes', runId, userContext);
    },
    [startStep, runId]
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
            />
          ) : null}
        </ButtonBar>
      </Flex>
    </Flex>
  );
}

function useCodingAgents(autofix: ReturnType<typeof useExplorerAutofix>, runId: number) {
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
    },
    [triggerCodingAgentHandoff, runId]
  );

  return {codingAgentIntegrations, handleCodingAgentHandoff};
}
