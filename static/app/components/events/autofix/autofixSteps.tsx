import {Fragment, useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion, type MotionNodeAnimationOptions} from 'framer-motion';

import {AutofixChanges} from 'sentry/components/events/autofix/autofixChanges';
import {AutofixOutputStream} from 'sentry/components/events/autofix/autofixOutputStream';
import {
  AutofixRootCause,
  replaceHeadersWithBold,
} from 'sentry/components/events/autofix/autofixRootCause';
import {AutofixSolution} from 'sentry/components/events/autofix/autofixSolution';
import CodingAgentCard from 'sentry/components/events/autofix/codingAgentCard';
import AutofixInsightCards from 'sentry/components/events/autofix/insights/autofixInsightCards';
import {
  AutofixStepType,
  type AutofixData,
  type AutofixProgressItem,
  type AutofixStep,
  type SeerRepoDefinition,
} from 'sentry/components/events/autofix/types';
import {useAutofixRepos} from 'sentry/components/events/autofix/useAutofix';
import {getAutofixRunErrorMessage} from 'sentry/components/events/autofix/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import testableTransition from 'sentry/utils/testableTransition';
import useOrganization from 'sentry/utils/useOrganization';

const animationProps: MotionNodeAnimationOptions = {
  exit: {opacity: 0},
  initial: {opacity: 0},
  animate: {opacity: 1},
  transition: testableTransition({duration: 0.3}),
};
interface StepProps {
  groupId: string;
  hasErroredStepBefore: boolean;
  hasStepAbove: boolean;
  hasStepBelow: boolean;
  runId: string;
  step: AutofixStep;
  event?: Event;
  isAutoTriggeredRun?: boolean;
  isChangesFirstAppearance?: boolean;
  isRootCauseFirstAppearance?: boolean;
  isSolutionFirstAppearance?: boolean;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
  shouldCollapseByDefault?: boolean;
}

interface AutofixStepsProps {
  data: AutofixData;
  groupId: string;
  runId: string;
  event?: Event;
}

function isProgressLog(
  item: AutofixProgressItem | AutofixStep
): item is AutofixProgressItem {
  return 'message' in item && 'timestamp' in item;
}

function Step({
  step,
  groupId,
  runId,
  hasStepBelow,
  hasStepAbove,
  hasErroredStepBefore,
  previousDefaultStepIndex,
  previousInsightCount,
  isRootCauseFirstAppearance,
  isSolutionFirstAppearance,
  isChangesFirstAppearance,
  isAutoTriggeredRun,
  event,
  codingAgents,
}: StepProps & {codingAgents?: Record<string, any>}) {
  return (
    <StepCard id={`autofix-step-${step.id}`} data-step-type={step.type}>
      <ContentWrapper>
        <AnimatePresence initial={false}>
          <AnimationWrapper key="content" {...animationProps}>
            <Fragment>
              {hasErroredStepBefore && hasStepAbove && (
                <StepMessage>
                  {t('Seer encountered an error. Restarting step from scratch...')}
                </StepMessage>
              )}
              {step.type === AutofixStepType.DEFAULT && (
                <AutofixInsightCards
                  insights={step.insights}
                  hasStepBelow={hasStepBelow}
                  stepIndex={step.index}
                  groupId={groupId}
                  runId={runId}
                  shouldCollapseByDefault={isAutoTriggeredRun && hasStepBelow}
                />
              )}
              {step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS && (
                <AutofixRootCause
                  groupId={groupId}
                  runId={runId}
                  causes={step.causes}
                  rootCauseSelection={step.selection}
                  status={step.status}
                  terminationReason={step.termination_reason}
                  agentCommentThread={step.agent_comment_thread ?? undefined}
                  codingAgents={codingAgents}
                  previousDefaultStepIndex={previousDefaultStepIndex}
                  previousInsightCount={previousInsightCount}
                  isRootCauseFirstAppearance={isRootCauseFirstAppearance}
                  event={event}
                />
              )}
              {step.type === AutofixStepType.SOLUTION && (
                <AutofixSolution
                  groupId={groupId}
                  runId={runId}
                  solution={step.solution}
                  description={step.description}
                  solutionSelected={step.solution_selected}
                  status={step.status}
                  customSolution={step.custom_solution}
                  previousDefaultStepIndex={previousDefaultStepIndex}
                  previousInsightCount={previousInsightCount}
                  agentCommentThread={step.agent_comment_thread ?? undefined}
                  isSolutionFirstAppearance={isSolutionFirstAppearance}
                  event={event}
                />
              )}
              {step.type === AutofixStepType.CHANGES && (
                <AutofixChanges
                  step={step}
                  groupId={groupId}
                  runId={runId}
                  previousDefaultStepIndex={previousDefaultStepIndex}
                  previousInsightCount={previousInsightCount}
                  agentCommentThread={step.agent_comment_thread ?? undefined}
                  isChangesFirstAppearance={isChangesFirstAppearance}
                />
              )}
            </Fragment>
          </AnimationWrapper>
        </AnimatePresence>
      </ContentWrapper>
    </StepCard>
  );
}

