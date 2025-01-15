import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';

const StepperContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  border-radius: 4px;
  position: relative;
  overflow: hidden;
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

type Props = React.HTMLAttributes<HTMLDivElement> & {
  currentStepIndex: number;
  numSteps: number;
  onClick: (stepIndex: number) => void;
};

function Stepper({currentStepIndex, numSteps, onClick, ...props}: Props) {
  return (
    <StepperContainer {...props}>
      {Array(numSteps)
        .fill(0)
        .map((_, i) => (
          <StepperIndicator
            key={i}
            onClick={() => i < currentStepIndex && onClick(i)}
            clickable={i < currentStepIndex}
          >
            {currentStepIndex === i && (
              <StepperTransitionIndicator
                layout
                transition={testableTransition({
                  type: 'spring',
                  stiffness: 175,
                  damping: 18,
                })}
                initial={false}
                layoutId="animation"
              />
            )}
          </StepperIndicator>
        ))}
    </StepperContainer>
  );
}

export default Stepper;
