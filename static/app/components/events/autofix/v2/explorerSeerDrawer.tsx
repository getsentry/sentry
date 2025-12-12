import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Button, ButtonBar} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import AutofixFeedback from 'sentry/components/events/autofix/autofixFeedback';
import {
  hasCodeChanges as checkHasCodeChanges,
  getArtifactsFromBlocks,
  getFilePatchesFromBlocks,
  useExplorerAutofix,
  type AutofixExplorerStep,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  CodeChangesCard,
  ImpactCard,
  RootCauseCard,
  SolutionCard,
  TriageCard,
} from 'sentry/components/events/autofix/v2/artifactCards';
import {ExplorerAutofixStart} from 'sentry/components/events/autofix/v2/autofixStart';
import {ExplorerStatusCard} from 'sentry/components/events/autofix/v2/autofixStatusCard';
import {ExplorerNextSteps} from 'sentry/components/events/autofix/v2/nextSteps';
import {formatArtifactsToMarkdown} from 'sentry/components/events/autofix/v2/utils';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import Placeholder from 'sentry/components/placeholder';
import {IconAdd, IconCopy, IconSeer, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/streamline/eventTitle';
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
      <CrumbContainer>
        <ProjectAvatar project={project} />
        <ShortId>{group.shortId}</ShortId>
      </CrumbContainer>
    ),
  },
  {label: getShortEventId(event.id)},
  {label: t('Seer')},
];

interface DrawerNavigatorProps {
  iconVariant: 'loading' | 'waiting';
  organization: Organization;
  project: Project;
  copyButtonDisabled?: boolean;
  onCopyMarkdown?: () => void;
  onReset?: () => void;
  showCopyButton?: boolean;
}

/**
 * Common navigator section with header and buttons.
 */
