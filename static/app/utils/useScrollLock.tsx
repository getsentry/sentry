import {useCallback, useRef} from 'react';

/**
 * Returns stable `lock` and `unlock` functions that prevent body scroll while
 * compensating for the scrollbar width with `padding-right`, avoiding the
 * layout shift that occurs when the scrollbar disappears.
 *
 * Each hook instance independently tracks the state it captured at lock-time
 * and restores it on unlock, so nested usage (e.g. a modal inside a drawer)
 * correctly round-trips through each layer's previous values.
 */
export function useScrollLock() {
  const previousOverflow = useRef('');
  const previousPadding = useRef('');

  const lock = useCallback(() => {
    previousOverflow.current = document.body.style.overflow;
    previousPadding.current = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }, []);

  const unlock = useCallback(() => {
    document.body.style.overflow = previousOverflow.current;
    document.body.style.paddingRight = previousPadding.current;
  }, []);

  return {lock, unlock};
}
