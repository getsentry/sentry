import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import testableTransition from 'sentry/utils/testableTransition';

/**
 * The minimum number in pixels which the selection should be considered valid
 * and will fire the onSelect handler.
 */
const MIN_SIZE = 5;

interface Options {
  /**
   * May be set to false to disable rendering the timeline cursor
   */
  enabled?: boolean;
  /**
   * Triggered when a selection has been made
   */
  onSelect?: (startX: number, endX: number) => void;
}

function useTimelineZoom<E extends HTMLElement>({enabled = true, onSelect}: Options) {
  const rafIdRef = useRef<number | null>(null);

  const containerRef = useRef<E>(null);

  const [isActive, setIsActive] = useState(false);
  const initialX = useRef(0);

  const startX = useRef(0);
  const endX = useRef(0);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }

      if (containerRef.current === null) {
        return;
      }

      if (!isActive) {
        return;
      }

      const containerRect = containerRef.current.getBoundingClientRect();

      rafIdRef.current = window.requestAnimationFrame(() => {
        if (containerRef.current === null) {
          return;
        }

        const offset = e.clientX - containerRect.left - initialX.current;
        const isLeft = offset < 0;

        const absoluteOffset = Math.abs(offset);

        const start = !isLeft
          ? initialX.current
          : Math.max(0, initialX.current - absoluteOffset);

        const width =
          e.clientX < containerRect.left
            ? initialX.current
            : Math.min(containerRect.width - start, absoluteOffset);

        containerRef.current.style.setProperty('--selectionStart', `${start}px`);
        containerRef.current.style.setProperty('--selectionWidth', `${width}px`);

        startX.current = start;
        endX.current = start + width;
      });
    },
    [isActive]
  );

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (containerRef.current === null) {
      return;
    }

    // Only primary click activates selection
    if (e.button !== 0) {
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const offset = e.clientX - containerRect.left;

    // Selection is only activated when inside the container
    const isInsideContainer =
      e.clientX > containerRect.left &&
      e.clientX < containerRect.right &&
      e.clientY > containerRect.top &&
      e.clientY < containerRect.bottom;

    if (!isInsideContainer) {
      return;
    }

    setIsActive(true);

    initialX.current = offset;

    document.body.style.setProperty('user-select', 'none');
    containerRef.current.style.setProperty('--selectionStart', `${offset}px`);
    containerRef.current.style.setProperty('--selectionWidth', '0px');
  }, []);

  const handleMouseUp = useCallback(() => {
    if (containerRef.current === null) {
      return;
    }
    if (!isActive) {
      return;
    }

    setIsActive(false);
    document.body.style.removeProperty('user-select');

    if (endX.current - startX.current >= MIN_SIZE) {
      onSelect?.(startX.current, endX.current);
    }

    startX.current = 0;
    endX.current = 0;
  }, [isActive, onSelect]);

  useEffect(() => {
    if (enabled) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      setIsActive(false);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [enabled, handleMouseMove, handleMouseDown, handleMouseUp]);

  const timelineSelector = (
    <AnimatePresence>{isActive && <Selection role="presentation" />}</AnimatePresence>
  );

  return {selectionContainerRef: containerRef, isActive, timelineSelector};
}

const Selection = styled(motion.div)`
  pointer-events: none;
  background: ${p => p.theme.translucentBorder};
  border-left: 1px solid ${p => p.theme.purple200};
  border-right: 1px solid ${p => p.theme.purple200};
  height: 100%;
  position: absolute;
  top: 0;
  left: var(--selectionStart);
  width: var(--selectionWidth);
  z-index: 2;
`;

Selection.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  transition: testableTransition({duration: 0.2}),
  variants: {
    initial: {opacity: 0},
    animate: {opacity: 1},
    exit: {opacity: 0},
  },
};

export {useTimelineZoom};
