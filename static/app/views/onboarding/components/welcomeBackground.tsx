import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import BugBImage from 'sentry-images/spot/seer-config-bug-1.svg';
import BugAImage from 'sentry-images/spot/seer-config-bug-2.svg';

import testableTransition from 'sentry/utils/testableTransition';

function WelcomeBackground() {
  return (
    <Container
      variants={{
        animate: {},
        exit: {},
      }}
      transition={testableTransition({staggerChildren: 0.2})}
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
            transition: testableTransition({duration: 0.5}),
          },
          exit: {y: -120, opacity: 0},
        }}
        transition={testableTransition({duration: 0.9})}
      >
        <img src={BugAImage} alt="Bug A" />
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
            transition: testableTransition({duration: 0.5}),
          },
          exit: {y: -200, opacity: 0},
        }}
        transition={testableTransition({
          duration: 1.1,
        })}
      >
        <img src={BugBImage} alt="Bug B" />
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
      transition={testableTransition({staggerChildren: 0.2})}
    >
      <WelcomeBackgroundImages />
    </ContainerNewUi>
  );
}

export default WelcomeBackground;

const Illustration = styled(motion.div)`
  position: absolute;
  height: auto;
`;

const BugA = styled(Illustration)`
  left: 0;
  top: 0;
  width: 10rem;
`;

const BugB = styled(Illustration)`
  right: 0;
  bottom: 0;
  width: 9rem;
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
  width: 150%;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;
