import {Fragment, ReactNode} from 'react';
import styled from '@emotion/styled';
import {motion, useAnimation, Variants} from 'framer-motion';

import {ErrorGemlin} from 'sentry/components/resolutionBox/errorGremlin';
import {IconCheckmark} from 'sentry/icons';
import {space} from 'sentry/styles/space';

type AnimatedResolutionProps = {children: ReactNode};

const portalVariants: Variants = {
  open: {
    scale: 1,
    transition: {
      ease: 'easeOut',
      delay: 0.1,
    },
  },
  closed: {
    scale: 0,
    transition: {
      delay: 0.2,
    },
  },
};

const checkVariants: Variants = {
  hidden: {
    y: 30,
    rotate: -620,
  },
  shown: {
    y: [30, -30, 0],
    rotate: [-620, -360, 0],
    transition: {
      ease: 'easeInOut',
    },
  },
};

const textVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  shown: {
    opacity: 1,
  },
};

export function AnimatedResolution({children}: AnimatedResolutionProps) {
  const portalControls = useAnimation();
  const checkControls = useAnimation();
  const textControls = useAnimation();

  const onEndRun = async () => {
    await portalControls.start('open');
  };

  const onEndJump = async () => {
    portalControls.start('closed');
    await checkControls.start('shown');
    textControls.start('shown');
  };

  return (
    <Fragment>
      <ErrorGemlin onEndRun={onEndRun} onEndJump={onEndJump} />
      <Portal animate={portalControls} variants={portalVariants} initial="closed" />
      <CheckContainer animate={checkControls} variants={checkVariants} initial="hidden">
        <StyledIconCheckmark color="successText" />
      </CheckContainer>
      <StyledText animate={textControls} variants={textVariants} initial="hidden">
        {children}
      </StyledText>
    </Fragment>
  );
}

const CheckContainer = styled(motion.div)`
  /* clip-path: circle(50% at 50% 50%); */
`;

const StyledIconCheckmark = styled(IconCheckmark)`
  /* override margin defined in BannerSummary */
  margin-top: 0 !important;
  align-self: center;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin-top: ${space(0.5)} !important;
    align-self: flex-start;
  }
`;

const StyledText = styled(motion.span)`
  padding-left: ${space(2)};
`;

const Portal = styled(motion.div)`
  position: absolute;
  bottom: 2px;
  left: ${space(2)};
  display: block;
  width: 50px;
  height: 12px;
  background: ${p => p.theme.gray300};
  box-shadow: inset 0 3px 0 0 ${p => p.theme.gray200};
  border-radius: 120px / 30px;
`;
