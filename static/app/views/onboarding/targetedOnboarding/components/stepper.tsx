import {useRef} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import testableTransition from 'sentry/utils/testableTransition';

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
StepperTransitionIndicator.defaultProps = {
  layout: true,
  transition: testableTransition({
    type: 'tween',
    duration: 1,
  }),
};

type Props = React.HTMLAttributes<HTMLDivElement> & {
  currentStepIndex: number;
  numSteps: number;
  onClick: (stepIndex: number) => void;
};

export default function Stepper({currentStepIndex, numSteps, onClick, ...props}: Props) {
  const stepperContainerRef = useRef<HTMLDivElement>(null);

  return (
    <StepperWrapper {...props}>
      <StepperContainer ref={stepperContainerRef}>
        {Array.from(Array(numSteps).keys()).map((_, i) => (
          <StepperIndicator
            key={i}
            onClick={() => i < currentStepIndex && onClick(i)}
            clickable={i < currentStepIndex}
          >
            {currentStepIndex === i && (
              <StepperTransitionIndicator initial={false} layoutId="animation" />
            )}
          </StepperIndicator>
        ))}
      </StepperContainer>
    </StepperWrapper>
  );
}
