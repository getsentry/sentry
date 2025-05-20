import {useEffect, useState} from 'react';

/**
 * This hook returns a boolean value indicating whether the element is overflowing.
 * It uses a resize observer to watch for changes in the element's size.
 * @param ref - The ref of the element to observe
 * @returns Whether the element is overflowing
 */
export const useIsOverflowing = (ref: React.RefObject<HTMLDivElement | null>) => {
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (!ref.current) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries?.[0];
      if (entry) {
        setIsOverflowing(entry.target.scrollWidth > entry.target.clientWidth);
      }
    });

    resizeObserver.observe(ref.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [ref]);

  return isOverflowing;
};
