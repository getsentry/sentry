import {useCallback, useMemo} from 'react';
import {AnimatePresence} from 'framer-motion';

import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {
  hasCodeChanges as checkHasCodeChanges,
  getArtifactsFromBlocks,
  getMergedFilePatchesFromBlocks,
  getOrderedArtifactKeys,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  CodeChangesCard,
  CodingAgentHandoffCard,
  SolutionCard,
  type ArtifactData,
} from 'sentry/components/events/autofix/v2/artifactCards';
import {ExplorerStatusCard} from 'sentry/components/events/autofix/v2/autofixStatusCard';
import {ExplorerNextSteps} from 'sentry/components/events/autofix/v2/nextSteps';
import Placeholder from 'sentry/components/placeholder';
import {IconRefresh, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {openSeerExplorer} from 'sentry/views/seerExplorer/openSeerExplorer';

interface InstrumentationFixSectionProps {
  event: Event;
  group: Group;
}

export function InstrumentationFixSection({group}: InstrumentationFixSectionProps) {
  const organization = useOrganization();

  const isSeerExplorerEnabled =
    organization.features.includes('seer-explorer') &&
    !organization.hideAiFeatures &&
    organization.features.includes('gen-ai-features');

  const {
    runState,
    isLoading,
    isPolling,
    startStep,
    createPR,
    reset,
    triggerCodingAgentHandoff,
  } = useExplorerAutofix(group.id);

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

  const handleStartCodeChanges = useCallback(() => {
    startStep('code_changes');
  }, [startStep]);

  const handleStartStep = useCallback(
    async (step: Parameters<typeof startStep>[0]) => {
      await startStep(step, runState?.run_id);
    },
    [startStep, runState?.run_id]
  );

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

  if (!isSeerExplorerEnabled) {
    return null;
  }

  if (isLoading) {
    return (
      <FoldSection
        title={t('Fix with Seer')}
        sectionKey={SectionKey.INSTRUMENTATION_FIX}
        preventCollapse
      >
        <Flex direction="column" gap="md">
          <Placeholder height="10rem" />
        </Flex>
      </FoldSection>
    );
  }

  if (!runState) {
    return (
      <FoldSection title={t('Fix with Seer')} sectionKey={SectionKey.INSTRUMENTATION_FIX}>
        <Flex justify="start" direction="row">
          <Button
            priority="primary"
            icon={<IconSeer />}
            onClick={handleStartCodeChanges}
            analyticsEventKey="issue_details.instrumentation_fix_clicked"
            analyticsEventName="Issue Details: Instrumentation Fix Clicked"
          >
            {t('Generate Fix')}
          </Button>
        </Flex>
      </FoldSection>
    );
  }

  return (
    <FoldSection
      title={t('Fix with Seer')}
      sectionKey={SectionKey.INSTRUMENTATION_FIX}
      actions={
        <Button
          size="xs"
          icon={<IconRefresh />}
          onClick={() => reset()}
          aria-label={t('Start over')}
          title={t('Start over')}
        />
      }
    >
      <Flex direction="column" gap="md">
        <AnimatePresence initial={false}>
          {orderedArtifactKeys.map(key => {
            const artifact = artifacts[key];
            if (!artifact?.data) {
              return null;
            }

            // Only show solution and code changes for instrumentation issues
            if (key === 'solution') {
              return <SolutionCard key="solution" data={artifact.data as ArtifactData} />;
            }
            return null;
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
    </FoldSection>
  );
}
