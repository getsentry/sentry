import {useTheme} from '@emotion/react';
import type {Transition} from 'framer-motion';

export function useWidgetBuilderTransitionSettings(): Transition {
  const theme = useTheme();

  return {
    type: 'tween',
    ease: theme.motionControlPoints.snap,
    duration: 0.5, // TODO: Introduce a slower value
  };
}
