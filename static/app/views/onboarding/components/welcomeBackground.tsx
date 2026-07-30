import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import BugAImage from 'sentry-images/spot/broken-code-light.svg';
import BugBImage from 'sentry-images/spot/seer-config-bug-1.svg';

import {Image} from '@sentry/scraps/image';
import {Container} from '@sentry/scraps/layout';

function WelcomeBackgroundImages() {
  return (
    <Fragment>
      <BugA
        variants={{
          initial: {
            opacity: 0,
            scale: 0.9,
          },
          animate: {
            opacity: 1,
            scale: 1,
            transition: {duration: 0.25},
          },
          exit: {opacity: 0},
        }}
        transition={{duration: 0.25}}
      >
        <Image src={BugAImage} alt="" />
      </BugA>
      <BugB
        variants={{
          initial: {
            opacity: 0,
            scale: 0.9,
          },
          animate: {
            opacity: 1,
            scale: 1,
            transition: {duration: 0.25},
          },
          exit: {opacity: 0},
        }}
        transition={{
          duration: 0.25,
        }}
      >
        <Image src={BugBImage} alt="" />
      </BugB>
    </Fragment>
  );
}

export function WelcomeBackgroundNewUi() {
  return (
    <ContainerNewUi
      pointerEvents="none"
      position="absolute"
      height="100%"
      width="100%"
      // Viewport-driven (`screen:`) rather than container-driven: the wrapper
      // fills the onboarding container, so its own width just tracks the
      // window — there is no narrower box for it to respond to.
      display={{'screen:2xs': 'none', 'screen:sm': 'block'}}
      variants={{
        animate: {},
        exit: {},
      }}
      transition={{staggerChildren: 0.2}}
    >
      <WelcomeBackgroundImages />
    </ContainerNewUi>
  );
}

const Illustration = styled(motion.div)`
  position: absolute;
  height: auto;
`;

const BugA = styled(Illustration)`
  left: -16rem;
  top: 0;
  width: 14rem;
`;

const BugB = styled(Illustration)`
  right: -16rem;
  bottom: 0;
  width: 12rem;
`;

const ContainerNewUi = motion.create(Container);
