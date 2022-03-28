import styled from '@emotion/styled';
import { HTMLAttributes } from 'react';
import { StepDescriptor } from '../types';

export const StepperContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: 8px;
`;

export const StepperIndicator = styled('span')<{active?: boolean; clickable?: boolean}>`
  height: 8px;
  width: 80px;
  background-color: ${p => (p.active ? p.theme.progressBar : p.theme.progressBackground)};
  &:first-child {
    border-top-left-radius: 4px;
    border-bottom-left-radius: 4px;
  }
  &:last-child {
    border-top-right-radius: 4px;
    border-bottom-right-radius: 4px;
  }
  cursor: ${p => (p.clickable ? 'pointer' : 'default')};
`;

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> & {
  steps: StepDescriptor[],
  currentStepId: string,
  onClick: (step: StepDescriptor) => void,
};

export default function Stepper({ steps, currentStepId, onClick, ...props }: Props) {
  const currentStepIndex = steps.findIndex(step => step.id === currentStepId);
  return <StepperContainer {...props}>
    {steps.slice(1).map((step, i) => (
      <StepperIndicator
        active={step.id === currentStepId}
        key={step.id}
        onClick={() => i < currentStepIndex && onClick(step)}
        clickable={i < currentStepIndex}
      />
    ))}
  </StepperContainer>
}