function DrawerNavigator({
  iconVariant,
  organization,
  project,
  copyButtonDisabled = false,
  onCopyMarkdown,
  onReset,
  showCopyButton = false,
}: DrawerNavigatorProps) {
  return (
    <SeerDrawerNavigator>
      <HeaderContainer>
        <Header>{t('Seer')}</Header>
        <IconSeer variant={iconVariant} size="md" />
      </HeaderContainer>
      <ButtonWrapper>
        {showCopyButton && (
          <Button
            size="xs"
            onClick={onCopyMarkdown}
            title={t('Copy analysis as Markdown / LLM prompt')}
            aria-label={t('Copy analysis as Markdown')}
            icon={<IconCopy />}
            disabled={copyButtonDisabled}
          />
        )}
        <Feature features={['organizations:autofix-seer-preferences']}>
          <LinkButton
            to={`/settings/${organization.slug}/projects/${project.slug}/seer/`}
            size="xs"
            title={t('Project Settings for Seer')}
            aria-label={t('Project Settings for Seer')}
            icon={<IconSettings />}
          />
        </Feature>
        <Button
          size="xs"
          onClick={onReset}
          icon={<IconAdd />}
          aria-label={t('Start a new analysis')}
          title={t('Start a new analysis')}
          disabled={!onReset}
        />
      </ButtonWrapper>
    </SeerDrawerNavigator>
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
  const {runState, isLoading, isPolling, startStep, createPR, reset} = useExplorerAutofix(
    group.id
  );

  // Extract data from run state
  const blocks = useMemo(() => runState?.blocks ?? [], [runState?.blocks]);
  const artifacts = useMemo(() => getArtifactsFromBlocks(blocks), [blocks]);
  const filePatches = useMemo(() => getFilePatchesFromBlocks(blocks), [blocks]);
  const loadingBlock = useMemo(() => blocks.find(block => block.loading), [blocks]);
  const hasChanges = checkHasCodeChanges(blocks);
  const prStates = runState?.repo_pr_states;

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

  const breadcrumbs = useMemo(
    () => drawerBreadcrumbs(group, event, project),
    [group, event, project]
  );

  const hasArtifacts =
    !!artifacts.root_cause?.data ||
    !!artifacts.solution?.data ||
    !!artifacts.impact_assessment?.data ||
    !!artifacts.triage?.data;

  // Render loading state for explorer-specific loading
  if (isLoading) {
    return (
      <DrawerContainer>
        <SeerDrawerHeader>
          <NavigationCrumbs crumbs={breadcrumbs} />
        </SeerDrawerHeader>
        <PlaceholderStack>
          <Placeholder height="10rem" />
          <Placeholder height="15rem" />
        </PlaceholderStack>
      </DrawerContainer>
    );
  }

  // No run yet - show start screen (only if autofix is enabled)
  if (!runState && aiConfig.hasAutofix) {
    return (
      <DrawerContainer>
        <SeerDrawerHeader>
          <NavigationCrumbs crumbs={breadcrumbs} />
        </SeerDrawerHeader>
        <DrawerNavigator
          iconVariant="waiting"
          showCopyButton
          copyButtonDisabled
          onCopyMarkdown={handleCopyMarkdown}
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
        <SeerDrawerHeader>
          <NavigationCrumbs crumbs={breadcrumbs} />
        </SeerDrawerHeader>
        <DrawerNavigator
          iconVariant="waiting"
          showCopyButton
          copyButtonDisabled
          onCopyMarkdown={handleCopyMarkdown}
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
      <SeerDrawerHeader>
        <NavigationCrumbs crumbs={breadcrumbs} />
        <FeedbackWrapper>
          <AutofixFeedback />
        </FeedbackWrapper>
      </SeerDrawerHeader>
      <DrawerNavigator
        iconVariant={
          runState.status === 'processing' && isPolling ? 'loading' : 'waiting'
        }
        showCopyButton={hasArtifacts}
        copyButtonDisabled={false}
        onCopyMarkdown={handleCopyMarkdown}
        onReset={() => reset()}
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
          {artifacts.root_cause?.data && (
            <RootCauseCard data={artifacts.root_cause.data} />
          )}
          {artifacts.solution?.data && <SolutionCard data={artifacts.solution.data} />}
          {artifacts.impact_assessment?.data && (
            <ImpactCard data={artifacts.impact_assessment.data} />
          )}
          {artifacts.triage?.data && (
            <TriageCard
              data={artifacts.triage.data}
              group={group}
              organization={organization}
            />
          )}

          {/* Code changes from file patches */}
          {filePatches.length > 0 && (
            <CodeChangesCard
              patches={filePatches}
              prStates={prStates}
              onCreatePR={handleCreatePR}
            />
          )}

          {/* Status card when processing */}
          <ExplorerStatusCard
            status={runState.status}
            loadingBlock={loadingBlock}
            blocks={blocks}
            onOpenChat={handleOpenChat}
          />

          {/* Next step buttons when completed */}
          {runState.status === 'completed' && (
            <ExplorerNextSteps
              artifacts={artifacts}
              hasCodeChanges={hasChanges}
              onStartStep={handleStartStep}
              onCreatePR={() => handleCreatePR()}
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
  background: ${p => p.theme.backgroundSecondary};
`;

const SeerDrawerHeader = styled(DrawerHeader)`
  position: unset;
  max-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: none;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const SeerDrawerNavigator = styled('div')`
  display: flex;
  align-items: center;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space['2xl']};
  background: ${p => p.theme.background};
  z-index: 1;
  min-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: ${p => p.theme.translucentBorder} 0 1px;
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

const HeaderContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const Header = styled('h3')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0;
`;

const NavigationCrumbs = styled(NavigationBreadcrumbs)`
  margin: 0;
  padding: 0;
`;

const CrumbContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  align-items: center;
`;

const ShortId = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1;
`;

const ButtonWrapper = styled(ButtonBar)`
  margin-left: auto;
`;

const FeedbackWrapper = styled('div')`
  margin-left: auto;
  margin-right: ${p => p.theme.space.md};
`;

const PlaceholderStack = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  margin-top: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.xl};
`;
