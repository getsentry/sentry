import type {ReactNode} from 'react';
import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import {AnimatePresence, motion} from 'framer-motion';

import {Stack} from '@sentry/scraps/layout';

import {useDimensions} from 'sentry/utils/useDimensions';

export function OAuthFlowTransition({
  children,
  step,
}: {
  children: ReactNode;
  step: string;
}) {
  const theme = useTheme();
  const [element, setElement] = useState<HTMLElement | null>(null);
  const elementRef = useMemo(() => ({current: element}), [element]);
  const {height} = useDimensions({elementRef});
  return (
    <MotionStack
      position="relative"
      initial={false}
      animate={height ? {height} : undefined}
      transition={theme.motion.framer.spring.moderate}
    >
      <AnimatePresence initial={false} mode="wait">
        <MotionStack
          key={step}
          ref={setElement}
          gap="xl"
          initial={{opacity: 0, y: -10}}
          animate={{opacity: 1, y: 0}}
          exit={{opacity: 0, y: 10}}
          transition={theme.motion.framer.smooth.moderate}
        >
          {children}
        </MotionStack>
      </AnimatePresence>
    </MotionStack>
  );
}

const MotionStack = motion.create(Stack);
