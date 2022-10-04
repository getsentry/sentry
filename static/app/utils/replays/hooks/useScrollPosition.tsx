import {useEffect, useRef} from 'react';

import {
  ScrollContextPositionTab,
  useScrollContext,
} from 'sentry/components/replays/scrollContext';
import usePrevious from 'sentry/utils/usePrevious';

type Options = {
  id: keyof typeof ScrollContextPositionTab;
  scrollContainerRef: React.RefObject<HTMLElement>;
};

export function useScrollPosition({scrollContainerRef, id}: Options) {
  const {scrollPosition, setScrollPosition} = useScrollContext();
  const previousScrollPositions = usePrevious(scrollPosition);
  const mountedRef = useRef(false);

  // Save the last scroll position in the state
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    const handleScroll = () => {
      if (scrollContainer) {
        setScrollPosition(prevScrollPosition => {
          const currentScrollPosition = scrollContainer?.scrollTop ?? 0;
          const existingScrollPosition = prevScrollPosition.find(
            position => position.id === id
          );

          if (existingScrollPosition) {
            existingScrollPosition.scrollPosition = currentScrollPosition;
          } else {
            prevScrollPosition.push({
              id,
              scrollPosition: currentScrollPosition,
            });
          }

          return [...prevScrollPosition];
        });
      }
    };

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);

      // Set the scroll position to the last saved position when the component mounts
      if (previousScrollPositions && !mountedRef.current) {
        const previousScrollPosition = previousScrollPositions.find(
          position => position.id === id
        );
        if (previousScrollPosition) {
          scrollContainer.scrollTop = previousScrollPosition.scrollPosition;
        }

        mountedRef.current = true;
      }
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [
    id,
    previousScrollPositions,
    scrollContainerRef,
    scrollPosition,
    setScrollPosition,
  ]);

  // Set the mountedRef to false when the component unmounts
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return scrollPosition;
}
