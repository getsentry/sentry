import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import Feature from 'sentry/components/acl/feature';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import AutofixFeedback from 'sentry/components/events/autofix/autofixFeedback';
import {
  hasCodeChanges as checkHasCodeChanges,
  getArtifactsFromBlocks,
  getMergedFilePatchesFromBlocks,
  getOrderedArtifactKeys,
  useExplorerAutofix,
  type AutofixExplorerStep,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  CodeChangesCard,
  CodingAgentHandoffCard,
  ImpactCard,
  RootCauseCard,
  SolutionCard,
  TriageCard,
  type ArtifactData,
} from 'sentry/components/events/autofix/v2/artifactCards';
import {ExplorerAutofixStart} from 'sentry/components/events/autofix/v2/autofixStart';
import {ExplorerStatusCard} from 'sentry/components/events/autofix/v2/autofixStatusCard';
import {ExplorerNextSteps} from 'sentry/components/events/autofix/v2/nextSteps';
import {formatArtifactsToMarkdown} from 'sentry/components/events/autofix/v2/utils';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import Placeholder from 'sentry/components/placeholder';
import {IconCopy, IconRefresh, IconSeer, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import type {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import {SeerNotices} from 'sentry/views/issueDetails/streamline/sidebar/seerNotices';
import {openSeerExplorer} from 'sentry/views/seerExplorer/openSeerExplorer';

interface ExplorerSeerDrawerProps {
  aiConfig: ReturnType<typeof useAiConfig>;
  event: Event;
  group: Group;
  project: Project;
}

/**
 * Common breadcrumbs for the drawer header.
 */
const drawerBreadcrumbs = (group: Group, event: Event, project: Project) => [
  {
    label: (
      <Flex gap="md" align="center">
        <ProjectAvatar project={project} />
        <Text variant="muted">{group.shortId}</Text>
      </Flex>
    ),
  },
  {label: getShortEventId(event.id)},
  {label: t('Seer')},
];

interface SeerDrawerHeaderProps {
  event: Event;
  group: Group;
  project: Project;
}

function SeerDrawerHeader({event, group, project}: SeerDrawerHeaderProps) {
  const breadcrumbs = useMemo(
    () => drawerBreadcrumbs(group, event, project),
    [group, event, project]
  );
  return (
    <DrawerHeader>
      <NavigationBreadcrumbs crumbs={breadcrumbs} />
    </DrawerHeader>
  );
}

interface SeerDrawerNavigatorProps {
  organization: Organization;
  project: Project;
  loading?: boolean;
  onCopyMarkdown?: () => void;
  onReset?: () => void;
}

function SeerDrawerNavigator({
  loading,
  organization,
  project,
  onCopyMarkdown,
  onReset,
}: SeerDrawerNavigatorProps) {
  return (
    <SeerDrawerNavigatorContainer justify="between" padding="sm 2xl">
      <Flex align="center" gap="sm">
        <Heading as="h3" size="xl">
          {t('Seer')}
        </Heading>
        <IconSeer animation={loading ? 'loading' : 'waiting'} size="md" />
      </Flex>
      <Flex gap="md">
        <AutofixFeedback iconOnly />
        <Feature features={['organizations:autofix-seer-preferences']}>
          <LinkButton
            external
            href={`/settings/${organization.slug}/projects/${project.slug}/seer/`}
            size="xs"
            title={t('Configure Seer settings for this project')}
            aria-label={t('Configure Seer settings for this project')}
            icon={<IconSettings />}
          />
        </Feature>
        <Button
          size="xs"
          onClick={onCopyMarkdown}
          title={t('Copy analysis as Markdown / LLM prompt')}
          aria-label={t('Copy analysis as Markdown')}
          icon={<IconCopy />}
          disabled={!onCopyMarkdown}
        />
        <Button
          size="xs"
          onClick={onReset}
          icon={<IconRefresh />}
          aria-label={t('Start a new analysis from scratch')}
          title={t('Start a new analysis from scratch')}
          disabled={!onReset}
        />
      </Flex>
    </SeerDrawerNavigatorContainer>
  );
}

/**
 * Explorer-based Seer Drawer component.
 *
 * This is the new UI for Autofix when both seer-explorer and autofix-on-explorer
 * feature flags are enabled. It uses the Explorer agent for all analysis instead
 * of the legacy Celery pipeline.
 */
export function ExplorerSeerDrawer({
  group,
  project,
  event,
  aiConfig,
}: ExplorerSeerDrawerProps) {
  const organization = useOrganization();
  const {
    runState,
    isLoading,
    isPolling,
    startStep,
    createPR,
    reset,
    triggerCodingAgentHandoff,
  } = useExplorerAutofix(group.id);

  // Extract data from run state
  const blocks = useMemo(() => runState?.blocks ?? [], [runState?.blocks]);
  const artifacts = useMemo(() => getArtifactsFromBlocks(blocks), [blocks]);
  const mergedPatches = useMemo(() => getMergedFilePatchesFromBlocks(blocks), [blocks]);
  const loadingBlock = useMemo(() => blocks.find(block => block.loading), [blocks]);
  const hasChanges = checkHasCodeChanges(blocks);
  const prStates = runState?.repo_pr_states;
  const codingAgents = runState?.coding_agents;

  const orderedArtifactKeys = useMemo(
    () => getOrderedArtifactKeys(blocks, artifacts),
    [blocks, artifacts]
  );

  // Handlers
  const handleStartStep = useCallback(
    async (step: AutofixExplorerStep) => {
      await startStep(step, runState?.run_id);
    },
    [startStep, runState?.run_id]
  );

  const handleStartRootCause = useCallback(() => {
    startStep('root_cause');
  }, [startStep]);

  const handleCreatePR = useCallback(
    async (repoName?: string) => {
      if (runState?.run_id) {
        await createPR(runState.run_id, repoName);
      }
    },
    [createPR, runState?.run_id]
  );

  const handleOpenChat = useCallback(() => {
    if (runState?.run_id) {
      openSeerExplorer({runId: runState.run_id});
    } else {
      openSeerExplorer({startNewRun: true});
    }
  }, [runState?.run_id]);

  const handleCodingAgentHandoff = useCallback(
    async (integrationId: number) => {
      if (runState?.run_id) {
        await triggerCodingAgentHandoff(runState.run_id, integrationId);
      }
    },
    [triggerCodingAgentHandoff, runState?.run_id]
  );

  const {copy} = useCopyToClipboard();
  const handleCopyMarkdown = useCallback(() => {
    const markdownText = formatArtifactsToMarkdown(
      artifacts as Record<string, {data: Record<string, unknown> | null}>,
      group,
      event
    );
    if (!markdownText.trim()) {
      return;
    }
    copy(markdownText, {successMessage: t('Analysis copied to clipboard.')});
  }, [artifacts, group, event, copy]);

  const hasArtifacts =
    !!artifacts.root_cause?.data ||
    !!artifacts.solution?.data ||
    !!artifacts.impact_assessment?.data ||
    !!artifacts.triage?.data;

  // Render loading state for explorer-specific loading
  if (isLoading) {
    return (
      <DrawerContainer>
        <SeerDrawerHeader event={event} group={group} project={project} />
        <SeerDrawerNavigator
          loading
          onCopyMarkdown={hasArtifacts ? handleCopyMarkdown : undefined}
          onReset={undefined}
          organization={organization}
          project={project}
        />
        <Stack gap="xl" padding="xl">
          <Placeholder height="10rem" />
          <Placeholder height="15rem" />
        </Stack>
      </DrawerContainer>
    );
  }

  // No run yet - show start screen (only if autofix is enabled)
  if (!runState && aiConfig.hasAutofix) {
    return (
      <DrawerContainer>
        <SeerDrawerHeader event={event} group={group} project={project} />
        <SeerDrawerNavigator
          onCopyMarkdown={hasArtifacts ? handleCopyMarkdown : undefined}
          onReset={undefined}
          organization={organization}
          project={project}
        />
        <SeerDrawerBody>
          <SeerNotices
            groupId={group.id}
            hasGithubIntegration={aiConfig.hasGithubIntegration}
            project={project}
          />
          <ExplorerAutofixStart onStartRootCause={handleStartRootCause} />
        </SeerDrawerBody>
      </DrawerContainer>
    );
  }

  // No run state and no autofix enabled - show minimal drawer with notices only
  if (!runState) {
    return (
      <DrawerContainer>
        <SeerDrawerHeader event={event} group={group} project={project} />
        <SeerDrawerNavigator
          onCopyMarkdown={hasArtifacts ? handleCopyMarkdown : undefined}
          onReset={undefined}
          organization={organization}
          project={project}
        />
        <SeerDrawerBody>
          <SeerNotices
            groupId={group.id}
            hasGithubIntegration={aiConfig.hasGithubIntegration}
            project={project}
          />
        </SeerDrawerBody>
      </DrawerContainer>
    );
  }

  // Has run - show artifacts and status
  return (
    <DrawerContainer>
      <SeerDrawerHeader event={event} group={group} project={project} />
      <SeerDrawerNavigator
        loading={runState.status === 'processing' && isPolling}
        onCopyMarkdown={hasArtifacts ? handleCopyMarkdown : undefined}
        onReset={reset}
        organization={organization}
        project={project}
      />
      <SeerDrawerBody>
        <SeerNotices
          groupId={group.id}
          hasGithubIntegration={aiConfig.hasGithubIntegration}
          project={project}
        />

        {/* Artifact cards in sequence */}
        <Flex direction="column" gap="lg">
          <AnimatePresence initial={false}>
            {orderedArtifactKeys.map(key => {
              const artifact = artifacts[key];
              if (!artifact?.data) {
                return null;
              }

              switch (key) {
                case 'root_cause':
                  return (
                    <RootCauseCard
                      key="root_cause"
                      data={artifact.data as ArtifactData}
                    />
                  );
                case 'impact_assessment':
                  return (
                    <ImpactCard
                      key="impact_assessment"
                      data={artifact.data as ArtifactData}
                    />
                  );
                case 'triage':
                  return (
                    <TriageCard
                      key="triage"
                      data={artifact.data as ArtifactData}
                      group={group}
                      organization={organization}
                    />
                  );
                case 'solution':
                  return (
                    <SolutionCard key="solution" data={artifact.data as ArtifactData} />
                  );
                default:
                  return null;
              }
            })}
            {/* Code changes from merged file patches */}
            {mergedPatches.length > 0 && (
              <CodeChangesCard
                patches={mergedPatches}
                prStates={prStates}
                onCreatePR={handleCreatePR}
              />
            )}
            {/* Coding agent handoff status */}
            {codingAgents && Object.keys(codingAgents).length > 0 && (
              <CodingAgentHandoffCard codingAgents={codingAgents} />
            )}
          </AnimatePresence>

          {/* Status card when processing */}
          <AnimatePresence initial={false}>
            {runState.status === 'processing' && (
              <ExplorerStatusCard
                key="status_card"
                status={runState.status}
                loadingBlock={loadingBlock}
                blocks={blocks}
                onOpenChat={handleOpenChat}
              />
            )}
          </AnimatePresence>

          {/* Next step buttons when completed */}
          {runState.status === 'completed' && (
            <ExplorerNextSteps
              artifacts={artifacts}
              hasCodeChanges={hasChanges}
              hasCodingAgents={
                codingAgents !== undefined && Object.keys(codingAgents).length > 0
              }
              onStartStep={handleStartStep}
              onCodingAgentHandoff={handleCodingAgentHandoff}
              onOpenChat={handleOpenChat}
              isLoading={isPolling}
            />
          )}
        </Flex>
      </SeerDrawerBody>
    </DrawerContainer>
  );
}

const DrawerContainer = styled('div')`
  height: 100%;
  display: grid;
  grid-template-rows: auto auto 1fr;
  position: relative;
  background: ${p => p.theme.tokens.background.secondary};
`;

const SeerDrawerBody = styled(DrawerBody)`
  overflow: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  scroll-margin: 0 ${p => p.theme.space.xl};
  direction: rtl;
  * {
    direction: ltr;
  }
`;

const NavigationBreadcrumbs = styled(Breadcrumbs)`
  margin: 0;
  padding: 0;
`;

const SeerDrawerNavigatorContainer = styled(Flex)`
  box-shadow: ${p => p.theme.tokens.border.transparent.neutral.muted} 0 1px;
`;
