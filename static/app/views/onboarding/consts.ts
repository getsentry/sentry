import type {MotionProps} from 'framer-motion';

import {testableTransition} from 'sentry/utils/testableTransition';

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

// Fade + slide-up animation for SCM step content sections.
// Use with motion.div. For staggered items, pass a delay via transition override.
export const SCM_STEP_FADE_IN: MotionProps = {
  initial: {opacity: 0, y: 20},
  animate: {opacity: 1, y: 0},
  transition: testableTransition({duration: 0.4}),
};

/**
 * Shared layout constants for SCM onboarding steps.
 * Matches the Figma content area width (506px).
 */
export const SCM_STEP_CONTENT_WIDTH = '506px';

export function scmStepFadeIn(delay: number): MotionProps {
  return {
    initial: {opacity: 0, y: 20},
    animate: {opacity: 1, y: 0},
    transition: testableTransition({duration: 0.4, delay}),
  };
}
