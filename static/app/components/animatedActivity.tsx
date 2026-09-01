import {Activity, type ReactNode, useEffect, useState} from 'react';
import {
  motion,
  type TargetAndTransition,
  type Transition,
  useAnimationControls,
} from 'framer-motion';

import {Container} from '@sentry/scraps/layout';

type ActivityMode = 'hidden' | 'visible';

interface AnimatedActivityProps {
  animate: TargetAndTransition;
  children: ReactNode;
  exit: TargetAndTransition;
  initial: TargetAndTransition;
  mode: ActivityMode;
  transition: Transition;
  elementRef?: (element: HTMLDivElement | null) => void;
  layoutMode?: 'normal' | 'pop';
}

// This compatibility component can be replaced with Motion's AnimateActivity once
// it is available in the main package: https://motion.dev/docs/react-animate-activity
export function AnimatedActivity({
  animate,
  children,
  elementRef,
  exit,
  initial,
  layoutMode = 'normal',
  mode,
  transition,
}: AnimatedActivityProps) {
  const controls = useAnimationControls();
  const [activityMode, setActivityMode] = useState<ActivityMode>(mode);

  useEffect(() => {
    if (mode === 'visible') {
      if (activityMode === 'hidden') {
        controls.set(initial);
        setActivityMode('visible');
        return;
      }

      void controls.start({...animate, transition});
      return;
    }

    if (activityMode === 'hidden') {
      return;
    }

    let cancelled = false;
    void controls.start({...exit, transition}).then(() => {
      if (cancelled) {
        return;
      }

      controls.set(initial);
      setActivityMode('hidden');
    });

    return () => {
      cancelled = true;
    };
  }, [activityMode, animate, controls, exit, initial, mode, transition]);

  const isExiting = mode === 'hidden' && activityMode === 'visible';

  return (
    <Activity mode={activityMode}>
      <MotionContainer
        ref={element => elementRef?.(element as HTMLDivElement | null)}
        area="1 / 1"
        position={layoutMode === 'pop' && isExiting ? 'absolute' : 'relative'}
        width="100%"
        initial={mode === 'visible' ? false : initial}
        animate={controls}
      >
        {children}
      </MotionContainer>
    </Activity>
  );
}

const MotionContainer = motion.create(Container);
