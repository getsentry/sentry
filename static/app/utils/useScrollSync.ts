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
    // if the scrollingRef is not available, return
    if (!scrollingRef.current) {
      return undefined;
    }

    // clone the scrollingRef so we can use it in the cleanup function
    const clonedScrollingRef = scrollingRef.current;

    const onScroll = () => {
      // if there are no refs to sync, return
      if (refsToSync.length === 0) {
        return;
      }

      // sync the scroll position of the scrollingRef with the refsToSync
      refsToSync.forEach(ref => {
        if (!ref.current) {
          return;
        }

        if (direction === 'left') {
          ref.current.scrollLeft = clonedScrollingRef.scrollLeft;
        } else if (direction === 'top') {
          ref.current.scrollTop = clonedScrollingRef.scrollTop;
        } else {
          ref.current.scrollTop = clonedScrollingRef.scrollTop;
          ref.current.scrollLeft = clonedScrollingRef.scrollLeft;
        }
      });
    };

    // add the scroll event listener
    clonedScrollingRef.addEventListener('scroll', onScroll, {passive: true});

    return () => {
      // remove the scroll event listener
      clonedScrollingRef.removeEventListener('scroll', onScroll);
    };
  }, [scrollingRef, refsToSync, direction]);
};
