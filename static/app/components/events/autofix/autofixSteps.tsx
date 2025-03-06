import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {AutofixChanges} from 'sentry/components/events/autofix/autofixChanges';
import AutofixInsightCards from 'sentry/components/events/autofix/autofixInsightCards';
import {AutofixOutputStream} from 'sentry/components/events/autofix/autofixOutputStream';
import {
  AutofixRootCause,
  replaceHeadersWithBold,
} from 'sentry/components/events/autofix/autofixRootCause';
import {AutofixSolution} from 'sentry/components/events/autofix/autofixSolution';
import {
  type AutofixData,
  type AutofixProgressItem,
  type AutofixRepository,
  AutofixStatus,
  type AutofixStep,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
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
  step: AutofixStep;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
  shouldCollapseByDefault?: boolean;
}

interface AutofixStepsProps {
  data: AutofixData;
  groupId: string;
  runId: string;
}

function isProgressLog(
  item: AutofixProgressItem | AutofixStep
): item is AutofixProgressItem {
  return 'message' in item && 'timestamp' in item;
}

export function Step({
  step,
  groupId,
  runId,
  repos,
  hasStepBelow,
  hasStepAbove,
  hasErroredStepBefore,
  shouldCollapseByDefault,
  previousDefaultStepIndex,
  previousInsightCount,
}: StepProps) {
  return (
    <StepCard>
      <ContentWrapper>
        <AnimatePresence initial={false}>
          <AnimationWrapper key="content" {...animationProps}>
            <Fragment>
              {hasErroredStepBefore && hasStepAbove && (
                <StepMessage>
                  {t('Autofix encountered an error. Restarting step from scratch...')}
                </StepMessage>
              )}
              {step.type === AutofixStepType.DEFAULT && (
                <AutofixInsightCards
                  insights={step.insights}
                  hasStepBelow={hasStepBelow}
                  hasStepAbove={hasStepAbove}
                  stepIndex={step.index}
                  groupId={groupId}
                  runId={runId}
                  shouldCollapseByDefault={shouldCollapseByDefault}
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
                  previousDefaultStepIndex={previousDefaultStepIndex}
                  previousInsightCount={previousInsightCount}
                />
              )}
              {step.type === AutofixStepType.SOLUTION && (
                <AutofixSolution
                  groupId={groupId}
                  runId={runId}
                  solution={step.solution}
                  description={step.description}
                  solutionSelected={step.solution_selected}
                  customSolution={step.custom_solution}
                  repos={repos}
                  previousDefaultStepIndex={previousDefaultStepIndex}
                  previousInsightCount={previousInsightCount}
                />
              )}
              {step.type === AutofixStepType.CHANGES && (
                <AutofixChanges
                  step={step}
                  groupId={groupId}
                  runId={runId}
                  previousDefaultStepIndex={previousDefaultStepIndex}
                  previousInsightCount={previousInsightCount}
                />
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

  const stepsRef = useRef<Array<HTMLDivElement | null>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!steps?.length) {
    return null;
  }

  if (data.status === AutofixStatus.ERROR) {
    const errorStep = steps.find(step => step.status === AutofixStatus.ERROR);
    const errorMessage = errorStep?.completedMessage || t('Something went wrong.');

    return (
      <ErrorContainer>
        <StyledArrow direction="down" size="sm" />
        <ErrorMessage>
          <strong>{t('Something went wrong with Autofix:')}</strong> {errorMessage}
        </ErrorMessage>
      </ErrorContainer>
    );
  }

  const lastStep = steps[steps.length - 1];
  const logs: AutofixProgressItem[] = lastStep!.progress?.filter(isProgressLog) ?? [];
  const activeLog =
    lastStep!.completedMessage ??
    replaceHeadersWithBold(logs.at(-1)?.message ?? '') ??
    '';

  return (
    <StepsContainer ref={containerRef}>
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

        return (
          <div ref={el => (stepsRef.current[index] = el)} key={step.id}>
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
              shouldCollapseByDefault={
                step.type === AutofixStepType.DEFAULT &&
                nextStep !== null &&
                !twoInsightStepsInARow
              }
              previousDefaultStepIndex={
                previousDefaultStepIndex >= 0 ? previousDefaultStepIndex : undefined
              }
              previousInsightCount={previousInsightCount}
            />
          </div>
        );
      })}
      {((activeLog && lastStep!.status === 'PROCESSING') || lastStep!.output_stream) && (
        <AutofixOutputStream
          stream={lastStep!.output_stream ?? ''}
          activeLog={activeLog}
          groupId={groupId}
          runId={runId}
          responseRequired={lastStep!.status === 'WAITING_FOR_USER_RESPONSE'}
          isProcessing={lastStep!.status === 'PROCESSING'}
        />
      )}
    </StepsContainer>
  );
}

const StepMessage = styled('div')`
  overflow: hidden;
  padding: ${space(1)};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  justify-content: flex-start;
  text-align: left;
`;

const ErrorMessage = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
`;

const StepsContainer = styled('div')``;

const ErrorContainer = styled('div')`
  margin-top: ${space(1)};
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: ${space(1)};
`;

const StyledArrow = styled(IconArrow)`
  color: ${p => p.theme.subText};
  opacity: 0.5;
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
