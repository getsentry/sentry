import {useRef, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';

interface ScmCollapsibleRevealProps {
  children: React.ReactNode;
  /** When true the content is shown; toggling tweens height and opacity. */
  open: boolean;
  /** Forwarded to the animated element, e.g. as an aria-controls target. */
  id?: string;
}

/**
 * Reveals or hides content with a height + fade tween. Shared by
 * ScmCollapsibleSection and ScmAlertOptionCard so their expand/collapse timing
 * stays in sync. Animating height (rather than display) lets sibling cards in a
 * framer-motion layout="position" group reflow via normal document flow.
 * initial={false} renders the open state without animating on mount.
 */
export function ScmCollapsibleReveal({open, id, children}: ScmCollapsibleRevealProps) {
  // overflow:hidden is needed while the height tween runs so the content clips
  // cleanly, but kept on it would also clip anything that extends past the
  // settled bounds, e.g. a focus ring at the edge or an open select menu below.
  // Switch to visible once open and settled, back to hidden whenever animating.
  const [overflow, setOverflow] = useState<'hidden' | 'visible'>(
    open ? 'visible' : 'hidden'
  );
  // On collapse, AnimatePresence keeps a frozen snapshot of the last open
  // render, so a closure over `open` reads a stale `true` and never resets
  // overflow. Read the live value through a ref so completion settles correctly.
  const openRef = useRef(open);
  openRef.current = open;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="content"
          id={id}
          initial={{height: 0, opacity: 0}}
          animate={{height: 'auto', opacity: 1}}
          exit={{height: 0, opacity: 0}}
          transition={{duration: 0.2, ease: 'easeOut'}}
          onAnimationStart={() => setOverflow('hidden')}
          onAnimationComplete={() => {
            setOverflow(openRef.current ? 'visible' : 'hidden');
          }}
          style={{overflow, width: '100%'}}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
