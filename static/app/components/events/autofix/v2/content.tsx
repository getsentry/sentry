import {Fragment, useCallback, useMemo} from 'react';
import {AnimatePresence} from 'framer-motion';

import {Flex} from '@sentry/scraps/layout';

import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
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
import Placeholder from 'sentry/components/placeholder';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import {readStorageValue} from 'sentry/utils/useSessionStorage';
import type {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import {SeerNotices} from 'sentry/views/issueDetails/streamline/sidebar/seerNotices';
import {openSeerExplorer} from 'sentry/views/seerExplorer/openSeerExplorer';
import {useExplorerPanel} from 'sentry/views/seerExplorer/useExplorerPanel';

interface SeerDrawerContentProps {
  aiAutofix: ReturnType<typeof useExplorerAutofix>;
  aiConfig: ReturnType<typeof useAiConfig>;
  group: Group;
  project: Project;
}

export function SeerDrawerContent({
  aiAutofix,
  aiConfig,
  group,
  project,
}: SeerDrawerContentProps) {
  const {startStep} = aiAutofix;

  const handleStartRootCause = useCallback(() => {
    startStep('root_cause');
  }, [startStep]);

  return (
    <Fragment>
      <SeerNotices
        groupId={group.id}
        hasGithubIntegration={aiConfig.hasGithubIntegration}
        project={project}
      />
      {aiAutofix.isLoading ? (
        <Flex direction="column" gap="xl">
          <Placeholder height="10rem" />
          <Placeholder height="15rem" />
        </Flex>
      ) : !aiAutofix.runState && aiConfig.hasAutofix ? (
        <ExplorerAutofixStart onStartRootCause={handleStartRootCause} />
      ) : aiAutofix.runState ? (
        <SeerDrawerArtifacts aiAutofix={aiAutofix} group={group} />
      ) : null}
    </Fragment>
  );
}

interface SeerDrawerArtifactsProps {
  aiAutofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
}

function SeerDrawerArtifacts({aiAutofix, group}: SeerDrawerArtifactsProps) {
  const organization = useOrganization();

  const {isPolling, createPR, runState, startStep, triggerCodingAgentHandoff} = aiAutofix;
  const runId = runState?.run_id;

  const {isOpen: isExplorerPanelOpen} = useExplorerPanel();
  const explorerRunId = readStorageValue<number | null>('seer-explorer-run-id', null);
  const isChatAlreadyOpen =
    isExplorerPanelOpen && !!runState?.run_id && explorerRunId === runId;

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
  const handleStartStep = useCallback(
    (step: AutofixExplorerStep) => startStep(step, runId),
    [startStep, runId]
  );

  const handleCreatePR = useCallback(
    (repoName?: string) => {
      if (runId) {
        createPR(runId, repoName);
      }
    },
    [createPR, runId]
  );

  const handleOpenChat = useCallback(() => {
    if (runId) {
      openSeerExplorer({runId});
    } else {
      openSeerExplorer({startNewRun: true});
    }
  }, [runId]);

  const handleCodingAgentHandoff = useCallback(
    (integration: CodingAgentIntegration) => {
      if (runId) {
        triggerCodingAgentHandoff(runId, integration);
      }
    },
    [triggerCodingAgentHandoff, runId]
  );

  if (!runState) {
    // we expect run state to be non null here
    return null;
  }

  return (
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
                <RootCauseCard key="root_cause" data={artifact.data as ArtifactData} />
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
              return <SolutionCard key="solution" data={artifact.data as ArtifactData} />;
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
            isChatAlreadyOpen={isChatAlreadyOpen}
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
          isChatAlreadyOpen={isChatAlreadyOpen}
          onStartStep={handleStartStep}
          onCodingAgentHandoff={handleCodingAgentHandoff}
          onOpenChat={handleOpenChat}
          isLoading={isPolling}
        />
      )}
    </Flex>
  );
}
