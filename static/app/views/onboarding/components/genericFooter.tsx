import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

export function GenericFooter(
  props: React.ComponentProps<typeof motion.div> & FlexProps
) {
  return (
    <MotionFlex
      initial="initial"
      animate="animate"
      exit="exit"
      variants={{animate: {}}}
      transition={{
        staggerChildren: 0.2,
      }}
      {...props}
    />
  );
}

const StyledFlex = styled(Flex)`
  width: 100%;
  position: fixed;
  bottom: 0;
  left: 0;
  height: 72px;
  z-index: 100;
  background-color: ${p => p.theme.tokens.background.primary};
  justify-content: space-between;
  /* TODO(design-engineering): Replace with a directional shadow token when one exists */
  box-shadow:
    0px -4px 0px 2px ${p => p.theme.tokens.elevation.high},
    0px -1px 0px 1px ${p => p.theme.tokens.elevation.high};
`;

const MotionFlex = motion.create(StyledFlex);
