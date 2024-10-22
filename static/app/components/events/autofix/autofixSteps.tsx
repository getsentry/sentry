import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {AutofixChanges} from 'sentry/components/events/autofix/autofixChanges';
import AutofixInsightCards, {
  useUpdateInsightCard,
} from 'sentry/components/events/autofix/autofixInsightCards';
import AutofixMessageBox from 'sentry/components/events/autofix/autofixMessageBox';
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
  onRetry: () => void;
  repos: AutofixRepository[];
  runId: string;
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
  onRetry,
  repos,
  hasStepBelow,
  hasStepAbove,
  hasErroredStepBefore,
}: StepProps) {
  return (
    <StepCard>
      <ContentWrapper>
        <AnimatePresence initial={false}>
          <AnimationWrapper key="content" {...animationProps}>
            <Fragment>
              {step.type === AutofixStepType.DEFAULT && (
                <AutofixInsightCards
                  insights={step.insights}
                  repos={repos}
                  hasStepBelow={hasStepBelow}
                  hasStepAbove={hasStepAbove}
                  stepIndex={step.index}
                  groupId={groupId}
                  runId={runId}
                />
              )}
              {step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS && (
                <AutofixRootCause
                  groupId={groupId}
                  runId={runId}
                  causes={step.causes}
                  rootCauseSelection={step.selection}
                  repos={repos}
                />
              )}
              {step.type === AutofixStepType.CHANGES && (
                <AutofixChanges
                  step={step}
                  groupId={groupId}
                  onRetry={onRetry}
                  runId={runId}
                />
              )}
              {hasErroredStepBefore && hasStepBelow && (
                <StepMessage>
                  Autofix encountered an error.
                  <br />
                  Restarting step from scratch...
                </StepMessage>
              )}
            </Fragment>
          </AnimationWrapper>
        </AnimatePresence>
      </ContentWrapper>
    </StepCard>
  );
}

function useInView(ref: HTMLElement | null) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    });

    if (!ref) {
      return () => {
        observer.disconnect();
      };
    }

    observer.observe(ref);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return inView;
}

export function AutofixSteps({data, groupId, runId, onRetry}: AutofixStepsProps) {
  const steps = data.steps;
  const repos = data.repositories;

  const stepsRef = useRef<(HTMLDivElement | null)[]>([]);

  const {mutate: handleSelectFix} = useSelectCause({groupId, runId});
  const selectRootCause = (text: string, isCustom?: boolean) => {
    if (isCustom) {
      handleSelectFix({customRootCause: text});
    } else {
      if (!steps) {
        return;
      }
      const step = steps[steps.length - 1];
      if (step.type !== AutofixStepType.ROOT_CAUSE_ANALYSIS) {
        return;
      }
      const cause = step.causes[0];
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

  const lastStepVisible = useInView(
    stepsRef.current.length ? stepsRef.current[stepsRef.current.length - 1] : null
  );

  if (!steps) {
    return null;
  }

  const lastStep = steps[steps.length - 1];
  const logs: AutofixProgressItem[] = lastStep.progress?.filter(isProgressLog) ?? [];
  const activeLog =
    lastStep.completedMessage ?? replaceHeadersWithBold(logs.at(-1)?.message ?? '') ?? '';

  const isRootCauseSelectionStep =
    lastStep.type === AutofixStepType.ROOT_CAUSE_ANALYSIS &&
    lastStep.status === 'COMPLETED';

  const isChangesStep =
    lastStep.type === AutofixStepType.CHANGES && lastStep.status === 'COMPLETED';

  const scrollToMatchingStep = () => {
    const matchingStepIndex = steps.findIndex(step => step.type === lastStep.type);
    if (matchingStepIndex !== -1 && stepsRef.current[matchingStepIndex]) {
      stepsRef.current[matchingStepIndex]?.scrollIntoView({behavior: 'smooth'});
    }
  };

  return (
    <div>
      <StepsContainer>
        {steps.map((step, index) => {
          const previousStep = index > 0 ? steps[index - 1] : null;
          const previousStepErrored =
            previousStep !== null &&
            previousStep?.type === step.type &&
            previousStep.status === 'ERROR';
          const nextStep = index + 1 < steps.length ? steps[index + 1] : null;
          const twoInsightStepsInARow =
            nextStep?.type === AutofixStepType.DEFAULT &&
            step.type === AutofixStepType.DEFAULT;
          const twoNonDefaultStepsInARow =
            nextStep?.type !== AutofixStepType.DEFAULT &&
            step.type !== AutofixStepType.DEFAULT;
          return (
            <div ref={el => (stepsRef.current[index] = el)} key={step.id}>
              <Step
                step={step}
                hasStepBelow={index + 1 < steps.length && !twoInsightStepsInARow}
                hasStepAbove={index > 0}
                groupId={groupId}
                runId={runId}
                onRetry={onRetry}
                repos={repos}
                hasErroredStepBefore={previousStepErrored}
              />
              {twoNonDefaultStepsInARow && <StepSeparator />}
            </div>
          );
        })}
      </StepsContainer>

      <AutofixMessageBox
        displayText={activeLog ?? ''}
        step={lastStep}
        responseRequired={lastStep.status === 'WAITING_FOR_USER_RESPONSE'}
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
        scrollIntoView={
          !lastStepVisible &&
          (lastStep.type === AutofixStepType.ROOT_CAUSE_ANALYSIS ||
            lastStep.type === AutofixStepType.CHANGES)
            ? scrollToMatchingStep
            : null
        }
      />
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

const StepSeparator = styled('div')`
  height: 1px;
  margin: ${space(1)} 0;
`;
