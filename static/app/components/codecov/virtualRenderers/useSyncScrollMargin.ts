import {useEffect, useState} from 'react';

interface UseSyncScrollMarginArgs {
  overlayRef: React.RefObject<HTMLElement | null>;
}

/**
 * This effect is used to update the scroll margin of the virtualizer when the
 * code display overlay is resized. This is needed because the virtualizer
 * needs to know the offset of the code display overlay from the top of the
 * window to correctly calculate the scroll position of the virtual items.
 * We do the calculation to account for the scroll position of the window
 * incase the user has scrolled down the page, and resizes the window
 * afterwards.
 */
export const useSyncScrollMargin = ({overlayRef}: UseSyncScrollMarginArgs) => {
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
