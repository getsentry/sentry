import {useTheme} from '@emotion/react';
import {motion} from 'framer-motion';

interface BackdropProps {
  zIndex: 'drawer' | 'modal';
  'data-test-id'?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function Backdrop({onClick, zIndex, ...rest}: BackdropProps) {
  const theme = useTheme();
  // TODO(design-engineering): These should be exposed as `theme.tokens`
  const background = theme.type === 'light' ? '#10082845' : '#10082080';
  return (
    <motion.div
      id="backdrop"
      onClick={onClick}
      data-test-id={rest['data-test-id']}
      transition={theme.motion.framer.smooth.slow}
      initial={{
        opacity: 0,
        background,
        position: 'fixed',
        inset: '0',
        zIndex: theme.zIndex[zIndex],
      }}
      animate={{opacity: 1}}
      exit={{opacity: 0}}
    />
  );
}
