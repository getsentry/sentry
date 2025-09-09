import {useEffect, useState} from 'react';

/**
 * This effect is used to track the distance of an element from the top of the viewport
 * as the window is resized. It accounts for both the element's position relative to
 * the viewport and the window's scroll position to maintain an accurate measurement
 * even when the user scrolls and resizes the window.
 *
 * @param overlayRef - The ref of the code display overlay.
 * @returns The scroll margin of the code display overlay.
 */
export const useSyncScrollMargin = (overlayRef: React.RefObject<HTMLElement | null>) => {
  const [scrollMargin, setScrollMargin] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!overlayRef.current) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries?.[0];
      if (entry) {
        setScrollMargin(entry.target.getBoundingClientRect().top + window.scrollY);
      }
    });

    resizeObserver.observe(overlayRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [overlayRef]);

  return scrollMargin;
};
