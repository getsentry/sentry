import {useTheme} from '@emotion/react';
import {motion} from 'framer-motion';

export function Backdrop() {
  const theme = useTheme();
  // TODO(design-engineering): These should be exposed as `theme.tokens`
  const background = theme.type === 'light' ? '#10082845' : '#10082080';
  return (
    <motion.div
      id="backdrop"
      transition={theme.motion.framer.smooth.slow}
      initial={{
        opacity: 0,
        background,
        position: 'fixed',
        inset: '0',
        zIndex: theme.zIndex.drawer,
      }}
      animate={{opacity: 1}}
      exit={{opacity: 0}}
    />
  );
}
