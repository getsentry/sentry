import type {MotionProps} from 'framer-motion';

import testableTransition from 'sentry/utils/testableTransition';

export const ONBOARDING_WELCOME_SCREEN_SOURCE = 'targeted_onboarding';

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
