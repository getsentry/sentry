import {useLayoutEffect} from 'react';

interface UseScrollSyncArgs {
  direction: 'left' | 'top' | 'all';
  refsToSync: Array<React.RefObject<HTMLElement | null>>;
  scrollingRef: React.RefObject<HTMLElement | null>;
}

/**
 * This hook syncs the scroll position of the scrollingRef with the refsToSync.
 * @param direction - The direction to sync the scroll position in.
 * @param refsToSync - An array of refs to sync the scroll position with.
 * @param scrollingRef - The ref of the element to sync the scroll position with.
 */
export const useScrollSync = ({
  direction,
  refsToSync,
  scrollingRef,
}: UseScrollSyncArgs) => {
  useLayoutEffect(() => {
    if (!scrollingRef.current) {
      return undefined;
    }

    // clone the scrollingRef so we can use it in the cleanup function
    const clonedScrollingRef = scrollingRef.current;

    const onScroll = () => {
      if (refsToSync.length === 0) {
        return;
      }

      // sync the scroll position of the scrollingRef with the refsToSync
      refsToSync.forEach(ref => {
        if (!ref.current) {
          return;
        }

        switch (direction) {
          case 'left':
            ref.current.scrollLeft = clonedScrollingRef.scrollLeft;
            break;
          case 'top':
            ref.current.scrollTop = clonedScrollingRef.scrollTop;
            break;
          case 'all':
            ref.current.scrollTop = clonedScrollingRef.scrollTop;
            ref.current.scrollLeft = clonedScrollingRef.scrollLeft;
            break;
          default:
            throw new Error('Invalid direction provided to useScrollSync');
        }
      });
    };

    clonedScrollingRef.addEventListener('scroll', onScroll, {passive: true});

    return () => {
      clonedScrollingRef.removeEventListener('scroll', onScroll);
    };
  }, [scrollingRef, refsToSync, direction]);
};
