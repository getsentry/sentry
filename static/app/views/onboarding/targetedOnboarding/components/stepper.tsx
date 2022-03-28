import {HTMLAttributes, useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import {animate, motion, useMotionValue} from 'framer-motion';

import {StepDescriptor} from '../types';

const StepperWrapper = styled('div')`
  border-radius: 4px;
  position: relative;
  overflow: hidden;
`;
const StepperContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: 8px;
`;

const StepperIndicator = styled('span')<{clickable?: boolean}>`
  height: 8px;
  width: 80px;
  background-color: ${p => p.theme.progressBackground};
  cursor: ${p => (p.clickable ? 'pointer' : 'default')};
`;

const StepperTransitionIndicator = styled(motion.span)`
  height: 8px;
  width: 80px;
  background-color: ${p => p.theme.progressBar};
  position: absolute;
`;

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> & {
  currentStepId: string;
  onClick: (step: StepDescriptor) => void;
  steps: StepDescriptor[];
};

export default function Stepper({steps, currentStepId, onClick, ...props}: Props) {
  const stepperContainerRef = useRef<HTMLDivElement>(null);
  const stepperX = useMotionValue(0);

  // Set initial value of stepperX
  useEffect(() => {
    const currentIndex = steps.findIndex(step => step.id === currentStepId);
    const parentRect = stepperContainerRef.current?.getBoundingClientRect();
    const rect =
      stepperContainerRef.current?.children[currentIndex].getBoundingClientRect();
    rect && parentRect && stepperX.set(rect.x - parentRect.x);
  }, []);
  const onClickStartAnimation = (step: StepDescriptor, i: number) => {
    const parentRect = stepperContainerRef.current?.getBoundingClientRect();
    const rect = stepperContainerRef.current?.children[i].getBoundingClientRect();
    rect &&
      parentRect &&
      animate(stepperX, rect.x - parentRect.x, {
        type: 'tween',
        duration: 1,
      });
    onClick(step);
  };

  return (
    <StepperWrapper {...props}>
      <StepperTransitionIndicator key="animation" style={{x: stepperX}} />
      <StepperContainer ref={stepperContainerRef}>
        {steps.map((step, i) => (
          <StepperIndicator
            key={step.id}
            onClick={() => true && onClickStartAnimation(step, i)}
            clickable
          />
        ))}
      </StepperContainer>
    </StepperWrapper>
  );
}
