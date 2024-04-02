import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import {AutofixRootCause} from 'sentry/components/events/autofix/autofixRootCause';
import type {
  AutofixData,
  AutofixProgressItem,
  AutofixRootCauseStep,
  AutofixStep,
} from 'sentry/components/events/autofix/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {IconCheckmark, IconChevron, IconClose, IconFatal} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface StepIconProps {
  status: AutofixStep['status'];
}

function StepIcon({status}: StepIconProps) {
  switch (status) {
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

interface StepProps {
  groupId: string;
  runId: string;
  step: AutofixStep;
  isChild?: boolean;
  stepNumber?: number;
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

function isRootCauseStep(step: AutofixStep): step is AutofixRootCauseStep {
  return step.id === 'root_cause_analysis';
}

function Progress({
  progress,
  groupId,
  runId,
}: {
  groupId: string;
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
      <Step step={progress} isChild groupId={groupId} runId={runId} />
    </ProgressStepContainer>
  );
}

export function Step({step, isChild, groupId, runId}: StepProps) {
  const isActive = step.status !== 'PENDING' && step.status !== 'CANCELLED';
  const [isExpanded, setIsExpanded] = useState(isRootCauseStep(step));

  const logs: AutofixProgressItem[] = isRootCauseStep(step)
    ? step.progress?.filter(isProgressLog) ?? []
    : [];
  const activeLog = step.completedMessage ?? logs.at(-1)?.message ?? null;
  const hasContent = Boolean(step.completedMessage || step.progress?.length);
  const canToggle = Boolean(isActive && hasContent && !isRootCauseStep(step));

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
            <StepIcon status={step.status} />
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
          {step.progress && step.progress.length > 0 && !isRootCauseStep(step) ? (
            <ProgressContainer>
              {step.progress.map((progress, i) => (
                <Progress progress={progress} key={i} groupId={groupId} runId={runId} />
              ))}
            </ProgressContainer>
          ) : null}
          {isRootCauseStep(step) && (
            <AutofixRootCause
              groupId={groupId}
              runId={runId}
              causes={logs.at(-1)?.data.causes}
              selectedOption={logs.at(-1)?.data.selected_option}
            />
          )}
        </Fragment>
      )}
    </StepCard>
  );
}

export function AutofixSteps({data, groupId, runId}: AutofixStepsProps) {
  return (
    <div>
      {data.steps?.map((step, index) => (
        <Step
          step={step}
          key={step.id}
          stepNumber={index + 1}
          groupId={groupId}
          runId={runId}
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
