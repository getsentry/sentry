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
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="content"
          id={id}
          // overflow has to clip while the height tween runs so the content
          // stays inside the shrinking box, but keeping it on once settled
          // would also clip anything extending past those bounds, e.g. a focus
          // ring at the edge or an open select menu below. So it is hidden
          // while animating and released on the way out via `transitionEnd`.
          //
          // It rides the animation targets rather than a state-driven `style`
          // prop because AnimatePresence renders an exiting child from a frozen
          // snapshot of its last present props: a re-render during the exit
          // produces a new element that is never used, so the collapse would
          // run with the stale `visible` and spill over the content below.
          // Targets go through the value pipeline straight to the DOM, and
          // framer-motion applies non-animatable values like this immediately
          // rather than tweening them.
          initial={{height: 0, opacity: 0, overflow: 'hidden'}}
          animate={{
            height: 'auto',
            opacity: 1,
            transitionEnd: {overflow: 'visible'},
          }}
          exit={{height: 0, opacity: 0, overflow: 'hidden'}}
          transition={{duration: 0.2, ease: 'easeOut'}}
          style={{width: '100%'}}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
