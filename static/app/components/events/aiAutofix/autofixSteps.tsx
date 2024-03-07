import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import type {
  AutofixData,
  AutofixProgressItem,
  AutofixStep,
} from 'sentry/components/events/aiAutofix/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {IconChevron, IconClose, IconFatal} from 'sentry/icons';
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
    default:
      return null;
  }
}

interface StepProps {
  step: AutofixStep;
  isChild?: boolean;
  stepNumber?: number;
}

interface AutofixStepsProps {
  data: AutofixData;
}

function isProgressLog(
  item: AutofixProgressItem | AutofixStep
): item is AutofixProgressItem {
  return 'message' in item && 'timestamp' in item;
}

function Progress({progress}: {progress: AutofixProgressItem | AutofixStep}) {
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
      <Step step={progress} isChild />
    </ProgressStepContainer>
  );
}

export function Step({step, isChild, stepNumber}: StepProps) {
  const isActive = step.status !== 'PENDING' && step.status !== 'CANCELLED';
  const [isExpanded, setIsExpanded] = useState(false);

  const logs = step.progress.filter(isProgressLog);

  const activeLog = step.completedMessage ?? logs.at(-1)?.message ?? null;
  const hasContent = step.completedMessage || step.progress.length;

  return (
    <StepCard active={isActive}>
      <StepHeader
        isActive={isActive}
        isChild={isChild}
        onClick={() => {
          if (isActive && hasContent) {
            setIsExpanded(value => !value);
          }
        }}
      >
        <StepTitle>
          {stepNumber ? `${stepNumber}. ` : null}
          {step.title}
        </StepTitle>
        {activeLog && !isExpanded && (
          <StepHeaderDescription>{activeLog}</StepHeaderDescription>
        )}
        <StepHeaderRight>
          <StepIcon status={step.status} />
          {isActive && (
            <Button
              icon={<IconChevron size="xs" direction={isExpanded ? 'down' : 'right'} />}
              aria-label={t('Toggle step details')}
              aria-expanded={isExpanded}
              size="zero"
              borderless
              disabled={!hasContent}
            />
          )}
        </StepHeaderRight>
      </StepHeader>
      {isExpanded && (
        <Fragment>
          {step.completedMessage && <StepBody>{step.completedMessage}</StepBody>}
          {step.progress.length > 0 ? (
            <ProgressContainer>
              {step.progress.map((progress, i) => (
                <Progress progress={progress} key={i} />
              ))}
            </ProgressContainer>
          ) : null}
        </Fragment>
      )}
    </StepCard>
  );
}

export function AutofixSteps({data}: AutofixStepsProps) {
  return (
    <div>
      {data.steps?.map((step, index) => (
        <Step step={step} key={step.id} stepNumber={index + 1} />
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

const StepHeader = styled('div')<{isActive: boolean; isChild?: boolean}>`
  display: grid;
  justify-content: space-between;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  padding: ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
  font-family: ${p => p.theme.text.family};
  cursor: ${p => (p.isActive ? 'pointer' : 'default')};

  &:last-child {
    padding-bottom: ${space(2)};
  }
`;

const StepHeaderDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  padding: 0 ${space(2)} 0 ${space(1)};
  margin-left: ${space(1)};
  border-left: 1px solid ${p => p.theme.border};
  ${p => p.theme.overflowEllipsis};
`;

const StepHeaderRight = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  grid-column: -1;
`;

const StepTitle = styled('div')`
  font-weight: bold;

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
