import type {MotionProps} from 'framer-motion';

import testableTransition from 'sentry/utils/testableTransition';

export const ONBOARDING_WELCOME_SCREEN_SOURCE = 'targeted_onboarding';

export const ONBOARDING_WELCOME_STAGGER_CONTAINER: MotionProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {
    initial: {},
    animate: {
      transition: testableTransition({
        staggerChildren: 0.1,
        delayChildren: 0.1,
      }),
    },
    exit: {},
  },
};

// Child element animation - used by each staggered item
export const ONBOARDING_WELCOME_STAGGER_ITEM: MotionProps = {
  variants: {
    initial: {opacity: 0, y: 20},
    animate: {
      opacity: 1,
      y: 0,
      transition: testableTransition({duration: 0.4}),
    },
    exit: {opacity: 0, y: -10},
  },
};
