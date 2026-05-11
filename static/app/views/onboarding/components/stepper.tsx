import styled from '@emotion/styled';
import {motion} from 'framer-motion';

const StepperContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.md};
  border-radius: 4px;
  position: relative;
  overflow: hidden;
`;

const StepperIndicator = styled('span')<{clickable?: boolean}>`
  height: 5px;
  width: 48px;
  background-color: ${p => p.theme.tokens.graphics.neutral.muted};
  cursor: ${p => (p.clickable ? 'pointer' : 'default')};
  border-radius: ${p => p.theme.radius.full};
`;

const StepperTransitionIndicator = styled(motion.span)`
  height: 5px;
  width: 48px;
  background-color: ${p => p.theme.tokens.background.accent.vibrant};
  position: absolute;
  border-radius: ${p => p.theme.radius.full};
`;

type Props = Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> & {
  currentStepIndex: number;
  numSteps: number;
  onClick: (stepIndex: number) => void;
};

export function Stepper({currentStepIndex, numSteps, onClick, ...props}: Props) {
  return (
    <StepperContainer {...props}>
      {Array.from<number>({length: numSteps})
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
                transition={{
                  type: 'spring',
                  stiffness: 175,
                  damping: 18,
                }}
                initial={false}
                layoutId="animation"
              />
            )}
          </StepperIndicator>
        ))}
    </StepperContainer>
  );
}
