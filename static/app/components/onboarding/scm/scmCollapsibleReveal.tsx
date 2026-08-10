import {useState} from 'react';
import {AnimatePresence, motion, type Variants} from 'framer-motion';

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
  // Clip while height is changing, then release overflow once expanded. The
  // exit variant must own the clip because AnimatePresence freezes its child.
  const [isSettled, setIsSettled] = useState(open);
  const variants: Variants = {
    collapsed: {height: 0, opacity: 0, overflow: 'hidden'},
    expanded: {
      height: 'auto',
      opacity: 1,
      overflow: isSettled ? 'visible' : 'hidden',
    },
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="content"
          id={id}
          variants={variants}
          initial="collapsed"
          animate="expanded"
          exit="collapsed"
          transition={{duration: 0.2, ease: 'easeOut'}}
          onAnimationStart={definition => {
            if (definition === 'collapsed') {
              setIsSettled(false);
            }
          }}
          onAnimationComplete={definition => {
            if (definition === 'expanded') {
              setIsSettled(true);
            }
          }}
          style={{width: '100%'}}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
