import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import BugAImage from 'sentry-images/spot/broken-code-light.svg';
import BugBImage from 'sentry-images/spot/seer-config-bug-1.svg';

import {Image} from '@sentry/scraps/image';

export function WelcomeBackground() {
  return (
    <Container
      variants={{
        animate: {},
        exit: {},
      }}
      transition={{staggerChildren: 0.1}}
    >
      <WelcomeBackgroundImages />
    </Container>
  );
}

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

const Container = styled(motion.div)`
  pointer-events: none;
  position: absolute;
  height: 150%;
  max-width: 100vw;
  width: 300%;
  top: -25%;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;

const ContainerNewUi = styled(motion.div)`
  pointer-events: none;
  position: absolute;
  height: 100%;
  width: 100%;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;
