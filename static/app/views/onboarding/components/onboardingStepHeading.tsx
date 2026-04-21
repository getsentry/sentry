import styled from '@emotion/styled';
import {motion} from 'framer-motion';

export const OnboardingStepHeading = styled(
  (props: React.ComponentProps<typeof motion.h2> & {step?: number}) => (
    <motion.h2
      variants={{
        initial: {clipPath: 'inset(0% 100% 0% 0%)', opacity: 1},
        animate: {clipPath: 'inset(0% 0% 0% 0%)', opacity: 1},
        exit: {opacity: 0},
      }}
      transition={{
        duration: 0.3,
      }}
      {...props}
    />
  )
)`
  position: relative;

  ${p =>
    p.step !== undefined &&
    `
      margin-left: calc(-${p.theme.space.xl} - 30px);
      display: inline-grid;
      grid-template-columns: max-content auto;
      gap: ${p.theme.space.xl};
      align-items: center;

      &:before {
        content: '${p.step}';
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        background-color: ${p.theme.tokens.background.warning.vibrant};
        border-radius: 50%;
        color: ${p.theme.tokens.content.onVibrant.dark};
        font-size: 1rem;
      }
    `}
`;
