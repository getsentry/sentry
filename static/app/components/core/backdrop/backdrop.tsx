import {useTheme} from '@emotion/react';
import {motion} from 'framer-motion';

interface BackdropProps extends Omit<
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>,
  'style' | 'className' | `on${string}`
> {
  'data-drawer-backdrop'?: string;
  'data-test-id'?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function Backdrop({onClick, ...props}: BackdropProps) {
  const theme = useTheme();
  // TODO(design-engineering): These should be exposed as `theme.tokens`
  const background = theme.type === 'light' ? '#10082845' : '#10082080';
  return (
    <motion.div
      id="backdrop"
      onClick={onClick}
      data-overlay
      {...props}
      transition={theme.motion.framer.smooth.slow}
      initial={{
        opacity: 0,
        background,
        position: 'fixed',
        inset: '0',
      }}
      animate={{opacity: 1}}
      exit={{opacity: 0}}
    />
  );
}
