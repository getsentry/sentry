import {Children, cloneElement, useState} from 'react';
import {useTheme} from '@emotion/react';
import {mergeRefs} from '@react-aria/utils';
import {AnimatePresence, motion} from 'framer-motion';

type Props = {
  children: React.ReactNode;
};

const MIN_DURATION = 2;
const MAX_DURATION = 10;
const CHARS_PER_SECOND = 5;

function RotatingContent({children}: Props) {
  const theme = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [renderKey, setRenderKey] = useState(0);
  const [duration, setDuration] = useState(theme.motion.framer.smooth.fast.duration);

  const childArray = Children.toArray(children);
  const currentChild = childArray[currentIndex];

  if (!currentChild) {
    return null;
  }

  const fadeTransition = theme.motion.framer.smooth.fast;
  const fadeDuration = fadeTransition.duration as number;

  const measureRef = (element: HTMLElement | null) => {
    if (!element || childArray.length <= 1) {
      return;
    }

    const textLength = element.textContent?.length ?? 0;
    const calculatedDuration = Math.max(
      MIN_DURATION,
      Math.min(MAX_DURATION, textLength / CHARS_PER_SECOND + fadeDuration)
    );

    setDuration(calculatedDuration);
  };

  const childWithRef = cloneElement(currentChild, {
    ref: mergeRefs(measureRef, (currentChild as any).ref),
  } as any);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={renderKey}
        initial={{opacity: 0, y: 4}}
        animate={{opacity: [0, 1, 1], y: [4, 0, 0]}}
        exit={{opacity: 0, y: -4}}
        transition={{
          duration,
          times: childArray.length > 1 ? [0, fadeDuration / duration, 1] : undefined,
          ease: fadeTransition.ease,
        }}
        onAnimationComplete={() => {
          if (childArray.length > 1) {
            setCurrentIndex(prevIndex => (prevIndex + 1) % childArray.length);
            setRenderKey(prev => prev + 1);
          }
        }}
      >
        {childWithRef}
      </motion.div>
    </AnimatePresence>
  );
}

export default RotatingContent;
