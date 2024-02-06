import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import type {AutofixStep} from 'sentry/components/events/aiAutofix/types';
import {IconCheckmark, IconCircle, IconClose, IconFatal, IconSync} from 'sentry/icons';
import {space} from 'sentry/styles/space';

interface StepIconProps {
  status: AutofixStep['status'];
}

function StepIcon({status}: StepIconProps) {
  switch (status) {
    case 'PROCESSING':
      return (
        <SpinningDiv>
          <IconSync size="md" />
        </SpinningDiv>
      );
    case 'COMPLETED':
      return <IconCheckmark size="md" isCircled color="green300" />;
    case 'CANCELLED':
      return <IconClose size="md" isCircled color="gray300" />;
    case 'ERROR':
      return <IconFatal size="md" color="red300" />;
    default:
      return <IconCircle size="md" />;
  }
}

interface StepProps {
  step: AutofixStep;
  isChild?: boolean;
}

export function Step({step, isChild}: StepProps) {
  const isActive = step.status !== 'PENDING' && step.status !== 'CANCELLED';

  return (
    <StepCard active={isActive}>
      <StepContent>
        <StepHeader isChild={isChild}>
          <StepStatus>
            <StepIcon status={step.status} />
          </StepStatus>
          <StepTitle>{step.title}</StepTitle>
        </StepHeader>
        {step.description && (
          <StepBody>
            <StepDescription>{step.description}</StepDescription>
          </StepBody>
        )}
      </StepContent>
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

const SpinAnimation = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(-360deg);
  }
`;

const SpinningDiv = styled('div')`
  animation: ${SpinAnimation} 2s linear infinite;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Hack to make it visually the same size as the other icons */
  scale: 0.9;
`;

const StepCard = styled('div')<{active?: boolean}>`
  display: flex;
  flex-direction: column;
  opacity: ${p => (p.active ? 1 : 0.6)};
`;

const StepChildrenArea = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${space(1)} ${space(2)} ${space(1)} ${space(4)};
  background-color: ${p => p.theme.backgroundSecondary};
  width: 100%;
`;

const StepContent = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${space(1.5)} 0;
`;

const StepDescription = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
`;

const StepHeader = styled('div')<{isChild?: boolean}>`
  display: flex;
  flex-direction: row;
  padding: ${space(0.25)} ${p => (p.isChild ? '0px' : space(2))} ${space(0.25)} ${space(
    2
  )};
  align-items: center;
`;

const StepStatus = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: ${space(4)};
`;

const StepTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: bold;
  flex: 1;
`;

const StepBody = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: ${space(0.5)} ${space(2)};
  margin-left: ${space(4)};
`;
