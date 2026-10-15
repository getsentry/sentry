import {spring, type Transition} from 'framer-motion';

import type {MotionDuration, MotionEasing} from './types';

type MotionDefinition = Record<MotionDuration, string>;

const motionDurations: Record<MotionDuration, number> = {
  fast: 120,
  moderate: 160,
  slow: 240,
};

const motionCurves: Record<
  Exclude<MotionEasing, keyof typeof motionTransitions>,
  [number, number, number, number]
> = {
  smooth: [0.72, 0, 0.16, 1],
  snap: [0.8, -0.4, 0.5, 1],
  enter: [0.24, 1, 0.32, 1],
  exit: [0.64, 0, 0.8, 0],
};

const EMPTY_TRANSITION: Transition = {
  duration: 0,
  staggerChildren: 0,
  type: false,
};

const motionCurveWithDuration = (
  durations: Record<MotionDuration, number>,
  easing: [number, number, number, number],
  disableMotion: boolean
): [MotionDefinition, Record<MotionDuration, Transition>] => {
  const motion: MotionDefinition = {
    fast: `${durations.fast}ms cubic-bezier(${easing.join(', ')})`,
    moderate: `${durations.moderate}ms cubic-bezier(${easing.join(', ')})`,
    slow: `${durations.slow}ms cubic-bezier(${easing.join(', ')})`,
  };

  const framerMotion: Record<MotionDuration, Transition> = {
    fast: disableMotion
      ? EMPTY_TRANSITION
      : {
          duration: durations.fast / 1000,
          ease: easing,
        },
    moderate: disableMotion
      ? EMPTY_TRANSITION
      : {
          duration: durations.moderate / 1000,
          ease: easing,
        },
    slow: disableMotion
      ? EMPTY_TRANSITION
      : {
          duration: durations.slow / 1000,
          ease: easing,
        },
  };

  return [motion, framerMotion];
};

const motionTransitions: Record<'spring', Record<MotionDuration, Transition>> = {
  spring: {
    fast: {
      type: 'spring',
      stiffness: 1400,
      damping: 50,
    },
    moderate: {
      type: 'spring',
      stiffness: 1000,
      damping: 50,
    },
    slow: {
      type: 'spring',
      stiffness: 600,
      damping: 50,
    },
  },
};

const motionTransitionWithDuration = (
  transitionDefinitions: Record<MotionDuration, Transition>
): [MotionDefinition, Record<MotionDuration, Transition>] => {
  const motion = {
    fast: `${spring({
      keyframes: [0, 1],
      ...transitionDefinitions.fast,
    })}`,
    moderate: `${spring({
      keyframes: [0, 1],
      ...transitionDefinitions.moderate,
    })}`,
    slow: `${spring({
      keyframes: [0, 1],
      ...transitionDefinitions.slow,
    })}`,
  };

  return [motion, transitionDefinitions];
};

export function generateMotion(disableMotion = false) {
  const [smoothMotion, smoothFramer] = motionCurveWithDuration(
    motionDurations,
    motionCurves.smooth,
    disableMotion
  );
  const [snapMotion, snapFramer] = motionCurveWithDuration(
    motionDurations,
    motionCurves.snap,
    disableMotion
  );
  const [enterMotion, enterFramer] = motionCurveWithDuration(
    motionDurations,
    motionCurves.enter,
    disableMotion
  );
  const [exitMotion, exitFramer] = motionCurveWithDuration(
    motionDurations,
    motionCurves.exit,
    disableMotion
  );
  const [springMotion, springFramer] = motionTransitionWithDuration(
    motionTransitions.spring
  );

  return {
    smooth: smoothMotion,
    snap: snapMotion,
    enter: enterMotion,
    exit: exitMotion,
    spring: springMotion,
    framer: {
      smooth: smoothFramer,
      snap: snapFramer,
      enter: enterFramer,
      exit: exitFramer,
      spring: springFramer,
    },
  };
}

// Try to keep these ordered plz
export const zIndex = {
  // Generic z-index when you hope your component is isolated and
  // does not need to battle others for z-index priority
  initial: 1,
  truncationFullValue: 10,

  header: 1000,
  dropdown: 1001,
  stickyHeader: 1002,

  // dashboard widget builder backdrop sits behind the sidebar
  // because it renders on the right next to the sidebar
  // @TODO(design-engineering): resolve this inconsistency
  widgetBuilderDrawer: 1016,

  sidebarPanel: 1019,
  sidebar: 1020,

  // Sentry user feedback modal
  sentryErrorEmbed: 1090,

  // If you change modal also update shared-components.less
  // as the z-index for bootstrap modals lives there.
  drawer: 9999,
  modal: 10000,
  toast: 10001,

  // tooltips and hovercards can be inside modals sometimes.
  hovercard: 10002,
  tooltip: 10003,
} as const;
