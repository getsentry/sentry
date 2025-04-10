import {useEffect, useState} from 'react';

/**
 * This hook returns a boolean value indicating whether the element is overflowing.
 * It uses a resize observer to watch for changes in the element's size.
 * @param ref - The ref of the element to observe
 * @returns Whether the element is overflowing
 */
export const useIsOverflowing = (ref: React.RefObject<HTMLDivElement | null>) => {
  // keep track of whether the element is overflowing
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    // if the ref is not available, return
    if (!ref.current) {
      return undefined;
    }

    // create a resize observer to watch for changes in the element's size
    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries?.[0];
      if (entry) {
        // if the element is overflowing, set the state
        setIsOverflowing(entry.target.scrollWidth > entry.target.clientWidth);
      }
    });

    // observe the element
    resizeObserver.observe(ref.current);

    return () => {
      // disconnect the resize observer
      resizeObserver.disconnect();
    };
  }, [ref]);

  // return whether the element is overflowing
  return isOverflowing;
};
