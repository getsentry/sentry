import styled from '@emotion/styled';
import {motion} from 'framer-motion';

export const OnboardingStepHeading = styled(
  (props: React.ComponentProps<typeof motion.h2>) => (
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
`;
