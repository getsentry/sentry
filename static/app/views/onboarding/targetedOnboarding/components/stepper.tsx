import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import {animate, HTMLMotionProps, motion, useMotionValue} from 'framer-motion';

const StepperWrapper = styled('div')`
  border-radius: 4px;
  position: relative;
  overflow: hidden;
`;
StepperWrapper.defaultProps = {
  initial: {opacity: 0},
  animate: {opacity: 1},
  exit: {opacity: 0},
};
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

type Props = HTMLMotionProps<'div'> & {
  currentStepIndex: number;
  numSteps: number;
  onClick: (stepIndex: number) => void;
};

export default function Stepper({currentStepIndex, numSteps, onClick, ...props}: Props) {
  const stepperContainerRef = useRef<HTMLDivElement>(null);
  const stepperX = useMotionValue<null | number>(null);

  // Set initial value of stepperX
  useEffect(() => {
    const parentRect = stepperContainerRef.current?.getBoundingClientRect();
    const rect =
      stepperContainerRef.current?.children[currentStepIndex].getBoundingClientRect();
    if (!rect || !parentRect) {
      return;
    }
    if (stepperX.get() === null) {
      stepperX.set(rect.x - parentRect.x);
    } else {
      animate(stepperX, rect.x - parentRect.x, {
        type: 'tween',
        duration: 1,
      });
    }
  }, [currentStepIndex]);

  return (
    <StepperWrapper {...props}>
      <StepperTransitionIndicator key="animation" style={{x: stepperX}} />
      <StepperContainer ref={stepperContainerRef}>
        {Array.from(Array(numSteps).keys()).map((_, i) => (
          <StepperIndicator
            key={i}
            onClick={() => i < currentStepIndex && onClick(i)}
            clickable={i < currentStepIndex}
          />
        ))}
      </StepperContainer>
    </StepperWrapper>
  );
}
