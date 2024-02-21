import styled from '@emotion/styled';

import type {AutofixData, AutofixStep} from 'sentry/components/events/aiAutofix/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {IconClose, IconFatal} from 'sentry/icons';
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

export function Step({step, isChild, stepNumber}: StepProps) {
  const isActive = step.status !== 'PENDING' && step.status !== 'CANCELLED';

  return (
    <StepCard active={isActive}>
      <StepHeader isChild={isChild}>
        <StepTitle>
          {stepNumber ? `${stepNumber}. ` : null}
          {step.title}
        </StepTitle>
        <StepIcon status={step.status} />
      </StepHeader>
      {step.description && <StepBody>{step.description}</StepBody>}
      {step.children && step.children.length > 0 && (
        <StepChildrenArea>
          {step.children.map(child => (
            <Step step={child} key={child.id} isChild />
          ))}
        </StepChildrenArea>
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

const StepChildrenArea = styled('div')`
  padding: ${space(2)};
  background-color: ${p => p.theme.backgroundSecondary};
  border-top: 1px solid ${p => p.theme.border};
`;

const StepHeader = styled('div')<{isChild?: boolean}>`
  display: grid;
  justify-content: space-between;
  grid-template-columns: auto auto;
  align-items: center;
  padding: ${space(2)};

  &:last-child {
    padding-bottom: ${space(2)};
  }
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
