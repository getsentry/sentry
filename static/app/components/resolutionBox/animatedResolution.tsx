import {ReactNode} from 'react';
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
      ease: 'easeOut',
      delay: 0.3,
    },
  },
};

const checkVariants: Variants = {
  hidden: {
    y: 30,
    rotate: -720,
  },
  shown: {
    y: [30, -30, 0],
    rotate: [-720, -360, 0],
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
    <motion.div>
      <LeftContainer>
        <Portal animate={portalControls} variants={portalVariants} initial="closed" />
        <ErrorGemlin onEndRun={onEndRun} onEndJump={onEndJump} />
        <ClipPath>
          <CheckContainer
            animate={checkControls}
            variants={checkVariants}
            initial="hidden"
          >
            <StyledIconCheckmark color="successText" />
          </CheckContainer>
        </ClipPath>
      </LeftContainer>
      <StyledText animate={textControls} variants={textVariants} initial="hidden">
        {children}
      </StyledText>
    </motion.div>
  );
}

const LeftContainer = styled('div')`
  position: absolute;
  bottom: 4px;
  left: ${space(2)};
  width: 42px;
  height: calc(100% - 8px);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ClipPath = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  clip-path: inset(-20px 0 3px 0);
`;

const CheckContainer = styled(motion.div)`
  height: ${p => p.theme.iconSizes.sm};
  width: ${p => p.theme.iconSizes.sm};
`;

const StyledIconCheckmark = styled(IconCheckmark)`
  /* override margin defined in BannerSummary */
  margin-top: 0 !important;
`;

const StyledText = styled(motion.span)`
  padding-left: 40px;
`;

const Portal = styled(motion.div)`
  position: absolute;
  bottom: 0;
  left: 0;
  display: block;
  width: 100%;
  height: 10px;
  background: ${p => p.theme.gray300};
  box-shadow: inset 0 3px 0 0 ${p => p.theme.gray200};
  border-radius: 120px / 30px;
`;
