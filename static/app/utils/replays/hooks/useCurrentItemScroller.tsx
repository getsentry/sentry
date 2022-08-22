import type {RefObject} from 'react';
import {useEffect, useState} from 'react';

const defer = (fn: () => void) => setTimeout(fn, 0);

export function useCurrentItemScroller(containerRef: RefObject<HTMLElement>) {
  const [isAutoScrollDisabled, setIsAutoScrollDisabled] = useState(false);

  useEffect(() => {
    const containerEl = containerRef.current;
    let observer: MutationObserver | undefined;

    if (containerEl) {
      const isContainerScrollable = () =>
        containerEl.scrollHeight > containerEl.offsetHeight;

      observer = new MutationObserver(mutationList => {
        for (const mutation of mutationList) {
          if (
            mutation.type === 'attributes' &&
            mutation.attributeName === 'aria-current' &&
            mutation.target.nodeType === 1 // Element nodeType
          ) {
            const element = mutation.target as HTMLElement;
            const isCurrent = element?.ariaCurrent === 'true';
            if (isCurrent && isContainerScrollable() && !isAutoScrollDisabled) {
              let offset: number;

              // If possible scroll to the middle of the container instead of to the top
              if (element.clientHeight < containerEl.clientHeight) {
                offset =
                  element.offsetTop -
                  (containerEl.clientHeight / 2 - element.clientHeight / 2);
              } else {
                // Align it to the top as per default if the element is higher than the container
                offset = element.offsetTop;
              }
              // Deferring the scroll helps prevent it from not being executed
              // in certain situations. (jumping to a time with the scrubber)
              defer(() => {
                containerEl?.scrollTo({
                  behavior: 'smooth',
                  top: offset,
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

    const handleMouseEnter = () => {
      setIsAutoScrollDisabled(true);
    };

    const handleMouseLeave = () => {
      setIsAutoScrollDisabled(false);
    };

    containerEl?.addEventListener('mouseenter', handleMouseEnter);
    containerEl?.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      observer?.disconnect();
      containerEl?.removeEventListener('mouseenter', handleMouseEnter);
      containerEl?.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef, isAutoScrollDisabled]);
}
