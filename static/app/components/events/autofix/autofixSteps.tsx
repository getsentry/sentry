import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {AutofixChanges} from 'sentry/components/events/autofix/autofixChanges';
import AutofixInsightCards, {
  useUpdateInsightCard,
} from 'sentry/components/events/autofix/autofixInsightCards';
import AutofixMessageBox from 'sentry/components/events/autofix/autofixMessageBox';
import {AutofixOutputStream} from 'sentry/components/events/autofix/autofixOutputStream';
import {
  AutofixRootCause,
  useSelectCause,
} from 'sentry/components/events/autofix/autofixRootCause';
import {
  type AutofixData,
  type AutofixProgressItem,
  type AutofixRepository,
  type AutofixStep,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';

const animationProps: AnimationProps = {
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
  repos: AutofixRepository[];
  runId: string;
  shouldHighlightRethink: boolean;
  step: AutofixStep;
}

interface AutofixStepsProps {
  data: AutofixData;
  groupId: string;
  onRetry: () => void;
  runId: string;
}

function isProgressLog(
  item: AutofixProgressItem | AutofixStep
): item is AutofixProgressItem {
  return 'message' in item && 'timestamp' in item;
}

function replaceHeadersWithBold(markdown: string) {
  const headerRegex = /^(#{1,6})\s+(.*)$/gm;
  const boldMarkdown = markdown.replace(headerRegex, (_match, _hashes, content) => {
    return ` **${content}** `;
  });

  return boldMarkdown;
}

export function Step({
  step,
  groupId,
  runId,
  repos,
  hasStepBelow,
  hasStepAbove,
  hasErroredStepBefore,
  shouldHighlightRethink,
}: StepProps) {
  return (
    <StepCard>
      <ContentWrapper>
        <AnimatePresence initial={false}>
          <AnimationWrapper key="content" {...animationProps}>
            <Fragment>
              {hasErroredStepBefore && hasStepAbove && (
                <StepMessage>
                  Autofix encountered an error.
                  <br />
                  Restarting step from scratch...
                </StepMessage>
              )}
              {step.type === AutofixStepType.DEFAULT && (
                <AutofixInsightCards
                  insights={step.insights}
                  repos={repos}
                  hasStepBelow={hasStepBelow}
                  hasStepAbove={hasStepAbove}
                  stepIndex={step.index}
                  groupId={groupId}
                  runId={runId}
                  shouldHighlightRethink={shouldHighlightRethink}
                />
              )}
              {step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS && (
                <AutofixRootCause
                  groupId={groupId}
                  runId={runId}
                  causes={step.causes}
                  rootCauseSelection={step.selection}
                  terminationReason={step.termination_reason}
                  repos={repos}
                />
              )}
              {step.type === AutofixStepType.CHANGES && (
                <AutofixChanges step={step} groupId={groupId} runId={runId} />
              )}
            </Fragment>
          </AnimationWrapper>
        </AnimatePresence>
      </ContentWrapper>
    </StepCard>
  );
}

export function AutofixSteps({data, groupId, runId}: AutofixStepsProps) {
  const steps = data.steps;
  const repos = data.repositories;

  const stepsRef = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasSeenBottom, setHasSeenBottom] = useState(false);
  const [isBottomVisible, setIsBottomVisible] = useState(false);
  const prevStepsLengthRef = useRef(0);
  const prevInsightsCountRef = useRef(0);

  const {mutate: handleSelectFix} = useSelectCause({groupId, runId});
  const selectRootCause = (text: string, isCustom?: boolean) => {
    if (isCustom) {
      handleSelectFix({customRootCause: text});
    } else {
      if (!steps) {
        return;
      }
      const step = steps[steps.length - 1]!;
      if (step.type !== AutofixStepType.ROOT_CAUSE_ANALYSIS) {
        return;
      }
      const cause = step.causes[0]!;
      const id = cause.id;
      handleSelectFix({causeId: id, instruction: text});
    }
  };

  const {mutate: sendFeedbackOnChanges} = useUpdateInsightCard({groupId, runId});
  const iterateOnChangesStep = (text: string) => {
    const planStep = steps?.[steps.length - 2];
    if (!planStep || planStep.type !== AutofixStepType.DEFAULT) {
      return;
    }
    sendFeedbackOnChanges({
      step_index: planStep.index,
      retain_insight_card_index: planStep.insights.length - 1,
      message: text,
    });
  };

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsBottomVisible(entry!.isIntersecting);
        if (entry!.isIntersecting) {
          setHasSeenBottom(true);
        }
      },
      {threshold: 0.1, root: null, rootMargin: '0px'}
    );

    if (bottomRef.current) {
      observer.observe(bottomRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!steps) {
      return;
    }

    const currentStepsLength = steps.length;
    const currentInsightsCount = steps.reduce((count, step) => {
      if (step.type === AutofixStepType.DEFAULT) {
        return count + step.insights.length;
      }
      return count;
    }, 0);

    const hasNewSteps =
      currentStepsLength > prevStepsLengthRef.current &&
      steps[currentStepsLength - 1]!.type !== AutofixStepType.DEFAULT;
    const hasNewInsights = currentInsightsCount > prevInsightsCountRef.current;

    if (hasNewSteps || hasNewInsights) {
      if (!isBottomVisible) {
        setHasSeenBottom(false);
      }
    }

    prevStepsLengthRef.current = currentStepsLength;
    prevInsightsCountRef.current = currentInsightsCount;
  }, [steps, isBottomVisible]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'});
    setHasSeenBottom(true);
  };

  if (!steps) {
    return null;
  }

  const lastStep = steps[steps.length - 1];
  const logs: AutofixProgressItem[] = lastStep!.progress?.filter(isProgressLog) ?? [];
  const activeLog =
    lastStep!.completedMessage ??
    replaceHeadersWithBold(logs.at(-1)?.message ?? '') ??
    '';

  const isRootCauseSelectionStep =
    lastStep!.type === AutofixStepType.ROOT_CAUSE_ANALYSIS &&
    lastStep!.status === 'COMPLETED';

  const isChangesStep =
    lastStep!.type === AutofixStepType.CHANGES && lastStep!.status === 'COMPLETED';

  return (
    <div>
      <StepsContainer ref={containerRef}>
        {steps.map((step, index) => {
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
          const twoNonDefaultStepsInARow =
            previousStep &&
            (previousStep?.type !== AutofixStepType.DEFAULT ||
              previousStep?.insights.length === 0) &&
            step.type !== AutofixStepType.DEFAULT;
          const stepBelowProcessingAndEmpty =
            nextStep?.type === AutofixStepType.DEFAULT &&
            nextStep?.status === 'PROCESSING' &&
            nextStep?.insights?.length === 0;

          const isNextStepLastStep = index === steps.length - 2;
          const shouldHighlightRethink =
            (nextStep?.type === AutofixStepType.ROOT_CAUSE_ANALYSIS &&
              isNextStepLastStep) ||
            (nextStep?.type === AutofixStepType.CHANGES &&
              nextStep.changes.length > 0 &&
              !nextStep.changes.every(change => change.pull_request));

          return (
            <div ref={el => (stepsRef.current[index] = el)} key={step.id}>
              {twoNonDefaultStepsInARow && <br />}
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
                repos={repos}
                hasErroredStepBefore={previousStepErrored}
                shouldHighlightRethink={shouldHighlightRethink}
              />
            </div>
          );
        })}
        {lastStep!.output_stream && (
          <AutofixOutputStream stream={lastStep!.output_stream} />
        )}
      </StepsContainer>

      <AutofixMessageBox
        displayText={activeLog ?? ''}
        step={lastStep!}
        responseRequired={lastStep!.status === 'WAITING_FOR_USER_RESPONSE'}
        onSend={
          !isRootCauseSelectionStep
            ? !isChangesStep
              ? null
              : iterateOnChangesStep
            : selectRootCause
        }
        actionText={!isRootCauseSelectionStep ? 'Send' : 'Find a Fix'}
        allowEmptyMessage={!isRootCauseSelectionStep ? false : true}
        groupId={groupId}
        runId={runId}
        primaryAction={isRootCauseSelectionStep}
        isRootCauseSelectionStep={isRootCauseSelectionStep}
        isChangesStep={isChangesStep}
        scrollIntoView={!hasSeenBottom ? scrollToBottom : null}
        scrollText={
          lastStep!.type === AutofixStepType.ROOT_CAUSE_ANALYSIS
            ? 'View Root Cause'
            : lastStep!.type === AutofixStepType.CHANGES
              ? 'View Fix'
              : 'New Insight'
        }
      />
      <div ref={bottomRef} />
    </div>
  );
}

const StepMessage = styled('div')`
  overflow: hidden;
  padding: ${space(2)};
  color: ${p => p.theme.subText};
  justify-content: center;
  text-align: center;
`;

const StepsContainer = styled('div')`
  margin-bottom: 13em;
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
