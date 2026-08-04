import {Fragment} from 'react';
import {motion} from 'framer-motion';

import BugAImage from 'sentry-images/spot/broken-code-light.svg';
import BugBImage from 'sentry-images/spot/seer-config-bug-1.svg';

import {Image} from '@sentry/scraps/image';
import {Container, type ContainerProps} from '@sentry/scraps/layout';

// Hidden per-illustration rather than on the wrapper: the wrapper is the query
// container, and an element can't query itself.
const illustrationProps = {
  position: 'absolute',
  height: 'auto',
  display: {zero: 'none', xl: 'block'},
} as const satisfies ContainerProps;

function WelcomeBackgroundImages() {
  return (
    <Fragment>
      <Illustration
        {...illustrationProps}
        left="-16rem"
        top={0}
        width="14rem"
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
      </Illustration>
      <Illustration
        {...illustrationProps}
        right="-16rem"
        bottom={0}
        width="12rem"
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
      </Illustration>
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
      containerType="inline-size"
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

const Illustration = motion.create(Container);
const ContainerNewUi = motion.create(Container);
