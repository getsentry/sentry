import type {RefObject} from 'react';
import {useEffect} from 'react';

const defer = (fn: () => void) => setTimeout(fn, 0);

export function useCurrentItemScroller(containerRef: RefObject<HTMLDivElement>) {
  useEffect(() => {
    let observer: MutationObserver | undefined;
    if (containerRef.current) {
      observer = new MutationObserver(mutationList => {
        for (const mutation of mutationList) {
          if (
            mutation.type === 'attributes' &&
            mutation.attributeName === 'aria-current' &&
            mutation.target.nodeType === 1 // Element nodeType
          ) {
            const element = mutation.target as Element;
            const isCurrent = element?.ariaCurrent === 'true';
            if (isCurrent) {
              // Deferring the scroll helps prevent it from not being executed
              // in certain situations. (jumping to a time with the scrubber)
              defer(() => {
                element?.scrollIntoView({
                  behavior: 'smooth',
                });
              });
            }
          }
        }
      });

      observer.observe(containerRef.current, {
        attributes: true,
        childList: false,
        subtree: true,
      });
    }

    return () => {
      observer?.disconnect();
    };
  }, [containerRef]);
}
