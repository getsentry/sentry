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
          // Clip content before it enters and as it exits, but allow focus
          // rings and menus to overflow whenever the content is present.
          // AnimatePresence exits from its last rendered props, so overflow
          // must stay in the animation targets rather than React state.
          initial={{height: 0, opacity: 0, overflow: 'hidden'}}
          animate={{height: 'auto', opacity: 1, overflow: 'visible'}}
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