export function AutofixSteps({data, groupId, runId, event}: AutofixStepsProps) {
  const organization = useOrganization();
  const codingDisabled =
    organization.enableSeerCoding === undefined ? false : !organization.enableSeerCoding;
  const steps = data.steps;
  const isMountedRef = useRef<boolean>(false);
  const {repos} = useAutofixRepos(groupId);

  const codingAgentData = Object.values(data.coding_agents || {}).map(agent => {
    let repo: SeerRepoDefinition | undefined;
    if (agent.results && agent.results.length > 0) {
      const result = agent.results[0];
      if (result) {
        repo = repos?.find(
          r =>
            result.repo_provider === r.provider &&
            `${r.owner}/${r.name}` === result.repo_full_name
        );
      }
    }
    return {
      codingAgentState: agent,
      repo,
    };
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (!steps?.length) {
    return null;
  }

  const lastStep = steps[steps.length - 1];
  const logs: AutofixProgressItem[] = lastStep!.progress?.filter(isProgressLog) ?? [];
  const activeLog =
    lastStep!.completedMessage ??
    replaceHeadersWithBold(logs.at(-1)?.message ?? '') ??
    '';

  const isInitialMount = !isMountedRef.current;

  const shouldShowOutputStream =
    ((activeLog && lastStep!.status === 'PROCESSING') || lastStep!.output_stream) &&
    lastStep!.type !== AutofixStepType.CHANGES;
  const errorMessage = getAutofixRunErrorMessage(data);
  const shouldShowStandaloneError = errorMessage && !shouldShowOutputStream;

  const isAutoTriggeredRun = !!data.request.options?.auto_run_source;

  return (
    <div>
      {steps.map((step, index) => {
        const previousDefaultStepIndex = steps
          .slice(0, index)
          .findLastIndex(s => s.type === AutofixStepType.DEFAULT);
        const previousDefaultStep =
          previousDefaultStepIndex >= 0 ? steps[previousDefaultStepIndex] : undefined;
        const previousInsightCount =
          previousDefaultStep?.type === AutofixStepType.DEFAULT
            ? previousDefaultStep.insights.length
            : undefined;

        const hasSolutionStepBefore = steps
          .slice(0, index)
          .some(s => s.type === AutofixStepType.SOLUTION);
        const hideStep =
          (codingDisabled && hasSolutionStepBefore) ||
          (codingDisabled && step.type === AutofixStepType.CHANGES);

        const previousStep = index > 0 ? steps[index - 1] : null;
        const previousStepErrored =
          previousStep !== null &&
          previousStep?.type === step.type &&
          previousStep.status === 'ERROR';
        const nextStep = index + 1 < steps.length ? steps[index + 1] : null;
        const twoInsightStepsInARow =
          nextStep?.type === AutofixStepType.DEFAULT &&
          step.type === AutofixStepType.DEFAULT &&
          step.insights.length > 0 &&
          nextStep.insights.length > 0;
        const stepBelowProcessingAndEmpty =
          nextStep?.type === AutofixStepType.DEFAULT &&
          nextStep?.status === 'PROCESSING' &&
          nextStep?.insights?.length === 0;

        if (hideStep) {
          return null;
        }

        return (
          <div key={step.id}>
            <Step
              step={step}
              hasStepBelow={
                index + 1 < steps.length &&
                !twoInsightStepsInARow &&
                !stepBelowProcessingAndEmpty
              }
              hasStepAbove
              groupId={groupId}
              runId={runId}
              hasErroredStepBefore={previousStepErrored}
              shouldCollapseByDefault={
                step.type === AutofixStepType.DEFAULT &&
                nextStep !== null &&
                !twoInsightStepsInARow
              }
              previousDefaultStepIndex={
                previousDefaultStepIndex >= 0 ? previousDefaultStepIndex : undefined
              }
              previousInsightCount={previousInsightCount}
              isRootCauseFirstAppearance={
                step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS && !isInitialMount
              }
              isSolutionFirstAppearance={
                step.type === AutofixStepType.SOLUTION && !isInitialMount
              }
              isChangesFirstAppearance={
                step.type === AutofixStepType.CHANGES && !isInitialMount
              }
              isAutoTriggeredRun={isAutoTriggeredRun}
              event={event}
              codingAgents={data.coding_agents}
            />
          </div>
        );
      })}
      {codingAgentData.map(({codingAgentState, repo}) => (
        <CodingAgentCard
          key={`coding-agent-${codingAgentState.id}`}
          codingAgentState={codingAgentState}
          repo={repo}
        />
      ))}
      {shouldShowOutputStream && (
        <AutofixOutputStream
          stream={lastStep!.output_stream ?? ''}
          activeLog={activeLog}
          groupId={groupId}
          runId={runId}
          responseRequired={lastStep!.status === 'WAITING_FOR_USER_RESPONSE'}
          autofixData={data}
        />
      )}
      {shouldShowStandaloneError && (
        <StandaloneErrorMessage>
          {errorMessage}
          <br />
          Just hit "Start Over."
        </StandaloneErrorMessage>
      )}
    </div>
  );
}

const StepMessage = styled('div')`
  overflow: hidden;
  padding: ${space(1)};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  justify-content: flex-start;
  text-align: left;
`;

const StepCard = styled('div')`
  overflow: hidden;

  :last-child {
    margin-bottom: 0;
  }
`;

const ContentWrapper = styled(motion.div)`
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 300ms;
  will-change: grid-template-rows;

  > div {
    /* So that focused element outlines don't get cut off */
    padding: 0 1px;
    overflow: hidden;
  }
`;

const AnimationWrapper = styled(motion.div)``;

const StandaloneErrorMessage = styled('div')`
  margin: ${space(1)} 0;
  padding: ${space(2)};
  color: ${p => p.theme.subText};
`;
