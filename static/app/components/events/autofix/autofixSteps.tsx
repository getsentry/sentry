import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import {AutofixChanges} from 'sentry/components/events/autofix/autofixChanges';
import {AutofixRootCause} from 'sentry/components/events/autofix/autofixRootCause';
import {
  type AutofixData,
  type AutofixProgressItem,
  type AutofixStep,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {
  IconCheckmark,
  IconChevron,
  IconClose,
  IconCode,
  IconFatal,
  IconQuestion,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import usePrevious from 'sentry/utils/usePrevious';

function StepIcon({step}: {step: AutofixStep}) {
  if (step.type === AutofixStepType.CHANGES) {
    return <IconCode size="sm" color="gray300" />;
  }

  if (step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS) {
    return step.selection ? (
      <IconCheckmark size="sm" color="green300" isCircled />
    ) : (
      <IconQuestion size="sm" color="gray300" />
    );
  }

  switch (step.status) {
    case 'PROCESSING':
      return <ProcessingStatusIndicator size={14} mini hideMessage />;
    case 'CANCELLED':
      return <IconClose size="sm" isCircled color="gray300" />;
    case 'ERROR':
      return <IconFatal size="sm" color="red300" />;
    case 'COMPLETED':
      return <IconCheckmark size="sm" color="green300" isCircled />;
    default:
      return null;
  }
}

function stepShouldBeginExpanded(step: AutofixStep) {
  if (step.type === AutofixStepType.CHANGES) {
    return true;
  }

  if (step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS) {
    return step.selection ? false : true;
  }

  return step.status !== 'COMPLETED';
}

interface StepProps {
  groupId: string;
  onRetry: () => void;
  runId: string;
  step: AutofixStep;
  isChild?: boolean;
  stepNumber?: number;
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

function Progress({
  progress,
  groupId,
  runId,
  onRetry,
}: {
  groupId: string;
  onRetry: () => void;
  progress: AutofixProgressItem | AutofixStep;
  runId: string;
}) {
  if (isProgressLog(progress)) {
    return (
      <Fragment>
        <DateTime date={progress.timestamp} format="HH:mm:ss:SSS" />
        <div>{progress.message}</div>
      </Fragment>
    );
  }

  return (
    <ProgressStepContainer>
      <Step step={progress} isChild groupId={groupId} runId={runId} onRetry={onRetry} />
    </ProgressStepContainer>
  );
}

export function Step({step, isChild, groupId, runId, onRetry}: StepProps) {
  const previousStepStatus = usePrevious(step.status);
  const isActive = step.status !== 'PENDING' && step.status !== 'CANCELLED';
  const [isExpanded, setIsExpanded] = useState(() => stepShouldBeginExpanded(step));

  useEffect(() => {
    if (
      previousStepStatus &&
      previousStepStatus !== step.status &&
      step.status === 'COMPLETED'
    ) {
      setIsExpanded(false);
    }
  }, [previousStepStatus, step.status]);

  const logs: AutofixProgressItem[] = step.progress?.filter(isProgressLog) ?? [];
  const activeLog = step.completedMessage ?? logs.at(-1)?.message ?? null;
  const hasContent = Boolean(
    step.completedMessage ||
      step.progress?.length ||
      step.type !== AutofixStepType.DEFAULT
  );
  const canToggle = Boolean(isActive && hasContent);

  return (
    <StepCard active={isActive}>
      <StepHeader
        canToggle={canToggle}
        isChild={isChild}
        onClick={() => {
          if (canToggle) {
            setIsExpanded(value => !value);
          }
        }}
      >
        <StepHeaderLeft>
          <StepIconContainer>
            <StepIcon step={step} />
          </StepIconContainer>
          <StepTitle>{step.title}</StepTitle>
          {activeLog && !isExpanded && (
            <StepHeaderDescription>{activeLog}</StepHeaderDescription>
          )}
        </StepHeaderLeft>
        <StepHeaderRight>
          {canToggle ? (
            <Button
              icon={<IconChevron size="xs" direction={isExpanded ? 'down' : 'right'} />}
              aria-label={t('Toggle step details')}
              aria-expanded={isExpanded}
              size="zero"
              borderless
            />
          ) : null}
        </StepHeaderRight>
      </StepHeader>
      {isExpanded && (
        <Fragment>
          {step.completedMessage && <StepBody>{step.completedMessage}</StepBody>}
          {step.progress && step.progress.length > 0 ? (
            <ProgressContainer>
              {step.progress.map((progress, i) => (
                <Progress
                  progress={progress}
                  key={i}
                  groupId={groupId}
                  runId={runId}
                  onRetry={onRetry}
                />
              ))}
            </ProgressContainer>
          ) : null}
          {step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS && (
            <AutofixRootCause
              groupId={groupId}
              runId={runId}
              causes={step.causes}
              rootCauseSelection={step.selection}
            />
          )}
          {step.type === AutofixStepType.CHANGES && (
            <AutofixChanges step={step} groupId={groupId} onRetry={onRetry} />
          )}
        </Fragment>
      )}
    </StepCard>
  );
}

export function AutofixSteps({data, groupId, runId, onRetry}: AutofixStepsProps) {
  return (
    <div>
      {data.steps?.map((step, index) => (
        <Step
          step={step}
          key={step.id}
          stepNumber={index + 1}
          groupId={groupId}
          runId={runId}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}

const StepCard = styled(Panel)<{active?: boolean}>`
  opacity: ${p => (p.active ? 1 : 0.6)};
  overflow: hidden;

  :last-child {
    margin-bottom: 0;
  }
`;

const StepHeader = styled('div')<{canToggle: boolean; isChild?: boolean}>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(2)};
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  font-family: ${p => p.theme.text.family};
  cursor: ${p => (p.canToggle ? 'pointer' : 'default')};

  &:last-child {
    padding-bottom: ${space(2)};
  }
`;

const StepHeaderLeft = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
`;

const StepHeaderDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  padding: 0 ${space(2)} 0 ${space(1)};
  margin-left: ${space(1)};
  border-left: 1px solid ${p => p.theme.border};
  flex-grow: 1;
  ${p => p.theme.overflowEllipsis};
`;

const StepIconContainer = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(1)};
`;

const StepHeaderRight = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const StepTitle = styled('div')`
  font-weight: bold;
  white-space: nowrap;
  display: flex;
  flex-shrink: 1;
  align-items: center;
  flex-grow: 0;

  span {
    margin-right: ${space(1)};
  }
`;

const StepBody = styled('p')`
  padding: 0 ${space(2)} ${space(2)} ${space(2)};
  margin: -${space(1)} 0 0 0;
`;

const ProcessingStatusIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
    height: 14px;
    width: 14px;
  }
`;

const ProgressContainer = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(2)};
  display: grid;
  gap: ${space(1)} ${space(2)};
  grid-template-columns: auto 1fr;
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.familyMono};
`;

const ProgressStepContainer = styled('div')`
  grid-column: 1/-1;
`;
